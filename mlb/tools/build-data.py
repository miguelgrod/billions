#!/usr/bin/env python3
"""Convierte la caché cruda de la MLB Stats API en los datos del juego.

Produce `data/mlb-data.js`, que es lo único que carga el navegador:

    TEAMS    las 30 franquicias actuales, con su nombre y su abreviatura
    ACHIEVEMENTS  los logros que puede llevar un jugador
    PLAYERS  [id, nombre, [equipos], logros, primera, última, notoriedad,
              anillos, país, {números de carrera}, tiene retrato]
    CHAMPS   {año: equipo que ganó las World Series}
    AWARDS   {premio: {año: [jugadores]}}

**Sólo entran los jugadores conocidos** (notoriedad por encima de FAMA_MINIMA).
Un quiz no puede preguntar por alguien de quien nadie ha oído hablar, ni
ofrecerlo como respuesta falsa: la pregunta se resolvería por descarte. De los
22.000 que aparecen en las plantillas, el juego se queda con los mejores.

No editar `data/mlb-data.js` a mano: sale de aquí.
"""

import json
import os
import re
import sys
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, 'cache')
DATOS = os.path.join(RAIZ, 'data')

# Lo conocido que hay que ser para entrar en el juego. La notoriedad la calcula
# `notoriedad()` y son, más o menos, las apariciones al plato entre cien más los
# premios; 60 deja fuera al que jugó dos temporadas de suplente y deja dentro a
# cualquiera que un aficionado pueda reconocer.
FAMA_MINIMA = 60

# Los logros, en el orden en que ocupan sus bits. Añadir uno nuevo va AL FINAL:
# el orden es el que decide el bit, y cambiarlo invalida los datos ya generados.
LOGROS = [
    ('hof',      'Hall of Fame'),
    ('mvp',      'MVP'),
    ('cy',       'Cy Young'),
    ('roy',      'Rookie of the Year'),
    ('allstar',  'All-Star'),
    ('gg',       'Gold Glove'),
    ('ss',       'Silver Slugger'),
    ('wsmvp',    'World Series MVP'),
    ('hr500',    '500+ HR career'),
    ('hr300',    '300+ HR career'),
    ('h3000',    '3000+ hits career'),
    ('h2000',    '2000+ hits career'),
    ('w300',     '300+ wins career'),
    ('w200',     '200+ wins career'),
    ('k3000',    '3000+ K career'),
    ('sb300',    '300+ SB career'),
    ('avg300',   '.300+ career AVG'),
    ('sv300',    '300+ saves career'),
    ('hr40',     '40+ HR season'),
    ('hr30',     '30+ HR season'),
    ('h200',     '200+ hit season'),
    ('rbi100',   '100+ RBI season'),
    ('sb30',     '30+ SB season'),
    ('avg300s',  '.300+ AVG season'),
    ('w20',      '20+ win season'),
    ('k200',     '200+ K season'),
    ('era300',   'Sub-3.00 ERA season'),
    ('sv30',     '30+ save season'),
    ('foreign',  'Born outside the US'),
    ('onlyteam', 'Only one franchise'),
]
BIT = {clave: i for i, (clave, _) in enumerate(LOGROS)}

# El premio de la API -> el logro del juego.
PREMIO_LOGRO = {
    'MLBHOF': 'hof',
    'ALMVP': 'mvp', 'NLMVP': 'mvp',
    'ALCY': 'cy', 'NLCY': 'cy', 'MLBCY': 'cy',
    'ALROY': 'roy', 'NLROY': 'roy', 'MLBROY': 'roy',
    'ALAS': 'allstar', 'NLAS': 'allstar',
    'ALGG': 'gg', 'NLGG': 'gg', 'MLGG': 'gg',
    'ALSS': 'ss', 'NLSS': 'ss',
    'WSMVP': 'wsmvp',
}


def lee(ruta, defecto=None):
    try:
        with open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def franquicias():
    """Las 30 de hoy, con toda su historia detrás: el id de la API es de la
    franquicia y no de la ciudad, así que los Dodgers de Brooklyn y los de Los
    Ángeles son el mismo 119 y el jugador de 1955 cuenta como Dodger."""
    ultima = max(int(a[:-5]) for a in os.listdir(os.path.join(CACHE, 'teams')))
    activos = lee(os.path.join(CACHE, 'teams', f'{ultima}.json'), [])
    equipos = {}
    for t in activos:
        if t.get('sport', {}).get('id') == 1 and t.get('active'):
            equipos[t['id']] = {
                'id': t['id'],
                'name': t['name'],
                'abbr': t.get('abbreviation', ''),
                # El nombre sin ciudad viene dado: recortarlo por el último
                # espacio dejaba a los Blue Jays en «Jays».
                'short': t.get('teamName') or t.get('clubName') or t['name'],
                'league': t.get('league', {}).get('name', ''),
            }
    return equipos


