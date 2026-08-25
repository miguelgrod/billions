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
HOJA_BASE = 'Top 100 Worldwide'
HOJA_AMPLIADA = 'Listado completo'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def archivo_de_hoja(z, nombre):
    """Localiza la hoja por su nombre, no por el orden de los archivos.

    Dentro del .xlsx, sheet1.xml no tiene por qué ser la primera pestaña: la
    correspondencia vive en workbook.xml.rels. Si se reordenan las pestañas en
    Excel, leer 'sheet3.xml' a ciegas cogería otra hoja sin avisar.
    """
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    destino = {r.get('Id'): r.get('Target').lstrip('/').replace('xl/', '', 1)
               for r in rels}
    for hoja in wb.findall('.//m:sheet', ns):
        if hoja.get('name') == nombre:
            rid = hoja.get('{%s}id' % ns['r'])
            return destino[rid]
    disponibles = [h.get('name') for h in wb.findall('.//m:sheet', ns)]
    raise SystemExit(f'No encuentro la hoja «{nombre}». Hay: {disponibles}')


def rows(xlsx, hoja):
    z = zipfile.ZipFile(xlsx)
    root = ET.fromstring(z.read('xl/' + archivo_de_hoja(z, hoja)))
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


# La columna de compositor no siempre trae una composición original: a veces es
# una recopilación ('Varios'), una adaptación de música ajena (Joplin en The
# Sting, Mozart en Amadeus) o una aportación parcial. De ninguna de ésas se puede
# preguntar «¿compuso X la banda sonora de Y?» y esperar una respuesta
# inequívoca, así que esas películas se quedan sin ronda de banda sonora.
AMBIGUA = re.compile(r'varios|adapt|dir\. musical|parcial|selecci[oó]n|supervisi[oó]n', re.I)


def compositores(celda):
    """'Nino Rota & Carmine Coppola' -> ['Nino Rota', 'Carmine Coppola'].

    El paréntesis que queda es el seudónimo ('Abigail Mead (Vivian Kubrick)') y
    sobra: se pregunta por el nombre con el que firma la banda sonora.
    """
    texto = (celda or '').strip()
    if not texto or texto in ('—', '-', 'N/D') or AMBIGUA.search(texto):
        return []
    texto = re.sub(r'\s*\([^)]*\)', '', texto).strip()
    # Un nombre de una sola palabra es legítimo aquí (Vangelis), y 'Varios' ya
    # lo ha descartado AMBIGUA antes de llegar.
    nombres = []
    for parte in re.split(r'\s*/\s*', texto):
        for n in split_people(parte):
            if n not in nombres:
                nombres.append(n)
    return nombres


def categorias_oscar(celda):
    """'Mejor Actor de Reparto (Heath Ledger)' -> 'Mejor Actor de Reparto'.

    El nombre entre paréntesis sobra para preguntar por la categoría, y además
    impediría reconocer que dos películas ganaron la misma.
    """
    texto = (celda or '').strip()
    if not texto or texto in ('—', '-', 'N/D'):
        return []
    fuera = []
    for c in texto.split(','):
        c = re.sub(r'\s*\([^)]*\)', '', c).strip()
        if c and c not in fuera:
            fuera.append(c)
    return fuera


