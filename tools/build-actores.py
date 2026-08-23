#!/usr/bin/env python3
"""Genera actores.js a partir de top_50_actores_numero_peliculas.xlsx.

Los cincuenta actores con más películas rodadas. La foto es requisito: quien no
la tenga no entra en el juego, como el resto del catálogo. Treinta y nueve ya
están descargados de los repartos de las películas; los demás se buscan en la
Wikipedia inglesa con la misma maquinaria que tools/fetch-people.py, validando
que el artículo sea de un intérprete y no de un homónimo.

  python3 tools/build-actores.py
  python3 tools/build-actores.py --refresh   # vuelve a bajar las que ya están
"""
import argparse, importlib.util, json, os, re, sys, time, unicodedata
import xml.etree.ElementTree as ET
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('fp', os.path.join(ROOT, 'tools', 'fetch-people.py'))
fp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fp)

XLSX = os.path.join(ROOT, 'top_50_actores_numero_peliculas.xlsx')
HOJA = 'Top 50 Actores'
CARPETA = os.path.join(ROOT, 'actors')
ANCHO = 300                      # el mismo que el resto de fotos de actores
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def filas():
    z = zipfile.ZipFile(XLSX)
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    hojas = [s.get('name') for s in wb.iter(NS + 'sheet')]
    if HOJA not in hojas:
        raise SystemExit(f'No encuentro la hoja «{HOJA}». Hay: {hojas}')
    root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))

    def val(c):
        if c.get('t') == 'inlineStr':
            return ''.join(t.text or '' for t in c.iter(NS + 't'))
        v = c.find(NS + 'v')
        return v.text if v is not None else ''
    return [[val(c) for c in row.findall(NS + 'c')] for row in root.iter(NS + 'row')]


def fotos_existentes():
    """Nombre -> archivo, de los repartos ya descargados."""
    src = open(os.path.join(ROOT, 'actors.js'), encoding='utf-8').read()
    trozo = src.split('ACTOR_PHOTOS')[1]
    return dict(re.findall(r'"([^"]+)":\s*"([^"]+)"', trozo))


def descarga(nombre):
    """Busca la foto en la Wikipedia inglesa. Devuelve el archivo o None."""
    rol = fp.ROLES['actors']
    encontrado = fp.primera_pasada([nombre], ANCHO)
    url, extracto, pagina = encontrado.get(nombre, (None, '', None))
    # La identidad se valida siempre, no sólo cuando falta la foto: hay
    # homónimos con artículo e imagen que se colarían sin decir nada.
    if not (url and rol['valida'].search(extracto or '')):
        url, extracto, pagina = fp.desambigua(nombre, ANCHO, rol)
    if not url:
        return None
    destino = os.path.join(CARPETA, fp.slug(nombre) + os.path.splitext(url.split('?')[0])[1])
    if not fp.download(url, destino):
        return None
    return fp.normaliza(destino, ANCHO)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--refresh', action='store_true')
    args = ap.parse_args()

    datos = [f for f in filas() if len(f) >= 5 and f[0].isdigit()]
    print(f'{len(datos)} actores en el Excel', file=sys.stderr)
    ya = fotos_existentes()

    salida, sin_foto = [], []
    for f in datos:
        puesto, nombre, pelis = int(f[0]), f[1].strip(), int(f[4])
        archivo = None if args.refresh else ya.get(nombre)
        if archivo and not os.path.exists(os.path.join(CARPETA, archivo)):
            archivo = None
        if not archivo:
            archivo = descarga(nombre)
            print(f'  {puesto:2}  {nombre[:28]:<28} -> {archivo or "SIN FOTO"}', file=sys.stderr)
            time.sleep(0.4)
        if archivo:
            salida.append({'n': nombre, 'p': pelis, 'f': archivo})
        else:
            sin_foto.append(nombre)

    # Ninguna cifra puede quedar suelta sin que se sepa: el generador de rondas
    # descarta los empates, pero conviene saber cuántos hay.
    from collections import Counter
    empates = {k: v for k, v in Counter(a['p'] for a in salida).items() if v > 1}

    with open(os.path.join(ROOT, 'actores.js'), 'w', encoding='utf-8') as out:
        out.write('// Los 50 actores con más películas rodadas.\n')
        out.write('// Generado por tools/build-actores.py desde\n')
        out.write('// top_50_actores_numero_peliculas.xlsx — no editar a mano.\n')
        out.write('// n: nombre · p: nº de películas · f: archivo en actors/\n')
        out.write('const ACTORES_TOP = [\n')
        for a in sorted(salida, key=lambda x: -x['p']):
            out.write(f'  {{ n: "{a["n"]}", p: {a["p"]}, f: "{a["f"]}" }},\n')
        out.write('];\n')

    print(f'\nactores.js con {len(salida)} actores · sin foto: {len(sin_foto)}', file=sys.stderr)
    for n in sin_foto:
        print(f'   - {n}', file=sys.stderr)
    print(f'cifras repetidas (empates que el juego tendrá que esquivar): {empates}',
          file=sys.stderr)


if __name__ == '__main__':
    main()
