#!/usr/bin/env python3
"""Genera actores.js a partir de top_50_actores_numero_peliculas.xlsx.

Los actores con más películas rodadas (39 en la revisión de agosto de 2026;
el archivo conserva el nombre "top_50" de cuando eran cincuenta). La foto es requisito: quien no
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
CARPETA = os.path.join(ROOT, 'actors')
# La hoja ya se ha llamado de dos maneras ('Top 50 Actores' y 'Top Actores - Nº
# Películas'), así que no se busca por nombre sino por la fila de cabecera. Si
# cambia el nombre otra vez, esto sigue funcionando.
CABECERA = ('Actor/Actriz', 'Nº películas')

# Qué margen de error se le concede a cada cifra, según lo que declare el propio
# Excel. Los provisionales salen de fuentes que pueden mezclar créditos de cine y
# televisión, así que su número puede estar bastante inflado.
TOLERANCIA = {'verificado': 3, 'estimado': 8, 'provisional': 15}
ANCHO = 300                      # el mismo que el resto de fotos de actores
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def filas():
    z = zipfile.ZipFile(XLSX)

    def val(c):
        if c.get('t') == 'inlineStr':
            return ''.join(t.text or '' for t in c.iter(NS + 't'))
        v = c.find(NS + 'v')
        return v.text if v is not None else ''

    for hoja in sorted(n for n in z.namelist() if n.startswith('xl/worksheets/sheet')):
        root = ET.fromstring(z.read(hoja))
        datos = [[val(c) for c in row.findall(NS + 'c')] for row in root.iter(NS + 'row')]
        for i, f in enumerate(datos):
            if all(any(col == c for col in f) for c in CABECERA):
                return datos[i:]
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    raise SystemExit('Ninguna hoja tiene la cabecera ' + str(CABECERA) +
                     '. Hay: ' + str([s.get('name') for s in wb.iter(NS + 'sheet')]))


def columnas(cabecera):
    """Dónde está cada columna: el Excel ya ha cambiado de forma una vez."""
    idx = {}
    for i, c in enumerate(cabecera):
        c = (c or '').strip().lower()
        if c.startswith('actor'):        idx['nombre'] = i
        elif c.startswith('nº pel'):     idx['pelis'] = i
        elif c.startswith('año nac'):    idx['nacido'] = i
        elif c.startswith('fiabilidad'): idx['fiabilidad'] = i
    for k in ('nombre', 'pelis'):
        if k not in idx:
            raise SystemExit(f'Falta la columna «{k}» en {cabecera}')
    return idx


def fiabilidad(txt):
    t = (txt or '').lower()
    for clave in TOLERANCIA:
        if clave in t:
            return clave
    return 'provisional'          # si no lo dice, se supone lo peor


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

    hoja = filas()
    col = columnas(hoja[0])
    datos = [f for f in hoja[1:] if f and f[0].isdigit() and len(f) > col['pelis']]
    print(f'{len(datos)} actores en el Excel', file=sys.stderr)
    ya = fotos_existentes()

    salida, sin_foto = [], []
    for f in datos:
        puesto, nombre = int(f[0]), f[col['nombre']].strip()
        pelis = int(f[col['pelis']])
        fia = fiabilidad(f[col['fiabilidad']] if 'fiabilidad' in col
                         and len(f) > col['fiabilidad'] else '')
        archivo = None if args.refresh else ya.get(nombre)
        if archivo and not os.path.exists(os.path.join(CARPETA, archivo)):
            archivo = None
        if not archivo:
            archivo = descarga(nombre)
            print(f'  {puesto:2}  {nombre[:28]:<28} -> {archivo or "SIN FOTO"}', file=sys.stderr)
            time.sleep(0.4)
        if archivo:
            salida.append({'n': nombre, 'p': pelis, 'f': archivo,
                           'tol': TOLERANCIA[fia], 'fia': fia})
        else:
            sin_foto.append(nombre)

    # Ninguna cifra puede quedar suelta sin que se sepa: el generador de rondas
    # descarta los empates, pero conviene saber cuántos hay.
    from collections import Counter
    empates = {k: v for k, v in Counter(a['p'] for a in salida).items() if v > 1}
    print(f'fiabilidad: ' + str(dict(Counter(a['fia'] for a in salida))), file=sys.stderr)

    with open(os.path.join(ROOT, 'actores.js'), 'w', encoding='utf-8') as out:
        out.write(f'// Los {len(salida)} actores con más películas rodadas.\n')
        out.write('// Generado por tools/build-actores.py desde\n')
        out.write('// top_50_actores_numero_peliculas.xlsx — no editar a mano.\n')
        out.write('// n: nombre · p: nº de películas · f: archivo en actors/\n')
        out.write('// tol: margen de error en películas, según la fiabilidad que\n')
        out.write('//      declara el propio Excel (verificado 3, estimado 8,\n')
        out.write('//      provisional 15: esas fuentes mezclan cine y televisión)\n')
        out.write('const ACTORES_TOP = [\n')
        for a in sorted(salida, key=lambda x: -x['p']):
            out.write(f'  {{ n: "{a["n"]}", p: {a["p"]}, tol: {a["tol"]}, '
                      f'f: "{a["f"]}" }},   // {a["fia"]}\n')
        out.write('];\n')

    print(f'\nactores.js con {len(salida)} actores · sin foto: {len(sin_foto)}', file=sys.stderr)
    for n in sin_foto:
        print(f'   - {n}', file=sys.stderr)
    print(f'cifras repetidas (empates que el juego tendrá que esquivar): {empates}',
          file=sys.stderr)


if __name__ == '__main__':
    main()
