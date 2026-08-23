#!/usr/bin/env python3
"""Sella los <script src> de index.html con la huella de cada archivo.

Sin esto, un navegador que se guardó `actores.js` sigue usándolo aunque los
datos hayan cambiado: los archivos se sirven sin `Cache-Control` y las etiquetas
no llevan versión, así que actualizar el Excel no se notaba en un navegador que
ya hubiera entrado. Con la huella en la URL, cada cambio de contenido es una URL
distinta y el navegador la pide de nuevo.

Es idempotente: se puede lanzar tantas veces como se quiera, y sólo toca lo que
haya cambiado. Hay que pasarlo **antes de desplegar** siempre que se toque un
archivo de datos.

  python3 tools/sella-versiones.py
"""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')


def huella(ruta):
    with open(ruta, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def main():
    src = open(INDEX, encoding='utf-8').read()
    cambios = []

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
        open(INDEX, 'w', encoding='utf-8').write(salida)
    print(f'{len(cambios)} etiquetas actualizadas', file=sys.stderr)
    for a, v in cambios:
        print(f'   {a} -> ?v={v}', file=sys.stderr)


if __name__ == '__main__':
    main()
