#!/usr/bin/env python3
"""Descarga el año de nacimiento de los actores y genera nacimientos.js.

Sirve para que las preguntas de reparto no enfrenten a un actor de los años
cincuenta con uno de hoy: con la edad a mano, el generador puede exigir que los
dos sean de una quinta parecida.

La fuente es **Wikidata** (propiedad P569), no el texto del artículo: viene como
dato y no hay que adivinarlo de una frase. Se entra por el título del artículo
inglés, que es el que ya resolvió tools/fetch-people.py — los cuarenta que
necesitaron desambiguación están en actors/_report.json bajo `via_indirecta`.

  python3 tools/fetch-nacimientos.py
"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = 'BillionsQuiz/1.0 (juego personal; bonitu@garciarodriguez.net)'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WD = 'https://www.wikidata.org/w/api.php?'
EN = 'https://en.wikipedia.org/w/api.php?'
LOTE = 50                       # tope de wbgetentities


def pide(params, intentos=3, base=WD):
    req = urllib.request.Request(base + urllib.parse.urlencode(params), headers={'User-Agent': UA})
    for n in range(intentos):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if n == intentos - 1:
                print(f'   ! {e}', file=sys.stderr)
                return {}
            time.sleep(2)


def nombres():
    """Todos los actores en juego: los de los repartos y los del top 50."""
    src = open(os.path.join(ROOT, 'actors.js'), encoding='utf-8').read()
    reparto = re.findall(r'"([^"]+)":\s*"[^"]+\.jpg"', src.split('ACTOR_PHOTOS')[1])
    top = []
    p = os.path.join(ROOT, 'actores.js')
    if os.path.exists(p):
        top = re.findall(r'n: "([^"]+)"', open(p, encoding='utf-8').read())
    return sorted(set(reparto) | set(top))


def titulos(gente):
    """Nombre -> título del artículo inglés."""
    indirecta = {}
    p = os.path.join(ROOT, 'actors', '_report.json')
    if os.path.exists(p):
        indirecta = (json.load(open(p, encoding='utf-8')) or {}).get('via_indirecta') or {}
    return {n: indirecta.get(n, n) for n in gente}


def anio_de(entidad):
    """P569 -> año. Las fechas de Wikidata vienen como +1969-10-09T00:00:00Z."""
    for c in (entidad.get('claims') or {}).get('P569', []):
        valor = ((c.get('mainsnak') or {}).get('datavalue') or {}).get('value') or {}
        t = valor.get('time') or ''
        m = re.match(r'([+-])(\d{4})', t)
        if m:
            anio = int(m.group(2))
            if m.group(1) == '-':
                continue                       # antes de Cristo: no es nuestro caso
            if 1850 <= anio <= 2020:
                return anio
    return None


def main():
    gente = nombres()
    mapa = titulos(gente)
    por_titulo = {}
    for n, t in mapa.items():
        por_titulo.setdefault(t, []).append(n)
    claves = sorted(por_titulo)
    print(f'{len(gente)} actores · {len(claves)} artículos', file=sys.stderr)

    anios, sin = {}, []
    for i in range(0, len(claves), LOTE):
        trozo = claves[i:i + LOTE]
        res = pide({'action': 'wbgetentities', 'format': 'json', 'sites': 'enwiki',
                    'titles': '|'.join(trozo), 'props': 'claims|sitelinks',
                    'sitefilter': 'enwiki', 'redirects': 'yes'})
        ents = (res or {}).get('entities') or {}
        # la respuesta no viene indexada por título, sino por Q-id: se recupera
        # el título desde el sitelink de cada entidad
        for ent in ents.values():
            if 'missing' in ent:
                continue
            titulo = ((ent.get('sitelinks') or {}).get('enwiki') or {}).get('title')
            a = anio_de(ent)
            if titulo and a:
                for n in por_titulo.get(titulo, []):
                    anios[n] = a
        print(f'  {min(i + LOTE, len(claves)):4}/{len(claves)}  con año: {len(anios)}',
              file=sys.stderr)
        time.sleep(0.4)

    # Segunda pasada para los que no cuadran por el título: 'Zoe Saldana' contra
    # 'Zoë Saldaña', 'Charles Chaplin' contra 'Charlie Chaplin'. Wikipedia sí
    # normaliza acentos y sigue redirecciones, así que se le pide a ella el
    # identificador de Wikidata y se entra por ahí.
    rezagados = [n for n in gente if n not in anios]
    if rezagados:
        print(f'\nsegunda pasada por Wikipedia: {len(rezagados)}', file=sys.stderr)
        qids = {}
        for i in range(0, len(rezagados), LOTE):
            trozo = [mapa[n] for n in rezagados[i:i + LOTE]]
            res = pide({'action': 'query', 'format': 'json', 'formatversion': '2',
                        'titles': '|'.join(trozo), 'redirects': '1',
                        'prop': 'pageprops', 'ppprop': 'wikibase_item'}, base=EN)
            q = (res or {}).get('query') or {}
            alias = {}
            for clave in ('normalized', 'redirects'):
                for r in q.get(clave, []):
                    alias[r['to']] = alias.get(r['from'], r['from'])
            for pg in q.get('pages', []):
                pedido = alias.get(pg['title'], pg['title'])
                qid = (pg.get('pageprops') or {}).get('wikibase_item')
                if qid:
                    qids[qid] = por_titulo.get(pedido, [])
            time.sleep(0.3)
        ids = sorted(qids)
        for i in range(0, len(ids), LOTE):
            res = pide({'action': 'wbgetentities', 'format': 'json',
                        'ids': '|'.join(ids[i:i + LOTE]), 'props': 'claims'})
            for qid, ent in ((res or {}).get('entities') or {}).items():
                a = anio_de(ent)
                if a:
                    for n in qids.get(qid, []):
                        anios[n] = a
            time.sleep(0.3)

    sin = [n for n in gente if n not in anios]
    with open(os.path.join(ROOT, 'nacimientos.js'), 'w', encoding='utf-8') as f:
        f.write('// Año de nacimiento de los actores, de Wikidata (P569).\n')
        f.write('// Generado por tools/fetch-nacimientos.py — no editar a mano.\n')
        f.write('const NACIMIENTOS = {\n')
        for n in sorted(anios):
            f.write(f'  "{n}": {anios[n]},\n')
        f.write('};\n')

    print(f'\nnacimientos.js con {len(anios)} de {len(gente)} · sin fecha: {len(sin)}',
          file=sys.stderr)
    for n in sin[:40]:
        print(f'   - {n}', file=sys.stderr)
    if len(sin) > 40:
        print(f'   … y {len(sin) - 40} más', file=sys.stderr)


if __name__ == '__main__':
    main()