def carreras():
    """Por qué equipos pasó cada jugador y en qué temporadas."""
    equipos = defaultdict(set)
    anios = {}
    raiz = os.path.join(CACHE, 'rosters')
    for anio in sorted(os.listdir(raiz)):
        carpeta = os.path.join(raiz, anio)
        if not os.path.isdir(carpeta):
            continue
        for archivo in os.listdir(carpeta):
            tid = int(archivo[:-5])
            for p in lee(os.path.join(carpeta, archivo), []):
                pid = p['person']['id']
                equipos[pid].add(tid)
                y = int(anio)
                primero, ultimo = anios.get(pid, (y, y))
                anios[pid] = (min(primero, y), max(ultimo, y))
    return equipos, anios


def premios():
    """Los logros que vienen dados: Salón de la Fama, MVP, Cy Young…"""
    flags = defaultdict(int)
    carpeta = os.path.join(CACHE, 'awards')
    for archivo in sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []:
        clave = PREMIO_LOGRO.get(archivo[:-5])
        if not clave:
            continue
        for r in lee(os.path.join(carpeta, archivo), []):
            pid = (r.get('player') or {}).get('id')
            if pid:
                flags[pid] |= 1 << BIT[clave]
    return flags


def campeones():
    """Quién ganó las World Series de cada año. El ganador no viene dicho: se
    cuenta quién se llevó más partidos de la serie. En 1904 y 1994 no hubo
    World Series, así que esos dos años sencillamente no están."""
    camp, sub = {}, {}
    carpeta = os.path.join(CACHE, 'postseason')
    for archivo in sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []:
        anio = int(archivo[:-5])
        victorias = defaultdict(int)
        jugaron = set()
        for serie in lee(os.path.join(carpeta, archivo), []):
            if serie.get('series', {}).get('gameType') != 'W':
                continue
            for g in serie.get('games', []):
                for lado in ('away', 'home'):
                    t = g['teams'][lado]
                    jugaron.add(t['team']['id'])
                    if t.get('isWinner'):
                        victorias[t['team']['id']] += 1
        if victorias:
            gana = max(victorias, key=victorias.get)
            camp[anio] = gana
            perdedor = [t for t in jugaron if t != gana]
            if perdedor:
                sub[anio] = perdedor[0]
    return camp, sub


def premios_por_anio():
    """Qué jugador ganó cada premio en cada año. Es de lo que salen las
    preguntas del tipo «¿quién fue el MVP de 2012?»."""
    salida = defaultdict(lambda: defaultdict(list))
    carpeta = os.path.join(CACHE, 'awards')
    for archivo in sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []:
        premio = archivo[:-5]
        clave = PREMIO_LOGRO.get(premio)
        # El Salón de la Fama no se gana en una temporada y los All-Star son
        # cientos por año: ninguno de los dos da una pregunta con una respuesta.
        if clave not in ('mvp', 'cy', 'roy', 'wsmvp'):
            continue
        # La liga hace falta: hay un MVP por liga y por año, así que sin ella
        # «¿quién fue el MVP de 2012?» tendría dos respuestas correctas.
        liga = 'AL' if premio.startswith('AL') else 'NL' if premio.startswith('NL') else ''
        for r in lee(os.path.join(carpeta, archivo), []):
            pid = (r.get('player') or {}).get('id')
            anio = r.get('season')
            if pid and anio:
                salida[clave][int(anio)].append([pid, liga])
    return {k: dict(v) for k, v in salida.items()}


