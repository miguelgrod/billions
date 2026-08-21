#!/usr/bin/env python3
"""Descarga las carátulas de las películas de movies.js a posters/.

  python3 tools/fetch-posters.py                    # fuente: Wikipedia (sin clave)
  python3 tools/fetch-posters.py --source tmdb --key TU_CLAVE

Genera posters/<puesto>.jpg y el índice posters.js.
"""
import argparse, json, os, re, sys, time, urllib.parse, urllib.request

UA = 'BillionsQuiz/1.0 (juego personal; bonitu@garciarodriguez.net)'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIKI = 'https://en.wikipedia.org/w/api.php?'


def get(url, raw=False, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                return data if raw else json.loads(data.decode())
        except Exception as e:
            if attempt == 2:
                print(f'   ! {e}', file=sys.stderr)
                return None
            time.sleep(1.5)


def wiki(params):
    return get(WIKI + urllib.parse.urlencode(params))


def load_movies():
    src = open(os.path.join(ROOT, 'movies.js'), encoding='utf-8').read()
    rows = re.findall(r'\{ r: (\d+), t: "((?:[^"\\]|\\.)*)", g: (\d+), y: (\d+) \}', src)
    return [{'r': int(r), 't': t, 'g': int(g), 'y': int(y)} for r, t, g, y in rows]


# ---------------------------------------------------------------- Wikipedia

def clean_title(m):
    """El título del Excel no siempre es el de Wikipedia."""
    t = re.sub(r'\s*Ep\. [IVX]+:', ':', m['t'])          # Star Wars Ep. VII: -> Star Wars:
    t = re.sub(r'\s*\((19|20)\d\d\)$', '', t)            # Aladdin (2019) -> Aladdin
    t = t.replace("Sorcerer's Stone", "Philosopher's Stone")
    t = re.sub(r'\bVol (\d)', r'Vol. \1', t)
    return re.sub(r'\s+', ' ', t).strip()


def infobox_image(wikitext):
    """Saca el parámetro image= del Infobox film."""
    if 'nfobox film' not in wikitext:
        return None
    m = re.search(r'\|\s*image\s*=\s*([^\n|<}]+)', wikitext)
    if not m:
        return None
    name = m.group(1).strip().strip('[]')
    name = re.sub(r'^(File|Image):', '', name, flags=re.I).split('|')[0].strip()
    return name if re.search(r'\.(jpe?g|png|gif|webp)$', name, re.I) else None


def wiki_candidates(m):
    t = clean_title(m)
    yield f'{t} ({m["y"]} film)'
    yield f'{t} (film)'
    yield t
    res = wiki({'action': 'query', 'format': 'json', 'formatversion': '2', 'list': 'search',
                'srsearch': f'{t} {m["y"]} film', 'srlimit': '5'})
    for hit in ((res or {}).get('query') or {}).get('search', []):
        yield hit['title']


def wiki_poster_file(m):
    seen = set()
    for cand in wiki_candidates(m):
        if cand in seen:
            continue
        seen.add(cand)
        res = wiki({'action': 'parse', 'format': 'json', 'formatversion': '2',
                    'page': cand, 'prop': 'wikitext', 'section': '0', 'redirects': '1'})
        if not res or 'error' in res:
            continue
        text = (res.get('parse') or {}).get('wikitext', '')
        img = infobox_image(text)
        if img:
            return res['parse']['title'], img
    return None, None


def norm_file(name):
    """MediaWiki normaliza: guiones bajos -> espacios, inicial en mayúscula."""
    n = name.replace('_', ' ').strip()
    return n[:1].upper() + n[1:]


def wiki_thumb_urls(files, width):
    """File:X -> URL de miniatura, en lotes de 50."""
    urls = {}
    names = list(files)
    for i in range(0, len(names), 50):
        chunk = names[i:i + 50]
        res = wiki({'action': 'query', 'format': 'json', 'formatversion': '2',
                    'titles': '|'.join('File:' + n for n in chunk),
                    'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': str(width)})
        for p in ((res or {}).get('query') or {}).get('pages', []):
            info = (p.get('imageinfo') or [{}])[0]
            url = info.get('thumburl') or info.get('url')
            if url:
                urls[norm_file(re.sub(r'^File:', '', p['title']))] = url
        time.sleep(0.15)
    return urls


def collect_wikipedia(movies, width):
    found = {}
    files = {}
    for i, m in enumerate(movies, 1):
        page, img = wiki_poster_file(m)
        print(f'{i:3}/{len(movies)}  {m["t"][:36]:38} -> {img or "SIN PÓSTER"}', file=sys.stderr)
        if img:
            files[img] = m['r']
        found[m['r']] = {'page': page, 'file': img}
        time.sleep(0.1)
    urls = wiki_thumb_urls(files, width)
    for name, rank in files.items():
        found[rank]['url'] = urls.get(norm_file(name))
    return found


# --------------------------------------------------------------------- TMDB

def collect_tmdb(movies, key, width):
    found = {}
    for i, m in enumerate(movies, 1):
        q = urllib.parse.urlencode({'api_key': key, 'query': clean_title(m),
                                    'primary_release_year': m['y']})
        res = get(f'https://api.themoviedb.org/3/search/movie?{q}')
        hits = (res or {}).get('results') or []
        if not hits:  # reintenta sin año
            q = urllib.parse.urlencode({'api_key': key, 'query': clean_title(m)})
            res = get(f'https://api.themoviedb.org/3/search/movie?{q}')
            hits = (res or {}).get('results') or []
        path = next((h['poster_path'] for h in hits if h.get('poster_path')), None)
        print(f'{i:3}/{len(movies)}  {m["t"][:36]:38} -> {path or "SIN PÓSTER"}', file=sys.stderr)
        found[m['r']] = {'page': hits[0]['title'] if hits else None,
                         'file': path,
                         'url': f'https://image.tmdb.org/t/p/w{width}{path}' if path else None}
        time.sleep(0.06)
    return found


# --------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', choices=['wikipedia', 'tmdb'], default='wikipedia')
    ap.add_argument('--key', help='clave de API de TMDB (v3)')
    ap.add_argument('--width', type=int, default=400)
    ap.add_argument('--refresh', action='store_true',
                    help='vuelve a resolver las páginas en vez de usar posters/_report.json')
    args = ap.parse_args()
    if args.source == 'tmdb' and not args.key:
        ap.error('--source tmdb necesita --key')

    movies = load_movies()
    print(f'{len(movies)} películas · fuente: {args.source}\n', file=sys.stderr)
    width = args.width if args.source == 'wikipedia' else 342
    cache = os.path.join(ROOT, 'posters', '_report.json')
    if os.path.exists(cache) and not args.refresh:
        print('(reutilizando posters/_report.json; usa --refresh para volver a resolver)\n',
              file=sys.stderr)
        found = {int(k): v for k, v in json.load(open(cache, encoding='utf-8')).items()}
    else:
        found = (collect_tmdb(movies, args.key, width) if args.source == 'tmdb'
                 else collect_wikipedia(movies, width))

    outdir = os.path.join(ROOT, 'posters')
    os.makedirs(outdir, exist_ok=True)
    index, missing = {}, []
    print('\nDescargando…', file=sys.stderr)
    for m in movies:
        info = found.get(m['r']) or {}
        url = info.get('url')
        if not url:
            missing.append(m['t'])
            continue
        ext = '.png' if url.lower().split('?')[0].endswith('.png') else '.jpg'
        name = f'{m["r"]:03d}{ext}'
        dest = os.path.join(outdir, name)
        if not os.path.exists(dest):
            data = get(url, raw=True)
            if not data:
                time.sleep(5)              # probablemente un 429: espera y reintenta
                data = get(url, raw=True)
            if not data:
                missing.append(m['t'])
                continue
            open(dest, 'wb').write(data)
            time.sleep(0.25)
        index[m['r']] = name

    with open(os.path.join(ROOT, 'posters.js'), 'w', encoding='utf-8') as f:
        f.write('// Carátulas por puesto -> archivo en posters/\n')
        f.write(f'// Generado por tools/fetch-posters.py --source {args.source}\n')
        f.write('const POSTERS = {\n')
        for r in sorted(index):
            f.write(f'  {r}: "{index[r]}",\n')
        f.write('};\n')

    print(f'\n{len(index)} carátulas en posters/ · sin imagen: {len(missing)}', file=sys.stderr)
    for t in missing:
        print(f'   - {t}', file=sys.stderr)
    json.dump(found, open(os.path.join(outdir, '_report.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
