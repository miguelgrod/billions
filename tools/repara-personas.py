#!/usr/bin/env python3
"""Vuelve a resolver las fotos de personas que apuntan a otro con nombre parecido.

La búsqueda de reserva de tools/fetch-people.py se quedaba con el primer
resultado que hablase de cine, sin comprobar que fuera quien buscábamos: 26 de
los 40 actores desambiguados tenían la cara de otra persona —'Daniel Richter'
salía con la de Andy Richter, 'Jack Benny' con la de Jack Nance y 'Peter Appel'
con la de Andrea Riseborough—. Ya está el filtro en su sitio (`mismo_nombre`);
esto rehace a los que quedaron mal.

Quien no aparezca con el nombre correcto se queda **sin foto**, y así no entra
en juego. Antes que enseñar a otro, mejor no enseñar a nadie.

  python3 tools/repara-personas.py --role actors
  python3 tools/repara-personas.py --role actors --solo "Jack Benny,Bob Wells"
"""
import argparse, importlib.util, json, os, re, sys, time, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('fp', os.path.join(ROOT, 'tools', 'fetch-people.py'))
fp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fp)


# Además de intérprete, hay quien figura en un reparto siendo cómico, cantante o
# músico: Jack Benny era «entertainer», Chester Conklin «comedian» y John Legend
# «singer». Con `mismo_nombre` filtrando ya la identidad, este filtro sólo tiene
# que confirmar que el artículo es de alguien del mundo del espectáculo.
ESPECTACULO = re.compile(r'\b(actor|actress|performer|entertainer|comedian|comic|'
                         r'singer|musician|dancer|model|star|filmmaker|director|'
                         r'screenwriter|voice artist|artist)\b', re.I)


def _sin_tildes(t):
    return unicodedata.normalize('NFKD', t or '').encode('ascii', 'ignore').decode().lower()


def peliculas_de(nombre):
    """En qué películas del catálogo sale. Es la prueba de identidad más fuerte:
    si el artículo nombra una de ellas, no hay duda de que es quien buscamos."""
    src = open(os.path.join(ROOT, 'movies.js'), encoding='utf-8').read()
    salida = []
    for m in re.finditer(r't: "((?:[^"\\]|\\.)*)"(.*?)\}', src):
        if f'"{nombre}"' in m.group(2):
            salida.append(m.group(1))
    return salida


def texto_de(pagina):
    """Primera sección del artículo, en texto plano y sin cortar a dos frases."""
    res = fp.api({'action': 'query', 'format': 'json', 'formatversion': '2',
                  'titles': pagina, 'redirects': '1', 'prop': 'extracts',
                  'exintro': '1', 'explaintext': '1'})
    for p in ((res.get('query') or {}).get('pages') or []):
        return p.get('extract', '') or ''
    return ''


