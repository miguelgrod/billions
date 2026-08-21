#!/usr/bin/env python3
"""Empaqueta el juego en un único HTML autocontenido (para publicar como Artifact).

Incrusta Tailwind, los datos, el JS y las 100 carátulas en base64, porque la
página publicada no puede pedir nada a servidores externos.

  python3 tools/build-artifact.py
"""
import base64, os, re, subprocess, sys, tempfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAILWIND = 'https://cdn.tailwindcss.com/3.4.16'
OUT = os.path.join(ROOT, 'build', 'billions.html')
POSTER_WIDTH, POSTER_QUALITY = 200, 60


def read(name):
    return open(os.path.join(ROOT, name), encoding='utf-8').read()


def tailwind_js(cache):
    if not os.path.exists(cache):
        print('descargando Tailwind…', file=sys.stderr)
        req = urllib.request.Request(TAILWIND, headers={'User-Agent': 'BillionsBuild/1.0'})
        with urllib.request.urlopen(req, timeout=60) as r:
            open(cache, 'wb').write(r.read())
    return open(cache, encoding='utf-8').read()


def posters_data_uris():
    """Reduce cada carátula y la convierte en data: URI."""
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        for name in sorted(os.listdir(os.path.join(ROOT, 'posters'))):
            if not name.endswith('.jpg'):
                continue
            src = os.path.join(ROOT, 'posters', name)
            dst = os.path.join(tmp, name)
            subprocess.run(['sips', '-s', 'format', 'jpeg',
                            '-s', 'formatOptions', str(POSTER_QUALITY),
                            '--resampleWidth', str(POSTER_WIDTH), src, '--out', dst],
                           capture_output=True, check=True)
            b64 = base64.b64encode(open(dst, 'rb').read()).decode()
            out[int(name[:3])] = 'data:image/jpeg;base64,' + b64
    return out


def main():
    html = read('index.html')

    # CSS propio, sin el @import de fuentes (va como <link>)
    style = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
    style = re.sub(r"\s*@import url\([^)]*\);", '', style)

    # contenido del body, sin las etiquetas <script src>
    body = re.search(r'<body[^>]*>(.*?)</body>', html, re.S).group(1)
    body = re.sub(r'\s*<script src="[^"]+" defer></script>', '', body)

    # las clases del <body> original hay que llevarlas a CSS: en el Artifact
    # la etiqueta <body> la pone el envoltorio y no podemos tocarla
    base_css = """
    body {
      min-height: 100vh;
      background: #0a0a0a;   /* neutral-950 */
      color: #f5f5f5;        /* neutral-100 */
      -webkit-font-smoothing: antialiased;
    }
    ::selection { background: #fbbf24; color: #171717; }
"""

    posters = posters_data_uris()
    posters_js = ('const POSTERS = {\n'
                  + ''.join(f'  {r}: "{u}",\n' for r, u in sorted(posters.items()))
                  + '};\n')

    # con las imágenes incrustadas ya no hay carpeta posters/ a la que apuntar
    main_js = read('main.js').replace(
        "typeof POSTERS !== 'undefined' && POSTERS[movie.r] ? 'posters/' + POSTERS[movie.r] : null;",
        "typeof POSTERS !== 'undefined' && POSTERS[movie.r] ? POSTERS[movie.r] : null;")
    assert "'posters/'" not in main_js, 'no se pudo reescribir posterUrl'

    cache = os.path.join(tempfile.gettempdir(), 'tailwind-3.4.16.js')
    parts = [
        '<title>Billions</title>',
        '<link rel="preconnect" href="https://fonts.googleapis.com" />',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
        'family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" />',
        '<style>' + base_css + style + '</style>',
        '<script>' + tailwind_js(cache) + '</script>',
        body.strip(),
        '<script>' + read('movies.js') + '</script>',
        '<script>' + posters_js + '</script>',
        '<script>' + main_js + '</script>',
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write('\n'.join(parts))
    size = os.path.getsize(OUT)
    print(f'{OUT} · {size/1e6:.2f} MB · {len(posters)} carátulas incrustadas', file=sys.stderr)
    if size > 16_000_000:
        sys.exit('¡pasa del límite de 16 MB del Artifact!')


if __name__ == '__main__':
    main()
