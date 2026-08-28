#!/usr/bin/env python3
"""Descarga los retratos de los jugadores del catálogo a `photos/`.

Vienen de img.mlbstatic.com, que es de donde los sirve la propia MLB. Se
alojan aquí porque **el sitio no hace ninguna petición externa**: pedirlas al
vuelo entregaría la IP de cada visitante a MLB Advanced Media. Son fotografías
con copyright, usadas a título ilustrativo y acreditadas en el pie.

Es reanudable: sólo baja lo que falte. Un 404 es que ese jugador no tiene
retrato —le pasa a parte de los del siglo XIX— y se anota para no volver a
pedirlo cada vez.

    python3 tools/fetch-photos.py
    python3 tools/fetch-photos.py --refresh     # rehace lo que ya está
"""

import argparse
import concurrent.futures as futuros
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTOS = os.path.join(RAIZ, 'photos')
DATOS = os.path.join(RAIZ, 'data', 'mlb-data.js')
INFORME = os.path.join(FOTOS, '_report.json')

# 240 px de ancho: las cartas más grandes del juego miden 200 y hay pantallas
# de doble densidad. Pedir más sería tirar megabytes al bucket.
URL = ('https://img.mlbstatic.com/mlb-photos/image/upload/'
       'w_240,q_auto:best/v1/people/{id}/headshot/67/current')

MINIMO = 2000      # menos de 2 KB no es un retrato


def jugadores():
    """Los identificadores y nombres salen del propio archivo de datos, que es
    lo que garantiza que se baja exactamente lo que el juego usa."""
    if not os.path.exists(DATOS):
        sys.exit('No hay data/mlb-data.js. Pasa antes tools/build-data.py.')
    with open(DATOS, encoding='utf-8') as f:
        texto = f.read()
    m = re.search(r'const PLAYERS = (\[.*?\]);\n', texto, re.S)
    if not m:
        sys.exit('No encuentro PLAYERS en data/mlb-data.js.')
    lista = json.loads(m.group(1))
    if len(lista) < 100:
        sys.exit(f'Sólo he leído {len(lista)} jugadores: no sigo.')
    return [(p[0], p[1]) for p in lista]


def baja(pid, intentos=3):
    for i in range(intentos):
        try:
            req = urllib.request.Request(URL.format(id=pid),
                                         headers={'User-Agent': 'billions-mlb/1.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None                      # no tiene retrato
            if i == intentos - 1:
                return None
            time.sleep(1.5 * (i + 1))
        except (urllib.error.URLError, TimeoutError):
            if i == intentos - 1:
                return None
            time.sleep(1.5 * (i + 1))
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--refresh', action='store_true')
    args = ap.parse_args()

    os.makedirs(FOTOS, exist_ok=True)
    try:
        with open(INFORME, encoding='utf-8') as f:
            sin_foto = set(json.load(f).get('sin_foto', []))
    except (OSError, ValueError):
        sin_foto = set()
    if args.refresh:
        sin_foto = set()

    pendientes = []
    for pid, nombre in jugadores():
        destino = os.path.join(FOTOS, f'{pid}.jpg')
        if os.path.exists(destino) and not args.refresh:
            continue
        if pid in sin_foto:
            continue
        pendientes.append((pid, nombre, destino))

    print(f'{len(pendientes)} retratos por descargar')
    nuevos, fallidos = [], []

    def uno(t):
        pid, nombre, destino = t
        dato = baja(pid)
        if dato and len(dato) >= MINIMO:
            with open(destino, 'wb') as f:
                f.write(dato)
            return ('ok', pid, nombre)
        return ('no', pid, nombre)

    with futuros.ThreadPoolExecutor(max_workers=8) as pool:
        for estado, pid, nombre in pool.map(uno, pendientes):
            (nuevos if estado == 'ok' else fallidos).append(pid)
            if (len(nuevos) + len(fallidos)) % 200 == 0:
                print(f'  {len(nuevos) + len(fallidos)}/{len(pendientes)}', flush=True)

    sin_foto |= set(fallidos)
    with open(INFORME, 'w', encoding='utf-8') as f:
        json.dump({'sin_foto': sorted(sin_foto)}, f)

    total = len([a for a in os.listdir(FOTOS) if a.endswith('.jpg')])
    print(f'{len(nuevos)} nuevos · {len(fallidos)} sin retrato · {total} en photos/')


if __name__ == '__main__':
    main()