def resuelve(nombre, rol, ancho):
    """Devuelve (url, página) del artículo que de verdad es de esta persona."""
    pelis = peliculas_de(nombre)
    candidatos = [nombre] + [f'{nombre} {suf}' for suf in rol['sufijos']]
    res = fp.api({'action': 'query', 'format': 'json', 'formatversion': '2',
                  'list': 'search', 'srsearch': f'{nombre} {rol["busca"]}', 'srlimit': '5'})
    candidatos += [h['title'] for h in ((res.get('query') or {}).get('search') or [])]

    mejor = None
    vistos = set()
    for cand in candidatos:
        if cand in vistos:
            continue
        vistos.add(cand)
        # el filtro de identidad va primero: sin él se colaba otra persona
        if not fp.mismo_nombre(nombre, cand):
            continue
        texto = texto_de(cand)
        if not texto:
            continue
        plano = _sin_tildes(texto)
        cita = any(_sin_tildes(t) in plano for t in pelis)
        oficio = bool(ESPECTACULO.search(texto))
        if not (cita or oficio):
            continue
        # nombrar una de sus películas es la prueba fuerte; el oficio, la débil
        nota = 2 if cita else 1
        if not mejor or nota > mejor[0]:
            mejor = (nota, cand)
        if nota == 2:
            break
        time.sleep(0.15)
    if not mejor:
        return None, None

    pagina = mejor[1]
    res = fp.api({'action': 'query', 'format': 'json', 'formatversion': '2',
                  'titles': pagina, 'redirects': '1', 'prop': 'pageimages',
                  'piprop': 'thumbnail', 'pithumbsize': str(ancho)})
    for p in ((res.get('query') or {}).get('pages') or []):
        url = (p.get('thumbnail') or {}).get('source')
        if url:
            return url, pagina
    # pageimages se salta los archivos no libres; esto los alcanza igual. Pero
    # coge la primera imagen del artículo, y ahí puede haber un cartel: a
    # Sebastian Hansen le tocó el de «A Minecraft Movie». Se exige que el nombre
    # del archivo lleve el de la persona, que es lo que tienen los retratos.
    url, archivo = fp.imagen_del_articulo(pagina, ancho)
    if url and archivo and fp.mismo_nombre(nombre, re.sub(r'^File:', '', archivo)):
        return url, pagina
    return None, pagina


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--role', choices=sorted(fp.ROLES), default='actors')
    ap.add_argument('--solo', help='nombres separados por comas')
    ap.add_argument('--width', type=int, default=300)
    args = ap.parse_args()
    rol = fp.ROLES[args.role]
    carpeta = os.path.join(ROOT, rol['carpeta'])
    p_inf = os.path.join(carpeta, '_report.json')
    informe = json.load(open(p_inf, encoding='utf-8'))
    indirecta = informe.get('via_indirecta') or {}
    fotos = informe.get('fotos') or {}

    if args.solo:
        objetivo = [n.strip() for n in args.solo.split(',')]
    else:
        objetivo = [n for n, t in sorted(indirecta.items()) if not fp.mismo_nombre(n, t)]
    print(f'{len(objetivo)} a rehacer\n', file=sys.stderr)

    arreglados, perdidos = [], []
    for i, n in enumerate(objetivo, 1):
        antes = indirecta.get(n, '(nombre a secas)')
        url, pagina = resuelve(n, rol, args.width)
        if url:
            destino = os.path.join(carpeta, fp.slug(n) + os.path.splitext(url.split('?')[0])[1])
            if fp.download(url, destino):
                archivo = fp.normaliza(destino, args.width)
                fotos[n] = archivo
                indirecta[n] = pagina
                arreglados.append((n, antes, pagina))
                print(f'{i:3}/{len(objetivo)}  {n[:24]:<24} {antes[:26]:<26} -> {pagina}',
                      file=sys.stderr)
                time.sleep(0.4)
                continue
        # sin identidad fiable: fuera del índice y fuera del juego
        viejo = fotos.pop(n, None)
        indirecta.pop(n, None)
        if viejo:
            ruta = os.path.join(carpeta, viejo)
            if os.path.exists(ruta) and viejo not in fotos.values():
                os.remove(ruta)
        perdidos.append((n, antes))
        print(f'{i:3}/{len(objetivo)}  {n[:24]:<24} {antes[:26]:<26} -> SIN FOTO FIABLE',
              file=sys.stderr)
        time.sleep(0.3)

    informe['fotos'] = fotos
    informe['via_indirecta'] = indirecta
    informe['sin_foto'] = sorted(set((informe.get('sin_foto') or []) + [n for n, _ in perdidos]))
    json.dump(informe, open(p_inf, 'w'), ensure_ascii=False, indent=1)

    # El índice se reescribe entero para que no queden nombres apuntando a fotos
    # que ya no están.
    indice = os.path.join(ROOT, rol['indice'])
    src = open(indice, encoding='utf-8').read()
    const_map = rol['consts'][1]
    cabeza, _, _ = src.partition(f'const {const_map}')
    cuerpo = ''.join(f'  "{n}": "{fotos[n]}",\n' for n in sorted(fotos))
    open(indice, 'w', encoding='utf-8').write(f'{cabeza}const {const_map} = {{\n{cuerpo}}};\n')

    print(f'\n{len(arreglados)} arreglados · {len(perdidos)} sin foto fiable', file=sys.stderr)
    for n, antes in perdidos:
        print(f'   - {n} (tenía la de «{antes}»)', file=sys.stderr)


if __name__ == '__main__':
    main()
