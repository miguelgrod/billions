#!/usr/bin/env python3
"""Descarga las carátulas que falten en posters/, sin tocar las ya guardadas.

Se apoya en tools/fetch-posters.py para la resolución (Wikipedia en español y
en inglés, validando el año y descartando páginas de saga).

  python3 tools/fetch-nuevas.py
"""
import importlib.util, json, os, re, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('fp', os.path.join(ROOT, 'tools', 'fetch-posters.py'))
fp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fp)

movies = re.findall(r'\{ r: (\d+), t: "((?:[^"\\]|\\.)*)"(?:, g: \d+)?, y: (\d+)',
                    open(os.path.join(ROOT, 'movies.js'), encoding='utf-8').read())
existentes = {int(f[:3]) for f in os.listdir(os.path.join(ROOT, 'posters')) if f.endswith('.jpg')}
faltan = [(int(r), t, int(y)) for r, t, y in movies if int(r) not in existentes]
print(f'{len(movies)} películas · ya con carátula: {len(existentes)} · faltan: {len(faltan)}',
      file=sys.stderr)

informe = {}
p_inf = os.path.join(ROOT, 'posters', '_nuevas.json')
if os.path.exists(p_inf):
    informe = json.load(open(p_inf, encoding='utf-8'))

for n, (r, t, y) in enumerate(faltan, 1):
    if str(r) in informe and informe[str(r)].get('url'):
        continue
    pagina = archivo = idioma = None
    for lang in fp.WIKIS:
        pagina, archivo = fp.busca_en_wiki(lang, t, y)
        if archivo:
            idioma = lang
            break
        time.sleep(0.15)
    url = None
    if archivo:
        res = fp.wiki({'action': 'query', 'format': 'json', 'formatversion': '2',
                       'titles': 'File:' + archivo, 'prop': 'imageinfo',
                       'iiprop': 'url', 'iiurlwidth': '400'}, idioma)
        for p in ((res or {}).get('query') or {}).get('pages', []):
            info = (p.get('imageinfo') or [{}])[0]
            url = info.get('thumburl') or info.get('url')
    informe[str(r)] = {'titulo': t, 'anio': y, 'wiki': idioma, 'pagina': pagina,
                       'archivo': archivo, 'url': url}
    print(f'{n:3}/{len(faltan)}  {t[:34]:36} -> {(idioma or "?") + ":" + (pagina or "SIN CARÁTULA")}',
          file=sys.stderr)
    json.dump(informe, open(p_inf, 'w'), ensure_ascii=False, indent=1)
    time.sleep(0.2)

print('\nDescargando…', file=sys.stderr)
bajadas = 0
for r, t, y in faltan:
    d = informe.get(str(r)) or {}
    if not d.get('url'):
        continue
    destino = os.path.join(ROOT, 'posters', f'{r:03d}.jpg')
    if os.path.exists(destino):
        continue
    datos = fp.get(d['url'], raw=True)
    if not datos:
        time.sleep(4)
        datos = fp.get(d['url'], raw=True)
    if not datos:
        continue
    tmp = destino + '.tmp'
    open(tmp, 'wb').write(datos)
    fp.normaliza = getattr(fp, 'normaliza', None)
    os.replace(tmp, destino)
    bajadas += 1
    time.sleep(0.25)

sin = [d['titulo'] for d in informe.values() if not d.get('url')]
print(f'{bajadas} carátulas nuevas · sin carátula: {len(sin)}', file=sys.stderr)
for t in sin:
    print(f'   - {t}', file=sys.stderr)
