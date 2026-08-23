#!/usr/bin/env python3
"""Descarga fotos de los directores o los actores del Excel.

Los nombres salen de `top_peliculas_taquilla_y_critica.xlsx` (hoja "Listado
completo"). Las fotos, de la Wikipedia en inglés: al contrario que las carátulas,
las de personas suelen ser libres, así que aquí no hay techo de resolución.

  python3 tools/fetch-people.py --role directors
  python3 tools/fetch-people.py --role actors --width 300
  python3 tools/fetch-people.py --role actors --names     # sólo nombres
"""
import argparse, json, os, re, subprocess, sys, time, unicodedata
import urllib.parse, urllib.request
import xml.etree.ElementTree as ET
import zipfile

UA = 'BillionsQuiz/1.0 (juego personal; bonitu@garciarodriguez.net)'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://en.wikipedia.org/w/api.php?'
XLSX = os.path.join(ROOT, 'top_peliculas_taquilla_y_critica.xlsx')
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

# Qué se busca en la primera frase del artículo para dar por buena la identidad.
# Para actores es estricto a propósito: 'Chris Evans' a secas es un presentador
# británico, y su artículo habla de televisión y radio, no de interpretación.
# Para un director hay que exigir que el artículo hable de DIRIGIR. La versión
# antigua admitía también 'films', 'movie', 'cinema' y —lo peor— 'actor', que
# cumple cualquiera del gremio: por eso 'Steve McQueen' se resolvía en el actor
# de Bullitt en vez de en el director de 12 Years a Slave, y la validación daba
# el cambiazo por bueno sin rechistar. Quien dirige y actúa (Eastwood, Chaplin)
# sigue pasando, porque su artículo dice las dos cosas.
CINE = re.compile(r'\b(director|directed|directs|directing|film ?mak(er|ing)|'
                  r'screenwriter|animator)\b', re.I)
INTERPRETE = re.compile(r'\b(actor|actress|performer|voice artist)\b', re.I)

ROLES = {
    'directors': dict(cols=['D'], valida=CINE, carpeta='directors', indice='directors.js',
                      consts=('DIRECTORS', 'DIRECTOR_PHOTOS'),
                      sufijos=['(director)', '(filmmaker)', '(film director)'],
                      busca='film director'),
    'actors':    dict(cols=list('HIJKL'), valida=INTERPRETE, carpeta='actors', indice='actors.js',
                      consts=('ACTORS', 'ACTOR_PHOTOS'),
                      sufijos=['(actor)', '(actress)'],
                      busca='actor actress film'),
}

ICONOS = re.compile(r'\.svg$|commons-logo|edit-ltr|symbol|ambox|question_book', re.I)

# Excepciones conocidas en las que el artículo bueno se llama de otra manera:
# tres dúos con artículo conjunto y un seudónimo. Comprobadas a mano.
ALIAS_OK = {
    ('Anthony Russo', 'Russo brothers'), ('Joe Russo', 'Russo brothers'),
    ('Daniel Kwan', 'Daniels (directors)'), ('Daniel Scheinert', 'Daniels (directors)'),
    ('Anna Boden', 'Boden and Fleck'), ('Ryan Fleck', 'Boden and Fleck'),
    ('Yu Yang', 'Jiaozi (director)'),
}


def _palabras(t):
    t = re.sub(r'\s*\([^)]*\)', '', t or '')          # fuera "(actor)", "(director)"
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    return [w for w in re.findall(r'[a-z]+', t) if len(w) > 1]


def mismo_nombre(pedido, titulo):
    """¿El artículo es de quien buscábamos, o de otro que también actúa?

    Sin esto, la búsqueda de reserva se quedaba con el primer resultado que
    hablara de cine, aunque fuera otra persona: 'Daniel Richter' acababa en
    Andy Richter, 'Jack Benny' en Jack Nance y 'Peter Appel' en Andrea
    Riseborough. Salían 26 caras equivocadas de 40 desambiguadas.
    """
    if (pedido, titulo) in ALIAS_OK:
        return True
    p, a = _palabras(pedido), set(_palabras(titulo))
    return bool(p) and all(w in a for w in p)


def api(params, tries=3):
    req = urllib.request.Request(API + urllib.parse.urlencode(params),
                                 headers={'User-Agent': UA})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if attempt == tries - 1:
                print(f'   ! {e}', file=sys.stderr)
                return {}
            time.sleep(2)


