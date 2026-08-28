#!/usr/bin/env python3
"""Descarga los datos crudos de la MLB Stats API a mlb/cache/.

La API es pública y no pide clave (https://statsapi.mlb.com). Aquí no se
interpreta nada: se guarda tal cual llega, y `build-data.py` es quien decide
qué entra en el juego. Separarlo así permite cambiar las reglas del juego sin
volver a bajarse ciento cincuenta temporadas.

Es reanudable: lo que ya está en la caché no se vuelve a pedir. Con --refresh
se rehace todo.

    python3 tools/fetch-mlb.py                 # todo lo que falte
    python3 tools/fetch-mlb.py --que rosters   # sólo una parte
"""

import argparse
import concurrent.futures as futuros
import json
import os
import sys
import time
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, 'cache')
API = 'https://statsapi.mlb.com/api/v1'

# La primera temporada de la National League. La API tiene rosters desde ahí.
PRIMERA = 1876
ULTIMA = time.gmtime().tm_year

# Los premios que el juego sabe preguntar. La API tiene 682; casi todos son
# distinciones de club («Astros Rookie of the Year») que no significan nada
# fuera de su ciudad. Estos son los que reconoce cualquier aficionado.
PREMIOS = {
    'MLBHOF': 'hof',        # Salón de la Fama
    'ALMVP': 'mvp', 'NLMVP': 'mvp',
    'ALCY': 'cy', 'NLCY': 'cy', 'MLBCY': 'cy',
    'ALROY': 'roy', 'NLROY': 'roy', 'MLBROY': 'roy',
    'ALAS': 'allstar', 'NLAS': 'allstar',
    'ALGG': 'gg', 'NLGG': 'gg', 'MLGG': 'gg',
    'ALSS': 'ss', 'NLSS': 'ss',
    'WSMVP': 'wsmvp',
}

# Cuántos jugadores devuelve como mucho cada página de estadísticas.
PAGINA = 1000


def pide(url, intentos=4):
    """GET con reintentos. La API responde 429 si se le aprieta demasiado."""
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'billions-mlb/1.0'})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode('utf-8'))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            codigo = getattr(e, 'code', None)
            if codigo in (400, 404):          # no existe: no insistas
                return None
            if i == intentos - 1:
                print(f'  ! {url} -> {e}', file=sys.stderr)
                return None
            time.sleep(1.5 * (i + 1))
    return None


def guarda(ruta, dato):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(dato, f, separators=(',', ':'))


def hecho(ruta, refrescar):
    return os.path.exists(ruta) and not refrescar


def equipos(refrescar):
    """Los equipos de cada temporada. El id es de la franquicia y no de la
    ciudad: 119 son los Dodgers, estén en Brooklyn o en Los Ángeles."""
    print('Equipos por temporada…')
    pendientes = []
    for anio in range(PRIMERA, ULTIMA + 1):
        ruta = os.path.join(CACHE, 'teams', f'{anio}.json')
        if not hecho(ruta, refrescar):
            pendientes.append((anio, ruta))

    def uno(par):
        anio, ruta = par
        d = pide(f'{API}/teams?sportId=1&season={anio}')
        guarda(ruta, (d or {}).get('teams', []))

    corre(pendientes, uno)
    print(f'  {ULTIMA - PRIMERA + 1} temporadas en caché')


def rosters(refrescar):
    """La plantilla completa de cada equipo y temporada: es de aquí de donde
    sale «por qué equipos pasó cada jugador», que es la mitad del juego."""
    print('Plantillas…')
    tareas = []
    for anio in range(PRIMERA, ULTIMA + 1):
        ruta = os.path.join(CACHE, 'teams', f'{anio}.json')
        if not os.path.exists(ruta):
            continue
        with open(ruta, encoding='utf-8') as f:
            for t in json.load(f):
                destino = os.path.join(CACHE, 'rosters', str(anio), f"{t['id']}.json")
                if not hecho(destino, refrescar):
                    tareas.append((anio, t['id'], destino))

    def uno(t):
        anio, tid, destino = t
        d = pide(f'{API}/teams/{tid}/roster?rosterType=fullSeason&season={anio}')
        guarda(destino, (d or {}).get('roster', []))

    corre(tareas, uno)
    print(f'  {len(tareas)} plantillas descargadas')


def premios(refrescar):
    print('Premios…')
    tareas = [(pid, os.path.join(CACHE, 'awards', f'{pid}.json'))
              for pid in PREMIOS
              if not hecho(os.path.join(CACHE, 'awards', f'{pid}.json'), refrescar)]

    def uno(t):
        pid, ruta = t
        d = pide(f'{API}/awards/{pid}/recipients?sportId=1')
        guarda(ruta, (d or {}).get('awards', []))

    corre(tareas, uno)
    print(f'  {len(PREMIOS)} premios en caché')


