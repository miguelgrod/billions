#!/usr/bin/env python3
"""Rehace las carátulas que no son carátulas.

Al ampliar el catálogo a 191 películas se buscó primero en la Wikipedia en
español, porque las clásicas vienen con el título traducido. Salió caro: la
ficha española lleva muchas veces el **logotipo** de la película en vez del
cartel (33 casos, de «Blade Runner» a «Whiplash»), y su buscador se va a otra
película con nombre parecido (La La Land -> Passengers, Nomadland -> One Night
in Miami, American Beauty -> La Bella y la Bestia).

Este script vuelve a resolverlas **empezando por la Wikipedia en inglés**, que
es la que guarda el cartel de estreno en la ficha, y sólo acepta la imagen si
tiene forma de cartel: más alta que ancha. Un logotipo es apaisadísimo (de 2:1
a 10:1) y así se cae solo.

  python3 tools/repara-caratulas.py            # sólo las que están mal
  python3 tools/repara-caratulas.py --todas    # revisa las 91 nuevas
  python3 tools/repara-caratulas.py --solo 190,186
"""
import argparse, importlib.util, json, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('fp', os.path.join(ROOT, 'tools', 'fetch-posters.py'))
fp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fp)

POSTERS = os.path.join(ROOT, 'posters')
ANCHO = 300                 # el resto del catálogo está a 300 px
# Un cartel es más alto que ancho. Se deja un margen porque siete carátulas
# auténticas son «quad» británicos apaisados (Harry Potter, Skyfall, Spectre),
# pero ésas son de la lista antigua y no pasan por aquí.
MAX_RATIO = 0.95


def medidas(ruta):
    out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', ruta],
                         capture_output=True, text=True).stdout
    w = re.search(r'pixelWidth: (\d+)', out)
    h = re.search(r'pixelHeight: (\d+)', out)
    return (int(w.group(1)), int(h.group(1))) if w and h else (0, 0)


def peliculas():
    src = open(os.path.join(ROOT, 'movies.js'), encoding='utf-8').read()
    filas = re.findall(r'\{ r: (\d+), t: "((?:[^"\\]|\\.)*)"(?:, g: \d+)?, y: (\d+)', src)
    return [(int(r), t, int(y)) for r, t, y in filas]


def candidatas(titulo, anio):
    """Páginas e imágenes posibles, la inglesa primero."""
    salida = []
    for idioma in ('en', 'es'):
        pagina, archivo = fp.busca_en_wiki(idioma, titulo, anio)
        if archivo:
            salida.append((idioma, pagina, archivo))
        time.sleep(0.15)
    return salida


def url_de(archivo, idioma, ancho=500):
    res = fp.wiki({'action': 'query', 'format': 'json', 'formatversion': '2',
                   'titles': 'File:' + archivo, 'prop': 'imageinfo',
                   'iiprop': 'url', 'iiurlwidth': str(ancho)}, idioma)
    for p in ((res or {}).get('query') or {}).get('pages', []):
        info = (p.get('imageinfo') or [{}])[0]
        u = info.get('thumburl') or info.get('url')
        if u:
            return u
    return None


def baja_y_mide(url, tmp):
    datos = fp.get(url, raw=True)
    if not datos:
        time.sleep(4)
        datos = fp.get(url, raw=True)
    if not datos:
        return None
    open(tmp, 'wb').write(datos)
    return medidas(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--todas', action='store_true', help='revisa las 91 nuevas, no sólo las torcidas')
    ap.add_argument('--solo', help='lista de puestos separados por comas')
    args = ap.parse_args()

    todas = peliculas()
    if args.solo:
        quiero = {int(x) for x in args.solo.split(',')}
        objetivo = [p for p in todas if p[0] in quiero]
    else:
        objetivo = []
        for r, t, y in todas:
            if r <= 100:                       # la lista antigua salió bien entera
                continue
            ruta = os.path.join(POSTERS, f'{r:03d}.jpg')
            if not os.path.exists(ruta):
                continue
            w, h = medidas(ruta)
            if args.todas or (h and w / h > MAX_RATIO):
                objetivo.append((r, t, y))

    print(f'{len(objetivo)} carátulas a rehacer\n', file=sys.stderr)
    informe, arregladas, siguen = {}, [], []
    for n, (r, t, y) in enumerate(objetivo, 1):
        destino = os.path.join(POSTERS, f'{r:03d}.jpg')
        antes = medidas(destino) if os.path.exists(destino) else (0, 0)
        elegida = None
        for idioma, pagina, archivo in candidatas(t, y):
            url = url_de(archivo, idioma)
            if not url:
                continue
            tmp = destino + '.tmp'
            med = baja_y_mide(url, tmp)
            if not med or not med[1]:
                continue
            w, h = med
            if w / h <= MAX_RATIO:             # tiene forma de cartel
                subprocess.run(['sips', '-s', 'format', 'jpeg', '--resampleWidth', str(ANCHO),
                                tmp, '--out', destino], capture_output=True)
                os.remove(tmp)
                elegida = (idioma, pagina, archivo, w, h)
                break
            os.remove(tmp)                     # es un logotipo: no vale
            print(f'      descartada {idioma}:{archivo[:38]} ({w}x{h})', file=sys.stderr)
            time.sleep(0.2)
        if elegida:
            idioma, pagina, archivo, w, h = elegida
            informe[str(r)] = {'titulo': t, 'anio': y, 'wiki': idioma, 'pagina': pagina,
                               'archivo': archivo}
            arregladas.append(r)
            print(f'{n:3}/{len(objetivo)}  {t[:30]:<30} {antes[0]}x{antes[1]} -> '
                  f'{medidas(destino)[0]}x{medidas(destino)[1]}  [{idioma}] {archivo[:40]}',
                  file=sys.stderr)
        else:
            siguen.append((r, t))
            print(f'{n:3}/{len(objetivo)}  {t[:30]:<30} SIN CARTEL DE VERDAD', file=sys.stderr)
        time.sleep(0.25)

    p_inf = os.path.join(POSTERS, '_reparadas.json')
    previo = json.load(open(p_inf, encoding='utf-8')) if os.path.exists(p_inf) else {}
    previo.update(informe)
    json.dump(previo, open(p_inf, 'w'), ensure_ascii=False, indent=1)
    print(f'\n{len(arregladas)} arregladas · {len(siguen)} sin resolver', file=sys.stderr)
    for r, t in siguen:
        print(f'   - {r} {t}', file=sys.stderr)


if __name__ == '__main__':
    main()
