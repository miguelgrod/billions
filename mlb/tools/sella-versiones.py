#!/usr/bin/env python3
"""Sella los <script src> de index.html con la huella de cada archivo.

Sin esto, un navegador que se guardó `data/mlb-data.js` sigue usándolo aunque
los datos hayan cambiado. Aquí importa más que en ningún sitio: el despliegue
sirve todo lo que no es HTML con un año de caché y marcado `immutable`, así que
sin huella en la URL un jugador podría estar semanas con el catálogo viejo. Con la huella en la URL, cada cambio de contenido es una URL
distinta y el navegador la pide de nuevo.

Es idempotente: se puede lanzar tantas veces como se quiera, y sólo toca lo que
haya cambiado. Hay que pasarlo **antes de desplegar** siempre que se regeneren
los datos con build-data.py.

  python3 tools/sella-versiones.py
"""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Todas las páginas, no sólo el juego: privacy.html también carga Tailwind, y
# se sirve con la misma caché de un año.
PAGINAS = [a for a in sorted(os.listdir(ROOT)) if a.endswith('.html')]


def huella(ruta):
    with open(ruta, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def main():
    cambios = []
    for pagina in PAGINAS:
        sella_pagina(os.path.join(ROOT, pagina), cambios)
    print(f'{len(cambios)} etiquetas actualizadas', file=sys.stderr)
    for a, v in cambios:
        print(f'   {a} -> ?v={v}', file=sys.stderr)


def sella_pagina(ruta, cambios):
    src = open(ruta, encoding='utf-8').read()

    def sella(m):
        etiqueta, archivo = m.group(0), m.group(1)
        ruta = os.path.join(ROOT, archivo)
        if not os.path.exists(ruta):
            return etiqueta                       # externo (el CDN de Tailwind)
        v = huella(ruta)
        nuevo = re.sub(r'src="[^"]+"', f'src="{archivo}?v={v}"', etiqueta)
        if nuevo != etiqueta:
            cambios.append((archivo, v))
        return nuevo

    # sólo los locales: el src del CDN lleva https:// y no existe en disco
    salida = re.sub(r'<script src="([^"?]+)(?:\?v=[0-9a-f]+)?"[^>]*></script>', sella, src)
    if salida != src:
        open(ruta, 'w', encoding='utf-8').write(salida)


if __name__ == '__main__':
    main()