def estadisticas(refrescar):
    """Bateo y pitcheo de cada temporada, con todos los jugadores que
    aparecieron (`playerPool=all`). De aquí salen los logros de números: los
    500 jonrones, los 3.000 hits, las 300 victorias."""
    print('Estadísticas por temporada…')
    tareas = []
    for anio in range(PRIMERA, ULTIMA + 1):
        for grupo in ('hitting', 'pitching'):
            ruta = os.path.join(CACHE, 'stats', f'{grupo}-{anio}.json')
            if not hecho(ruta, refrescar):
                tareas.append((anio, grupo, ruta))

    def uno(t):
        anio, grupo, ruta = t
        filas, salto = [], 0
        while True:
            d = pide(f'{API}/stats?stats=season&season={anio}&group={grupo}'
                     f'&sportId=1&playerPool=all&limit={PAGINA}&offset={salto}')
            trozo = (d or {}).get('stats', [{}])[0].get('splits', []) if d else []
            filas += trozo
            if len(trozo) < PAGINA:
                break
            salto += PAGINA
        guarda(ruta, filas)

    corre(tareas, uno)
    print(f'  {len(tareas)} temporadas descargadas')


def postemporada(refrescar):
    """Las series de octubre de cada año. De aquí sale quién ganó las World
    Series —contando victorias, que el ganador no viene dicho— y, cruzándolo
    con las plantillas, cuántos anillos tiene cada jugador."""
    print('Postemporada…')
    tareas = []
    for anio in range(1903, ULTIMA + 1):
        ruta = os.path.join(CACHE, 'postseason', f'{anio}.json')
        if not hecho(ruta, refrescar):
            tareas.append((anio, ruta))

    def uno(t):
        anio, ruta = t
        d = pide(f'{API}/schedule/postseason/series?season={anio}&sportId=1')
        guarda(ruta, (d or {}).get('series', []))

    corre(tareas, uno)
    print(f'  {len(tareas)} temporadas descargadas')


def personas(refrescar):
    """La ficha de cada jugador: país de nacimiento, posición y debut. Se piden
    de cien en cien (`personIds`), que es la diferencia entre doscientas
    peticiones y veinte mil."""
    print('Fichas de jugadores…')
    ids = set()
    raiz = os.path.join(CACHE, 'rosters')
    for anio in sorted(os.listdir(raiz)) if os.path.isdir(raiz) else []:
        for archivo in os.listdir(os.path.join(raiz, anio)):
            with open(os.path.join(raiz, anio, archivo), encoding='utf-8') as f:
                for p in json.load(f):
                    ids.add(p['person']['id'])
    ids = sorted(ids)
    print(f'  {len(ids)} jugadores en las plantillas')

    lotes = [ids[i:i + 100] for i in range(0, len(ids), 100)]
    tareas = [(n, lote, os.path.join(CACHE, 'people', f'{n:04d}.json'))
              for n, lote in enumerate(lotes)
              if not hecho(os.path.join(CACHE, 'people', f'{n:04d}.json'), refrescar)]

    def uno(t):
        _, lote, ruta = t
        d = pide(f"{API}/people?personIds={','.join(map(str, lote))}")
        guarda(ruta, (d or {}).get('people', []))

    corre(tareas, uno)
    print(f'  {len(lotes)} lotes en caché')


def corre(tareas, funcion, hilos=6):
    """Seis hilos: con más, la API empieza a devolver 429 y se tarda más."""
    if not tareas:
        return
    hechas = 0
    with futuros.ThreadPoolExecutor(max_workers=hilos) as pool:
        for _ in pool.map(funcion, tareas):
            hechas += 1
            if hechas % 100 == 0 or hechas == len(tareas):
                print(f'  {hechas}/{len(tareas)}', flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--que', default='todo',
                   choices=['todo', 'equipos', 'rosters', 'premios', 'stats', 'postemporada', 'personas'])
    p.add_argument('--refresh', action='store_true', help='rehace lo que ya está')
    args = p.parse_args()

    if args.que in ('todo', 'equipos'):
        equipos(args.refresh)
    if args.que in ('todo', 'rosters'):
        rosters(args.refresh)
    if args.que in ('todo', 'premios'):
        premios(args.refresh)
    if args.que in ('todo', 'stats'):
        estadisticas(args.refresh)
    if args.que in ('todo', 'postemporada'):
        postemporada(args.refresh)
    # Va la última porque necesita los identificadores de las plantillas.
    if args.que in ('todo', 'personas'):
        personas(args.refresh)


if __name__ == '__main__':
    main()
