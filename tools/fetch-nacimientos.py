#!/usr/bin/env python3
"""Descarga los años de nacimiento y muerte de la gente del juego.

Sirve para que las preguntas de reparto no enfrenten a un actor de los años
cincuenta con uno de hoy: con la edad a mano, el generador puede exigir que los
dos sean de una quinta parecida.

La fuente es **Wikidata** (P569 nacimiento, P570 muerte), no el texto del
artículo: vienen como dato y no hay que adivinarlos de una frase. Se entra por el
título del artículo inglés, que es el que ya resolvió tools/fetch-people.py — los
que necesitaron desambiguación están en `*/_report.json` bajo `via_indirecta`.

La fecha de muerte no es un adorno: es lo que permite destapar homónimos. Si
alguien figura en una película rodada después de morir, la foto y la identidad
son de otra persona. Así se habría cazado a Steve McQueen —el actor murió en
1980 y el juego lo daba como director de una película de 2013— sin tener que
esperar a que se notara a simple vista.

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
    """Todo el que sale en el juego: repartos, top 50 y directores."""
    src = open(os.path.join(ROOT, 'actors.js'), encoding='utf-8').read()
    gente = set(re.findall(r'"([^"]+)":\s*"[^"]+\.jpg"', src.split('ACTOR_PHOTOS')[1]))
    dsrc = open(os.path.join(ROOT, 'directors.js'), encoding='utf-8').read()
    gente |= set(re.findall(r'"([^"]+)":\s*"[^"]+\.jpg"', dsrc.split('DIRECTOR_PHOTOS')[1]))
    p = os.path.join(ROOT, 'actores.js')
    if os.path.exists(p):
        gente |= set(re.findall(r'n: "([^"]+)"', open(p, encoding='utf-8').read()))
    return sorted(gente)


def titulos(gente):
    """Nombre -> título del artículo inglés."""
    indirecta = {}
    for carpeta in ('actors', 'directors'):
        p = os.path.join(ROOT, carpeta, '_report.json')
        if os.path.exists(p):
            indirecta.update((json.load(open(p, encoding='utf-8')) or {}).get('via_indirecta') or {})
    return {n: indirecta.get(n, n) for n in gente}


def anio_de(entidad, prop='P569'):
    """P569/P570 -> año. Wikidata las da como +1969-10-09T00:00:00Z."""
    for c in (entidad.get('claims') or {}).get(prop, []):
        valor = ((c.get('mainsnak') or {}).get('datavalue') or {}).get('value') or {}
        t = valor.get('time') or ''
        m = re.match(r'([+-])(\d{4})', t)
        if m:
            anio = int(m.group(2))
            if m.group(1) == '-':
                continue                       # antes de Cristo: no es nuestro caso
            if 1850 <= anio <= 2030:
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

    anios, muertes, sin = {}, {}, []
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
            a, d = anio_de(ent), anio_de(ent, 'P570')
            if titulo and a:
                for n in por_titulo.get(titulo, []):
                    anios[n] = a
                    if d:
                        muertes[n] = d
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
                a, d = anio_de(ent), anio_de(ent, 'P570')
                if a:
                    for n in qids.get(qid, []):
                        anios[n] = a
                        if d:
                            muertes[n] = d
            time.sleep(0.3)

    sin = [n for n in gente if n not in anios]
    with open(os.path.join(ROOT, 'nacimientos.js'), 'w', encoding='utf-8') as f:
        f.write('// Años de nacimiento y muerte de la gente del juego, de Wikidata\n')
        f.write('// (P569 y P570). Generado por tools/fetch-nacimientos.py —\n')
        f.write('// no editar a mano.\n')
        f.write('const NACIMIENTOS = {\n')
        for n in sorted(anios):
            f.write(f'  "{n}": {anios[n]},\n')
        f.write('};\n\n')
        f.write('// Sólo los que ya han fallecido. Sirve para destapar homónimos:\n')
        f.write('// nadie rueda una película después de morirse.\n')
        f.write('const FALLECIDOS = {\n')
        for n in sorted(muertes):
            f.write(f'  "{n}": {muertes[n]},\n')
        f.write('};\n')

    print(f'\nnacimientos.js con {len(anios)} de {len(gente)} · fallecidos: {len(muertes)}'
          f' · sin fecha: {len(sin)}', file=sys.stderr)
    for n in sin[:40]:
        print(f'   - {n}', file=sys.stderr)
    if len(sin) > 40:
        print(f'   … y {len(sin) - 40} más', file=sys.stderr)


if __name__ == '__main__':
    main()