def numero(v):
    """Las estadísticas llegan como texto y con «-.--» cuando no hay dato."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def logros_de_numeros():
    """Los logros que hay que calcular: los de carrera sumando temporadas y los
    de temporada quedándose con la mejor. Un traspaso parte la temporada en dos
    filas, así que las de un mismo año se suman antes de juzgarlas."""
    carrera = defaultdict(lambda: defaultdict(float))
    temporada = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    carpeta = os.path.join(CACHE, 'stats')

    for archivo in sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []:
        grupo = archivo.split('-')[0]
        anio = int(archivo.split('-')[1][:-5])
        for s in lee(os.path.join(carpeta, archivo), []):
            pid = (s.get('player') or {}).get('id')
            if not pid:
                continue
            st = s.get('stat', {})
            campos = (('homeRuns', 'hits', 'rbi', 'stolenBases', 'atBats', 'plateAppearances')
                      if grupo == 'hitting' else
                      ('wins', 'strikeOuts', 'saves', 'earnedRuns', 'inningsPitched'))
            for c in campos:
                v = numero(st.get(c))
                carrera[pid][c] += v
                temporada[pid][anio][c] += v

    flags = defaultdict(int)

    def marca(pid, clave):
        flags[pid] |= 1 << BIT[clave]

    for pid, c in carrera.items():
        if c['homeRuns'] >= 500: marca(pid, 'hr500')
        if c['homeRuns'] >= 300: marca(pid, 'hr300')
        if c['hits'] >= 3000: marca(pid, 'h3000')
        if c['hits'] >= 2000: marca(pid, 'h2000')
        if c['wins'] >= 300: marca(pid, 'w300')
        if c['wins'] >= 200: marca(pid, 'w200')
        if c['strikeOuts'] >= 3000 and c['inningsPitched'] > 0: marca(pid, 'k3000')
        if c['stolenBases'] >= 300: marca(pid, 'sb300')
        if c['saves'] >= 300: marca(pid, 'sv300')
        # La media de bateo pide un mínimo de turnos: sin él, cualquiera con un
        # hit en dos turnos batearía .500 de por vida.
        if c['atBats'] >= 3000 and c['hits'] / max(c['atBats'], 1) >= 0.300:
            marca(pid, 'avg300')

    for pid, anios in temporada.items():
        for _, t in anios.items():
            if t['homeRuns'] >= 40: marca(pid, 'hr40')
            if t['homeRuns'] >= 30: marca(pid, 'hr30')
            if t['hits'] >= 200: marca(pid, 'h200')
            if t['rbi'] >= 100: marca(pid, 'rbi100')
            if t['stolenBases'] >= 30: marca(pid, 'sb30')
            if t['wins'] >= 20: marca(pid, 'w20')
            if t['strikeOuts'] >= 200 and t['inningsPitched'] >= 100: marca(pid, 'k200')
            if t['saves'] >= 30: marca(pid, 'sv30')
            # Los mínimos de la propia MLB para los títulos: 502 apariciones al
            # plato y 162 entradas lanzadas.
            if t['plateAppearances'] >= 502 and t['hits'] / max(t['atBats'], 1) >= 0.300:
                marca(pid, 'avg300s')
            if t['inningsPitched'] >= 162 and (t['earnedRuns'] * 9) / t['inningsPitched'] < 3.00:
                marca(pid, 'era300')

    return flags, {pid: c for pid, c in carrera.items()}


def notoriedad(carrera, flags):
    """Lo conocido que es un jugador, aproximado con lo que hay en casa: cuánto
    jugó de verdad —apariciones al plato y entradas lanzadas— y qué premios se
    llevó. No es el uso real de otros jugadores, que es lo que mide la rareza
    del juego original y que aquí no se puede saber sin servidor.

    Hace falta porque «temporadas jugadas» no vale: Danny Darwin duró veintiún
    años sin ser conocido y Jackie Robinson diez siéndolo."""
    peso = {'hof': 60, 'mvp': 30, 'cy': 25, 'roy': 12, 'allstar': 8,
            'gg': 6, 'ss': 6, 'wsmvp': 10}
    # Una entrada lanzada vale dos apariciones al plato: con cuatro —lo primero
    # que probé— Carlton salía más obvio que Willie Mays en su propia casilla.
    n = carrera.get('plateAppearances', 0) + carrera.get('inningsPitched', 0) * 2.0
    premio = sum(v for k, v in peso.items() if flags >> BIT[k] & 1)
    return n / 100.0 + premio


def fichas():
    """Nombre, país y posición. El país es el que decide «nacido fuera de
    Estados Unidos», que es de las condiciones más bonitas del juego."""
    gente = {}
    carpeta = os.path.join(CACHE, 'people')
    for archivo in sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []:
        for p in lee(os.path.join(carpeta, archivo), []):
            gente[p['id']] = {
                'name': p.get('fullName', ''),
                'country': p.get('birthCountry', ''),
                'pos': (p.get('primaryPosition') or {}).get('abbreviation', ''),
            }
    return gente


def main():
    for parte in ('teams', 'rosters', 'awards', 'stats', 'people'):
        if not os.path.isdir(os.path.join(CACHE, parte)):
            sys.exit(f'Falta {parte}/ en la caché. Pasa antes tools/fetch-mlb.py.')

    equipos = franquicias()
    print(f'{len(equipos)} franquicias activas')
    if len(equipos) != 30:
        print(f'  ! esperaba 30, no {len(equipos)}: revísalo antes de seguir')

    en_equipos, anios = carreras()
    print(f'{len(en_equipos)} jugadores con plantilla')

    flags = defaultdict(int)
    de_numeros, carrera = logros_de_numeros()
    for origen in (premios(), de_numeros):
        for pid, f in origen.items():
            flags[pid] |= f

    gente = fichas()
    print(f'{len(gente)} fichas')

    camp, sub = campeones()
    print(f'{len(camp)} World Series con campeón')
    awards = premios_por_anio()
    print('premios por año: ' + ', '.join(f'{k} {len(v)}' for k, v in awards.items()))

    # Los anillos: años en que su equipo ganó las World Series estándole él en
    # la plantilla. Es la plantilla de temporada completa, así que a quien
    # llegó traspasado en agosto se le cuenta igual —que es como lo cuenta
    # cualquier aficionado, aunque el anillo de verdad tenga sus reglas.
    anillos = defaultdict(int)
    raiz = os.path.join(CACHE, 'rosters')
    for anio_txt in sorted(os.listdir(raiz)):
        anio = int(anio_txt)
        ganador = camp.get(anio)
        if not ganador:
            continue
        archivo = os.path.join(raiz, anio_txt, f'{ganador}.json')
        for p in lee(archivo, []):
            anillos[p['person']['id']] += 1

    jugadores = []
    for pid, ficha in gente.items():
        equipos_del = sorted(en_equipos.get(pid, ()))
        if not equipos_del or not ficha['name']:
            continue
        f = flags.get(pid, 0)
        if ficha['country'] and ficha['country'] != 'USA':
            f |= 1 << BIT['foreign']
        # Una sola franquicia en toda la carrera, y que haya durado: con una
        # temporada suelta, «fiel a un equipo» no significa nada.
        primera, ultima = anios.get(pid, (0, 0))
        if len(equipos_del) == 1 and ultima - primera >= 4:
            f |= 1 << BIT['onlyteam']
        fama = round(notoriedad(carrera.get(pid, {}), f))
        if fama < FAMA_MINIMA:
            continue
        c = carrera.get(pid, {})
        # Los números que se preguntan. Van redondeados: nadie pregunta por
        # 2.297 carreras impulsadas, y el archivo pesa menos.
        num = {}
        for clave, campo in (('hr', 'homeRuns'), ('h', 'hits'), ('rbi', 'rbi'),
                             ('sb', 'stolenBases'), ('ab', 'atBats'),
                             ('w', 'wins'), ('k', 'strikeOuts'), ('sv', 'saves'),
                             ('ip', 'inningsPitched')):
            v = round(c.get(campo, 0))
            if v:
                num[clave] = v
        if num.get('ab', 0) >= 1000:
            num['avg'] = round(c['hits'] / c['atBats'], 3)
        # Si tiene retrato descargado. Las rondas que enseñan cartas de
        # jugador sólo usan a los que lo tienen: una carta con foto al lado de
        # otra sin ella se lee como un fallo, no como una opción.
        foto = 1 if os.path.exists(os.path.join(RAIZ, 'photos', f'{pid}.jpg')) else 0
        jugadores.append([pid, ficha['name'], equipos_del, f, primera, ultima,
                          fama, anillos.get(pid, 0), ficha['country'], num, foto])

    jugadores.sort(key=lambda j: -j[6])
    print(f'{len(jugadores)} jugadores en el juego (de {len(gente)} con ficha)')

    os.makedirs(DATOS, exist_ok=True)
    salida = os.path.join(DATOS, 'mlb-data.js')
    with open(salida, 'w', encoding='utf-8') as f:
        f.write('// Generado por tools/build-data.py — no editar a mano.\n')
        f.write('// Fuente: MLB Stats API (statsapi.mlb.com).\n')
        f.write('const TEAMS = ' + json.dumps(list(equipos.values()), separators=(',', ':')) + ';\n')
        f.write('const ACHIEVEMENTS = ' + json.dumps(
            [{'key': k, 'label': l} for k, l in LOGROS], separators=(',', ':')) + ';\n')
        f.write('const CHAMPS = ' + json.dumps(camp, separators=(',', ':')) + ';\n')
        f.write('const RUNNERS = ' + json.dumps(sub, separators=(',', ':')) + ';\n')
        f.write('const AWARDS = ' + json.dumps(awards, separators=(',', ':')) + ';\n')
        f.write('const PLAYERS = ' + json.dumps(jugadores, separators=(',', ':'),
                                                ensure_ascii=False) + ';\n')
    print(f'{salida} — {os.path.getsize(salida) / 1048576:.1f} MB')


if __name__ == '__main__':
    main()