def main():
    """El catálogo son las 189 del listado completo.

    Las que ya estaban conservan su número de la lista de taquilla, porque las
    carátulas se guardan con ese número; las nuevas se numeran a partir de 101.
    """
    base = rows(BASE, HOJA_BASE)
    extra = {int(f['G']): f for f in rows(AMPLIADO, HOJA_AMPLIADA) if f.get('G', '').isdigit()}
    print(f'hojas: «{HOJA_BASE}» ({len(base)} filas) y «{HOJA_AMPLIADA}» '
          f'({len(extra)} con recaudación)', file=sys.stderr)

    por_recaudacion = {int(f['C']): int(f['A']) for f in base}   # recaudación -> nº
    completo = rows(AMPLIADO, HOJA_AMPLIADA)
    siguiente = 101

    peliculas = []
    sin_extra = []
    for amp in completo:
        try:
            g = int(amp['G'])
        except (KeyError, ValueError):
            g = None                      # sin taquilla, pero sirve para el resto
        num = por_recaudacion.get(g) if g is not None else None
        if num is None:
            num, siguiente = siguiente, siguiente + 1
        m = {'r': num, 't': amp['B'], 'y': int(amp['C'])}
        if g is not None:
            m['g'] = g
        if True:
            m['o'] = int(amp['F']) if amp.get('F', '').isdigit() else 0
            m['d'] = split_people(amp.get('D', ''))
            m['a'] = [amp.get(c, '').strip() for c in 'HIJKL' if amp.get(c, '').strip()]
            nota = amp.get('E', '').strip()
            try:
                m['fa'] = round(float(nota), 1)      # el Excel trae ruido decimal
            except ValueError:
                pass                                  # 'N/D' en los estrenos recientes
            m['oc'] = categorias_oscar(amp.get('N', ''))
            m['bso'] = compositores(amp.get('O', ''))
        peliculas.append(m)

    ya = {m.get('g') for m in peliculas}
    for f in base:
        g = int(f['C'])
        if g not in ya:
            peliculas.append({'r': int(f['A']), 't': f['B'], 'g': g, 'y': int(f['G'])})
            sin_extra.append(f['B'])

    peliculas.sort(key=lambda m: -(m.get('g') or 0))
    # Los identificadores sí tienen que ser únicos: con ellos se nombran las
    # carátulas y se lleva la cuenta de lo ya preguntado. Las recaudaciones, en
    # cambio, se repiten en las películas antiguas (cifras redondeadas), y de
    # que eso no genere un duelo empatado se encarga el propio juego.
    assert len({m['r'] for m in peliculas}) == len(peliculas), 'identificadores repetidos'

    def dump(m):
        campos = [f"r: {m['r']}", f"t: {json.dumps(m['t'], ensure_ascii=False)}"]
        if 'g' in m:
            campos.append(f"g: {m['g']}")
        campos.append(f"y: {m['y']}")
        if 'o' in m:
            campos.append(f"o: {m['o']}")
            if 'fa' in m:
                campos.append(f"fa: {m['fa']}")
            campos.append('d: [' + ', '.join(json.dumps(n, ensure_ascii=False) for n in m['d']) + ']')
            campos.append('a: [' + ', '.join(json.dumps(n, ensure_ascii=False) for n in m['a']) + ']')
            if m.get('oc'):
                campos.append('oc: [' + ', '.join(json.dumps(n, ensure_ascii=False) for n in m['oc']) + ']')
            if m.get('bso'):
                campos.append('bso: [' + ', '.join(json.dumps(n, ensure_ascii=False) for n in m['bso']) + ']')
        return '  { ' + ', '.join(campos) + ' },'

    with open(os.path.join(ROOT, 'movies.js'), 'w', encoding='utf-8') as f:
        f.write('// Top 100 películas por recaudación mundial\n')
        f.write('// Generado por tools/build-data.py · no editar a mano\n')
        f.write('// Taquilla y año: The Numbers · Director, reparto y Óscars: Filmaffinity\n')
        f.write('// r = identificador (y nombre de su carátula) · t = título\n')
        f.write('// g = recaudación (puede faltar) · y = año\n')
        f.write('// o = Óscars ganados · d = director(es) · a = reparto principal\n')
        f.write('// fa = nota de FilmAffinity · oc = categorías de Óscar ganadas\n')
        f.write('// bso = compositor(es) de la banda sonora\n')
        f.write('// Sin o/d/a: la película no está en el Excel ampliado\n')
        f.write('const MOVIES = [\n')
        for m in peliculas:
            f.write(dump(m) + '\n')
        f.write('];\n')

    con = sum(1 for m in peliculas if 'o' in m)
    nuevas = sum(1 for m in peliculas if m['r'] > 100)
    print(f'{len(peliculas)} películas · con director/reparto/Óscars: {con} · '
          f'nuevas respecto al top de taquilla: {nuevas}', file=sys.stderr)
    for t in sin_extra:
        print(f'   sólo con datos de taquilla: {t}', file=sys.stderr)


if __name__ == '__main__':
    main()
