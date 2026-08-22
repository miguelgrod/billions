#!/usr/bin/env python3
"""Regenera movies.js añadiendo director, reparto y Óscars.

La base sigue siendo el top 100 de taquilla (`top_100_...xlsx`, que fija los
puestos y por tanto los nombres de las carátulas). Los campos nuevos vienen del
Excel ampliado, cruzando por recaudación: los títulos de un archivo a otro no
coinciden (uno abrevia), pero la recaudación es un número exacto y único.

  python3 tools/build-data.py
"""
import json, os, re, sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'top_100_peliculas_recaudacion_mundial.xlsx')
AMPLIADO = os.path.join(ROOT, 'top_peliculas_taquilla_y_critica.xlsx')
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def rows(xlsx, sheet):
    z = zipfile.ZipFile(xlsx)
    root = ET.fromstring(z.read(f'xl/worksheets/{sheet}'))
    out = []
    for row in root.findall('.//m:row', NS):
        c = {}
        for cell in row.findall('m:c', NS):
            ref = re.match(r'([A-Z]+)', cell.get('r')).group(1)
            t = cell.find('.//m:t', NS)
            v = cell.find('m:v', NS)
            c[ref] = t.text if t is not None else (v.text if v is not None else '')
        if c.get('A', '').isdigit():
            out.append(c)
    return out


def split_people(celda):
    """'Anthony & Joe Russo' -> ['Anthony Russo', 'Joe Russo']."""
    partes = [p.strip() for p in re.split(r'\s*&\s*|\s+y\s+', celda or '') if p.strip()]
    if len(partes) < 2:
        return partes
    apellido = partes[-1].split()[-1]
    return [p if len(p.split()) > 1 else f'{p} {apellido}' for p in partes]


def main():
    base = rows(BASE, 'sheet1.xml')
    extra = {int(f['G']): f for f in rows(AMPLIADO, 'sheet3.xml') if f.get('G', '').isdigit()}

    peliculas = []
    sin_extra = []
    for f in base:
        g = int(f['C'])
        m = {'r': int(f['A']), 't': f['B'], 'g': g, 'y': int(f['G'])}
        amp = extra.get(g)
        if amp:
            m['o'] = int(amp['F']) if amp.get('F', '').isdigit() else 0
            m['d'] = split_people(amp.get('D', ''))
            m['a'] = [amp.get(c, '').strip() for c in 'HIJKL' if amp.get(c, '').strip()]
        else:
            sin_extra.append(f['B'])
        peliculas.append(m)

    peliculas.sort(key=lambda m: -m['g'])
    assert len({m['g'] for m in peliculas}) == len(peliculas), 'recaudaciones repetidas'

    def dump(m):
        campos = [f"r: {m['r']}", f"t: {json.dumps(m['t'], ensure_ascii=False)}",
                  f"g: {m['g']}", f"y: {m['y']}"]
        if 'o' in m:
            campos.append(f"o: {m['o']}")
            campos.append('d: [' + ', '.join(json.dumps(n, ensure_ascii=False) for n in m['d']) + ']')
            campos.append('a: [' + ', '.join(json.dumps(n, ensure_ascii=False) for n in m['a']) + ']')
        return '  { ' + ', '.join(campos) + ' },'

    with open(os.path.join(ROOT, 'movies.js'), 'w', encoding='utf-8') as f:
        f.write('// Top 100 películas por recaudación mundial\n')
        f.write('// Generado por tools/build-data.py · no editar a mano\n')
        f.write('// Taquilla y año: The Numbers · Director, reparto y Óscars: Filmaffinity\n')
        f.write('// r = puesto · t = título · g = recaudación · y = año\n')
        f.write('// o = Óscars ganados · d = director(es) · a = reparto principal\n')
        f.write('// Sin o/d/a: la película no está en el Excel ampliado\n')
        f.write('const MOVIES = [\n')
        for m in peliculas:
            f.write(dump(m) + '\n')
        f.write('];\n')

    con = sum(1 for m in peliculas if 'o' in m)
    print(f'{len(peliculas)} películas · con director/reparto/Óscars: {con}', file=sys.stderr)
    for t in sin_extra:
        print(f'   sin datos ampliados: {t}', file=sys.stderr)


if __name__ == '__main__':
    main()