def download(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                open(dest, 'wb').write(r.read())
            return True
        except Exception as e:
            if attempt == 2:
                print(f'   ! {e}', file=sys.stderr)
                return False
            time.sleep(4)


def sheet_rows(name):
    z = zipfile.ZipFile(XLSX)
    root = ET.fromstring(z.read(f'xl/worksheets/{name}'))
    rows = []
    for row in root.findall('.//m:row', NS):
        c = {}
        for cell in row.findall('m:c', NS):
            ref = re.match(r'([A-Z]+)', cell.get('r')).group(1)
            t = cell.find('.//m:t', NS)
            v = cell.find('m:v', NS)
            c[ref] = t.text if t is not None else (v.text if v is not None else '')
        if c.get('A', '').isdigit():
            rows.append(c)
    return rows


def split_people(celda):
    """'Anthony & Joe Russo' -> ['Anthony Russo', 'Joe Russo'].

    Cuando dos codirectores comparten apellido, el Excel sólo lo escribe una vez;
    hay que copiarlo a la primera mitad o Wikipedia no encuentra a nadie.
    """
    partes = [p.strip() for p in re.split(r'\s*&\s*|\s+y\s+', celda) if p.strip()]
    if len(partes) < 2:
        return partes
    apellido = partes[-1].split()[-1]
    return [p if len(p.split()) > 1 else f'{p} {apellido}' for p in partes]


def slug(name):
    n = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')


def primera_pasada(names, width):
    """Nombre -> (url, extracto). Por lotes; exlimit obliga a ir de 20 en 20."""
    found = {}
    names = list(names)
    for i in range(0, len(names), 20):
        chunk = names[i:i + 20]
        res = api({'action': 'query', 'format': 'json', 'formatversion': '2',
                   'titles': '|'.join(chunk), 'redirects': '1',
                   'prop': 'pageimages|extracts', 'piprop': 'thumbnail',
                   'pithumbsize': str(width),
                   'exintro': '1', 'explaintext': '1', 'exsentences': '2', 'exlimit': '20'})
        q = res.get('query') or {}
        alias = {}
        for clave in ('normalized', 'redirects'):
            for r in q.get(clave, []):
                alias[r['to']] = alias.get(r['from'], r['from'])
        for p in q.get('pages', []):
            pedido = alias.get(p['title'], p['title'])
            found[pedido] = ((p.get('thumbnail') or {}).get('source'),
                             p.get('extract', ''), p['title'])
        time.sleep(0.4)
    return found


def desambigua(name, width, rol):
    """Segundo intento: títulos desambiguados y búsqueda."""
    candidatos = [f'{name} {suf}' for suf in rol['sufijos']]
    res = api({'action': 'query', 'format': 'json', 'formatversion': '2',
               'list': 'search', 'srsearch': f'{name} {rol["busca"]}', 'srlimit': '4'})
    candidatos += [h['title'] for h in ((res.get('query') or {}).get('search') or [])]
    for cand in candidatos:
        res = api({'action': 'query', 'format': 'json', 'formatversion': '2',
                   'titles': cand, 'redirects': '1',
                   'prop': 'pageimages|extracts', 'piprop': 'thumbnail',
                   'pithumbsize': str(width),
                   'exintro': '1', 'explaintext': '1', 'exsentences': '2'})
        for p in ((res.get('query') or {}).get('pages') or []):
            thumb = (p.get('thumbnail') or {}).get('source')
            extracto = p.get('extract', '')
            # que sea del gremio no basta: tiene que ser quien buscamos
            if thumb and rol['valida'].search(extracto) and mismo_nombre(name, p['title']):
                return thumb, extracto, p['title']
        time.sleep(0.2)
    return None, '', None


def imagen_del_articulo(name, width):
    """pageimages omite los archivos no libres; esto los alcanza igual."""
    res = api({'action': 'query', 'format': 'json', 'formatversion': '2',
               'titles': name, 'redirects': '1', 'prop': 'images', 'imlimit': '10'})
    for p in ((res.get('query') or {}).get('pages') or []):
        for im in p.get('images', []):
            if ICONOS.search(im['title']):
                continue
            info = api({'action': 'query', 'format': 'json', 'formatversion': '2',
                        'titles': im['title'], 'prop': 'imageinfo',
                        'iiprop': 'url', 'iiurlwidth': str(width)})
            for q in ((info.get('query') or {}).get('pages') or []):
                ii = (q.get('imageinfo') or [{}])[0]
                url = ii.get('thumburl') or ii.get('url')
                if url:
                    return url, im['title']
    return None, None


def normaliza(path, width):
    """Todo a JPEG del mismo ancho: Commons devuelve tamaños dispares."""
    destino = os.path.splitext(path)[0] + '.jpg'
    r = subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80',
                        '--resampleWidth', str(width), path, '--out', destino],
                       capture_output=True)
    if r.returncode == 0:
        if path != destino and os.path.exists(path):
            os.remove(path)
        return os.path.basename(destino)
    return os.path.basename(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--role', choices=sorted(ROLES), required=True)
    ap.add_argument('--names', action='store_true', help='sólo nombres, sin descargar')
    ap.add_argument('--width', type=int, default=400)
    ap.add_argument('--refresh', action='store_true',
                    help='ignora lo ya descargado y lo vuelve a resolver todo')
    args = ap.parse_args()
    rol = ROLES[args.role]
    outdir = os.path.join(ROOT, rol['carpeta'])

    # --- nombres desde el Excel ---
    completo = sheet_rows('sheet3.xml')
    por_recaudacion, personas = {}, []
    for f in completo:
        nombres = []
        for col in rol['cols']:
            for n in split_people(f.get(col, '')):
                if n not in nombres:
                    nombres.append(n)
        for n in nombres:
            if n not in personas:
                personas.append(n)
        try:
            por_recaudacion[int(f['G'])] = nombres
        except (KeyError, ValueError):
            pass

    # --- cruce con el juego: la recaudación es clave exacta y única ---
    movies = re.findall(r'\{ r: (\d+), t: "((?:[^"\\]|\\.)*)", g: (\d+)',
                        open(os.path.join(ROOT, 'movies.js'), encoding='utf-8').read())
    por_puesto, sin_cruce = {}, []
    for r, t, g in movies:
        nombres = por_recaudacion.get(int(g))
        if nombres:
            por_puesto[int(r)] = nombres
        else:
            sin_cruce.append((int(r), t))
    print(f'{len(completo)} películas · {len(personas)} personas distintas ({args.role})',
          file=sys.stderr)
    print(f'cruzan con el juego: {len(por_puesto)}/{len(movies)}', file=sys.stderr)
    for r, t in sin_cruce:
        print(f'   sin datos: #{r} {t}', file=sys.stderr)

    # --- fotos ---
    fotos, sin_foto, dudosos, via_indirecta = {}, [], [], {}
    if not args.names:
        # Lo ya resuelto en pasadas anteriores no se vuelve a consultar: así el
        # reintento sólo trabaja sobre los huecos (los 429 de Wikipedia dejan
        # siempre alguno) en vez de repetir las 641 comprobaciones de identidad.
        previo = {}
        cache = os.path.join(outdir, '_report.json')
        if os.path.exists(cache) and not args.refresh:
            viejo = json.load(open(cache, encoding='utf-8'))
            previo = {n: f for n, f in viejo.get('fotos', {}).items()
                      if os.path.exists(os.path.join(outdir, f))}
            via_indirecta = viejo.get('via_indirecta', {})
            fotos.update(previo)
            print(f'{len(previo)} fotos ya descargadas se dan por buenas '
                  f'(--refresh para rehacerlas)', file=sys.stderr)
        pendientes = [n for n in personas if n not in previo]
        print(f'\nBuscando fotos ({len(pendientes)} pendientes de {len(personas)})…',
              file=sys.stderr)
        info = primera_pasada(pendientes, args.width) if pendientes else {}
        os.makedirs(outdir, exist_ok=True)
        for i, n in enumerate(pendientes, 1):
            url, extracto, pagina = info.get(n, (None, '', None))
            via = None
            # La identidad se valida SIEMPRE, no sólo cuando falta la foto: el
            # nombre a secas puede llevar a otra persona con artículo e imagen.
            if not url or not rol['valida'].search(extracto or ''):
                url2, extracto2, via2 = desambigua(n, args.width, rol)
                if url2:
                    url, extracto, via = url2, extracto2, via2
                elif not url:
                    url, via = imagen_del_articulo(n, args.width)
            if not url:
                sin_foto.append(n)
                continue
            if not rol['valida'].search(extracto or ''):
                dudosos.append((n, (extracto or '')[:90]))
            if via:
                via_indirecta[n] = via
            ext = '.png' if url.lower().split('?')[0].endswith('.png') else '.jpg'
            dest = os.path.join(outdir, slug(n) + ext)
            if os.path.exists(dest) or download(url, dest):
                fotos[n] = normaliza(dest, args.width)
                if i % 25 == 0 or i == len(pendientes):
                    print(f'   {i}/{len(pendientes)}', file=sys.stderr)
                time.sleep(0.15)
            else:
                sin_foto.append(n)

    # --- índice ---
    c_pelis, c_fotos = rol['consts']
    with open(os.path.join(ROOT, rol['indice']), 'w', encoding='utf-8') as f:
        f.write(f'// {args.role} por puesto de película y foto por persona\n')
        f.write(f'// Generado por tools/fetch-people.py --role {args.role}\n')
        f.write('// Nombres: top_peliculas_taquilla_y_critica.xlsx · Fotos: Wikipedia en inglés\n')
        f.write(f'const {c_pelis} = {{\n')
        for r in sorted(por_puesto):
            lista = ', '.join(json.dumps(n, ensure_ascii=False) for n in por_puesto[r])
            f.write(f'  {r}: [{lista}],\n')
        f.write('};\n\n')
        f.write(f'const {c_fotos} = {{\n')
        for n in sorted(fotos):
            f.write(f'  {json.dumps(n, ensure_ascii=False)}: "{fotos[n]}",\n')
        f.write('};\n')

    print(f'\n{len(fotos)}/{len(personas)} fotos en {rol["carpeta"]}/', file=sys.stderr)
    if sin_foto:
        print(f'sin foto ({len(sin_foto)}): ' + ', '.join(sin_foto), file=sys.stderr)
    if dudosos:
        print(f'\nidentidad no confirmada ({len(dudosos)}):', file=sys.stderr)
        for n, e in dudosos:
            print(f'   {n}: {e}', file=sys.stderr)
    os.makedirs(outdir, exist_ok=True)
    json.dump({'por_puesto': por_puesto, 'fotos': fotos, 'sin_foto': sin_foto,
               'dudosos': dudosos, 'via_indirecta': via_indirecta},
              open(os.path.join(outdir, '_report.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
