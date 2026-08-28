// El motor del juego: qué se pregunta, qué respuestas se ofrecen y cuánto vale
// acertar. No toca el DOM ni el almacenamiento, para que pueda ejecutarse
// también fuera del navegador —medir el reparto de preguntas, rehacer una
// partida desde su semilla— y para que un día cliente y servidor compartan
// estas reglas en vez de tener cada uno su copia.

// --------------------------------------------------------------- reglas
const VIDAS = 3;
const TIEMPO = 12000;          // ms por pregunta
const PUNTOS_MAX = 100;
const BURBUJAS = 20;

// ---------------------------------------------------------------- azar
// Sembrado: con la semilla y las burbujas que pulsó el jugador se reconstruye
// la partida entera, que es lo que permitiría comprobar una puntuación.
let semillaActual = 0;
let azar = mulberry32(0);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function siembra(n) {
  semillaActual = (n === undefined || n === null)
    ? (Math.random() * 4294967296) >>> 0 : n >>> 0;
  azar = mulberry32(semillaActual);
  return semillaActual;
}

const rnd = (n) => Math.floor(azar() * n);
const pick = (l) => l[rnd(l.length)];
const coin = () => azar() < 0.5;

function baraja(l) {
  const c = l.slice();
  for (let i = c.length - 1; i > 0; i--) { const j = rnd(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
  return c;
}

// ------------------------------------------------------------ depósitos
const P_ID = 0, P_NAME = 1, P_TEAMS = 2, P_FLAGS = 3, P_FROM = 4, P_TO = 5,
      P_FAME = 6, P_RINGS = 7, P_COUNTRY = 8, P_NUM = 9, P_PHOTO = 10;

const BIT = {};
ACHIEVEMENTS.forEach((a, i) => { BIT[a.key] = i; });
const tiene = (p, clave) => (p[P_FLAGS] >> BIT[clave] & 1) === 1;

const EQUIPO = {};
TEAMS.forEach((t) => { EQUIPO[t.id] = t; });
const JUGADOR = {};
PLAYERS.forEach((p) => { JUGADOR[p[P_ID]] = p; });

// Los que se reconocen sin pensar. Son el sujeto de las preguntas: preguntar
// por alguien que no suena no mide saber de béisbol, mide haber leído una
// enciclopedia.
const ESTRELLAS = PLAYERS.filter((p) => p[P_FAME] >= 130);
// Los que se pueden enseñar en una carta. Quien no tiene retrato sigue en el
// juego —se le puede nombrar en el enunciado— pero no sale en una tarjeta.
const RETRATADOS = ESTRELLAS.filter((p) => p[P_PHOTO]);
const HOF = PLAYERS.filter((p) => tiene(p, 'hof') && p[P_PHOTO]);
const NO_HOF = PLAYERS.filter((p) => !tiene(p, 'hof') && p[P_FAME] >= 100 && p[P_PHOTO]);
const BATEADORES = PLAYERS.filter((p) => (p[P_NUM].ab || 0) >= 3000 && p[P_PHOTO]);
const LANZADORES = PLAYERS.filter((p) => (p[P_NUM].ip || 0) >= 1000 && p[P_PHOTO]);
const CON_ANILLOS = ESTRELLAS.filter((p) => p[P_RINGS] > 0);
const EXTRANJEROS = ESTRELLAS.filter((p) => p[P_COUNTRY] && p[P_COUNTRY] !== 'USA');
const ANIOS_WS = Object.keys(CHAMPS).map(Number).sort((a, b) => a - b);
// Sólo se pregunta por finales cuyo campeón siga existiendo con ese nombre: no
// se puede ofrecer «Brooklyn Robins» entre tres opciones de hoy.
const ANIOS_WS_JUGABLES = ANIOS_WS.filter((a) => EQUIPO[CHAMPS[a]]);

// Un quiz de hoy no puede repartir por igual siglo y medio de historia: más de
// la mitad de las carreras del catálogo acabaron antes de 1970, y sortear
// plano llenaba las preguntas de Rube Marquard y Edd Roush. Dos de cada tres
// veces se pregunta por alguien que jugó en los últimos treinta años; el resto
// del tiempo, por cualquiera, que los clásicos también son el juego.
const MODERNO = 1995;
const PESO_MODERNO = 0.66;

function pickEpoca(lista) {
  const modernos = lista.filter((p) => p[P_TO] >= MODERNO);
  return (modernos.length && azar() < PESO_MODERNO) ? pick(modernos) : pick(lista);
}

// Lo mismo con los años: las World Series de 2016 las recuerda mucha más gente
// que las de 1926.
function pickAnio(anios) {
  const recientes = anios.filter((a) => a >= MODERNO);
  return (recientes.length && azar() < PESO_MODERNO) ? pick(recientes) : pick(anios);
}

// ------------------------------------------------------- dificultad
// Lo que sube con el nivel no es el número de opciones: es lo parecidas que
// son entre sí. Un duelo entre 700 y 100 jonrones lo acierta cualquiera.
const mezcla = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const nivel = (level) => Math.min(1, (level - 1) / 15);

// ---------------------------------------------------- tipos de pregunta
// Cada generador devuelve { pregunta, opciones, correcta, pista, firma } o
// null si esta vez no ha encontrado una pregunta que cumpla las condiciones.
// `firma` sirve para no repetir la misma pregunta en una partida.

// «¿Qué equipo ganó las World Series de 2004?»
function rondaSeries(level) {
  const anio = pickAnio(ANIOS_WS_JUGABLES);
  const ganador = EQUIPO[CHAMPS[anio]];
  if (!ganador) return null;
  const señuelos = [];
  // El subcampeón de esa misma final es el señuelo perfecto: estuvo ahí.
  const sub = EQUIPO[RUNNERS[anio]];
  if (sub && sub.id !== ganador.id) señuelos.push(sub);
  // Los demás, campeones de años cercanos; cuanto más alto el nivel, más cerca.
  const banda = Math.round(mezcla(30, 6, nivel(level)));
  const cerca = ANIOS_WS_JUGABLES.filter((a) => a !== anio && Math.abs(a - anio) <= banda);
  for (const a of baraja(cerca)) {
    const e = EQUIPO[CHAMPS[a]];
    if (e && !señuelos.some((s) => s.id === e.id) && e.id !== ganador.id) señuelos.push(e);
    if (señuelos.length >= 2) break;
  }
  if (señuelos.length < 2) return null;
  return {
    pregunta: `Which team won the <b>${anio}</b> World Series?`,
    opciones: baraja([ganador, ...señuelos.slice(0, 2)]).map(carta_equipo),
    correcta: ganador.id,
    firma: `ws${anio}`,
  };
}

// «¿Cuál de estos jugadores está en el Salón de la Fama?»
function rondaHof(level) {
  const dentro = pickEpoca(HOF);
  // Los señuelos son de su época y de renombre parecido: si uno jugó en 1930 y
  // otro en 2015, se acierta por descarte sin saber nada.
  const banda = Math.round(mezcla(30, 8, nivel(level)));
  const fuera = NO_HOF.filter((p) => Math.abs(p[P_FROM] - dentro[P_FROM]) <= banda
    && p[P_FAME] >= dentro[P_FAME] * mezcla(0.3, 0.75, nivel(level)));
  if (fuera.length < 2) return null;
  const tres = baraja([dentro, ...baraja(fuera).slice(0, 2)]);
  return {
    pregunta: 'Which of these players is in the <b>Hall of Fame</b>?',
    opciones: tres.map(carta_jugador),
    correcta: dentro[P_ID],
    firma: `hof${dentro[P_ID]}`,
  };
}

// «¿Cuántos anillos ganó Derek Jeter?»
function rondaAnillos(level) {
  const p = pickEpoca(CON_ANILLOS);
  const suyos = p[P_RINGS];
  const opciones = new Set([suyos]);
  // Las opciones falsas se acercan con el nivel: al principio se ofrece 0 y 7,
  // al final el número de al lado.
  const salto = Math.round(mezcla(3, 1, nivel(level)));
  let intentos = 0;
  while (opciones.size < 4 && intentos++ < 40) {
    const d = suyos + (coin() ? 1 : -1) * (1 + rnd(salto));
    if (d >= 0) opciones.add(d);
  }
  if (opciones.size < 3) return null;
  return {
    pregunta: `How many <b>World Series</b> did <b>${p[P_NAME]}</b> win?`,
    opciones: baraja([...opciones]).map((n) => ({
      id: n, texto: String(n), tipo: 'numero',
    })),
    correcta: suyos,
    pista: `${p[P_NAME]} played from ${p[P_FROM]} to ${p[P_TO]}.`,
    firma: `rings${p[P_ID]}`,
  };
}

// «¿Quién fue el MVP de la Liga Americana en 2012?»
const NOMBRE_PREMIO = { mvp: 'MVP', cy: 'Cy Young Award', roy: 'Rookie of the Year' };
function rondaPremio(level) {
  const clave = pick(['mvp', 'mvp', 'cy', 'roy']);
  const anios = Object.keys(AWARDS[clave]).map(Number);
  const anio = pickAnio(anios);
  const fila = pick(AWARDS[clave][anio]);
  const ganador = JUGADOR[fila[0]];
  if (!ganador || !ganador[P_PHOTO]) return null;
  const liga = fila[1] ? `${fila[1]} ` : '';
  // Señuelos: jugadores en activo ese año, cuanto más parecidos de renombre,
  // más difícil. Que estuvieran jugando es imprescindible: si no, la respuesta
  // se cae sola.
  const activos = RETRATADOS.filter((p) => p[P_ID] !== ganador[P_ID]
    && p[P_FROM] <= anio && p[P_TO] >= anio);
  const parecidos = activos.filter((p) => p[P_FAME] >= ganador[P_FAME] * mezcla(0.25, 0.7, nivel(level)));
  const fuente = parecidos.length >= 2 ? parecidos : activos;
  if (fuente.length < 2) return null;
  const tres = baraja([ganador, ...baraja(fuente).slice(0, 2)]);
  return {
    pregunta: `Who won the <b>${anio} ${liga}${NOMBRE_PREMIO[clave]}</b>?`,
    opciones: tres.map(carta_jugador),
    correcta: ganador[P_ID],
    firma: `${clave}${anio}${ganador[P_ID]}`,
  };
}

// «¿En cuál de estos equipos jugó Shohei Ohtani?»
function rondaEquipo(level) {
  const p = pickEpoca(ESTRELLAS);
  const suyos = p[P_TEAMS].filter((t) => EQUIPO[t]);
  if (!suyos.length) return null;
  const bueno = EQUIPO[pick(suyos)];
  const otros = TEAMS.filter((t) => p[P_TEAMS].indexOf(t.id) === -1);
  if (otros.length < 2) return null;
  return {
    pregunta: `Which of these teams did <b>${p[P_NAME]}</b> play for?`,
    opciones: baraja([bueno, ...baraja(otros).slice(0, 2)]).map(carta_equipo),
    correcta: bueno.id,
    pista: `${p[P_NAME]}, ${p[P_FROM]}–${p[P_TO]}.`,
    firma: `team${p[P_ID]}${bueno.id}`,
  };
}

// Duelo de números: «¿quién bateó más jonrones en su carrera?»
const NUMEROS = [
  { clave: 'hr', texto: 'career home runs', deposito: () => BATEADORES },
  { clave: 'h', texto: 'career hits', deposito: () => BATEADORES },
  { clave: 'rbi', texto: 'career RBI', deposito: () => BATEADORES },
  { clave: 'sb', texto: 'career stolen bases', deposito: () => BATEADORES },
  { clave: 'w', texto: 'career wins', deposito: () => LANZADORES },
  { clave: 'k', texto: 'career strikeouts', deposito: () => LANZADORES },
];
function rondaNumeros(level) {
  const tipo = pick(NUMEROS);
  const deposito = tipo.deposito().filter((p) => (p[P_NUM][tipo.clave] || 0) > 0
    && p[P_FAME] >= 110);
  if (deposito.length < 2) return null;
  // La horquilla se estrecha con el nivel: del doble al 15 % de diferencia.
  const tope = mezcla(3, 1.35, nivel(level));
  const suelo = 1 + (tope - 1) * 0.45;
  for (let i = 0; i < 60; i++) {
    const a = pickEpoca(deposito), b = pickEpoca(deposito);
    if (a[P_ID] === b[P_ID]) continue;
    const va = a[P_NUM][tipo.clave], vb = b[P_NUM][tipo.clave];
    if (va === vb) continue;                       // un empate no tiene respuesta
    const razon = Math.max(va, vb) / Math.min(va, vb);
    if (razon > tope || razon < suelo) continue;
    const gana = va > vb ? a : b;
    return {
      pregunta: `Who had more <b>${tipo.texto}</b>?`,
      opciones: baraja([a, b]).map(carta_jugador),
      correcta: gana[P_ID],
      firma: `num${tipo.clave}${Math.min(a[P_ID], b[P_ID])}-${Math.max(a[P_ID], b[P_ID])}`,
    };
  }
  return null;
}

// «¿Quién debutó antes?»
function rondaEpoca(level) {
  const banda = Math.round(mezcla(25, 3, nivel(level)));
  for (let i = 0; i < 60; i++) {
    const a = pickEpoca(RETRATADOS), b = pickEpoca(RETRATADOS);
    if (a[P_ID] === b[P_ID] || a[P_FROM] === b[P_FROM]) continue;
    const hueco = Math.abs(a[P_FROM] - b[P_FROM]);
    if (hueco > banda || hueco < Math.max(1, banda * 0.3)) continue;
    const antes = a[P_FROM] < b[P_FROM] ? a : b;
    return {
      pregunta: 'Who played in the majors <b>first</b>?',
      opciones: baraja([a, b]).map((p) => carta_jugador(p, true)),
      correcta: antes[P_ID],
      firma: `era${Math.min(a[P_ID], b[P_ID])}-${Math.max(a[P_ID], b[P_ID])}`,
    };
  }
  return null;
}

// «¿Dónde nació Shohei Ohtani?»
function rondaPais() {
  const p = pickEpoca(EXTRANJEROS);
  const otros = [...new Set(PLAYERS.filter((q) => q[P_COUNTRY] && q[P_COUNTRY] !== p[P_COUNTRY]
    && q[P_FAME] >= 100).map((q) => q[P_COUNTRY]))];
  if (otros.length < 2) return null;
  return {
    pregunta: `Where was <b>${p[P_NAME]}</b> born?`,
    opciones: baraja([p[P_COUNTRY], ...baraja(otros).slice(0, 2)])
      .map((c) => ({ id: c, texto: c, tipo: 'texto' })),
    correcta: p[P_COUNTRY],
    firma: `born${p[P_ID]}`,
  };
}

// «¿Ganó X algún premio Cy Young?» — la de sí o no, para variar el ritmo.
function rondaSiNo(level) {
  const casos = [
    { clave: 'hof', texto: (p) => `Is <b>${p[P_NAME]}</b> in the Hall of Fame?` },
    { clave: 'mvp', texto: (p) => `Did <b>${p[P_NAME]}</b> ever win an <b>MVP</b> award?` },
    { clave: 'cy', texto: (p) => `Did <b>${p[P_NAME]}</b> ever win a <b>Cy Young</b> award?` },
    { clave: 'hr500', texto: (p) => `Did <b>${p[P_NAME]}</b> hit <b>500 home runs</b>?` },
    { clave: 'h3000', texto: (p) => `Did <b>${p[P_NAME]}</b> reach <b>3,000 hits</b>?` },
  ];
  const caso = pick(casos);
  // La respuesta se sortea antes de buscar a quién nombrar. Al revés, casi
  // todo sería «no» —hay muchos más jugadores sin Cy Young que con él— y
  // responder siempre que no acertaría de sobra.
  const si = coin();
  const grupo = ESTRELLAS.filter((p) => tiene(p, caso.clave) === si
    && p[P_FAME] >= mezcla(200, 120, nivel(level)));
  if (!grupo.length) return null;
  const p = pickEpoca(grupo);
  return {
    pregunta: caso.texto(p),
    opciones: [{ id: true, texto: 'Yes', tipo: 'sino' }, { id: false, texto: 'No', tipo: 'sino' }],
    correcta: si,
    pista: `${p[P_NAME]}, ${p[P_FROM]}–${p[P_TO]}.`,
    firma: `sino${caso.clave}${p[P_ID]}`,
  };
}

// Las cartas que se pintan. El motor no sabe de HTML: dice qué hay en cada
// opción y main.js decide cómo se ve.
const carta_jugador = (p, sinAnios) => ({
  id: p[P_ID], texto: p[P_NAME], tipo: 'jugador',
  pie: sinAnios ? '' : `${p[P_FROM]}–${p[P_TO]}`,
});
const carta_equipo = (t) => ({ id: t.id, texto: t.name, tipo: 'equipo', abbr: t.abbr });

// La tabla de categorías: el nombre que sale en la burbuja, su generador y su
// peso en el reparto. Añadir un tipo es escribir su función y meterla aquí.
const TIPOS = [
  { clave: 'series',  etiqueta: 'World Series', gen: rondaSeries,  peso: 1 },
  { clave: 'hof',     etiqueta: 'Hall of Fame', gen: rondaHof,     peso: 1 },
  { clave: 'rings',   etiqueta: 'Rings',        gen: rondaAnillos, peso: 1 },
  { clave: 'awards',  etiqueta: 'Awards',       gen: rondaPremio,  peso: 1 },
  { clave: 'teams',   etiqueta: 'Teams',        gen: rondaEquipo,  peso: 1 },
  { clave: 'numbers', etiqueta: 'Numbers',      gen: rondaNumeros, peso: 1 },
  { clave: 'eras',    etiqueta: 'Eras',         gen: rondaEpoca,   peso: 1 },
  { clave: 'yesno',   etiqueta: 'Yes or no',    gen: rondaSiNo,    peso: 1 },
];
const TIPO = {};
TIPOS.forEach((t) => { TIPO[t.clave] = t; });

// ----------------------------------------------------------- la partida
const juego = { vistas: new Set(), ultima: null };

function reiniciaMotor(semilla) {
  const usada = siembra(semilla);
  juego.vistas = new Set();
  juego.ultima = null;
  return usada;
}

// Veinte burbujas entre ocho categorías no reparten exacto: cada una sale dos
// veces y cuatro salen una tercera. Las agraciadas se sortean en cada partida
// para que no sean siempre las mismas las que más aparecen.
//
// El reparto se hace dando vueltas a la lista, no repitiendo cada categoría un
// número fijo de veces: con seis categorías vivas —pasa una vez de cada
// quinientas, cuando dos generadores fallan la prueba— «dos cada una más una
// vuelta» dejaba el campo en dieciocho burbujas.
//
// Y sólo entran las categorías que de verdad pueden preguntar, probándolas
// varias veces: un generador puede fallar un intento por azar, y descartarlo
// por eso dejaría fuera una categoría que funciona.
function reparteCategorias() {
  const vivas = TIPOS.filter((t) => {
    for (let i = 0; i < 4; i++) if (t.gen(1)) return true;
    return false;
  });
  if (!vivas.length) return [];
  const campo = [];
  while (campo.length < BURBUJAS) {
    for (const t of baraja(vivas)) {
      campo.push(t.clave);
      if (campo.length >= BURBUJAS) break;
    }
  }
  return baraja(campo);
}

// Una pregunta de la categoría pedida. Si su generador no encuentra nada
// —puede pasar con las bandas apretadas de los niveles altos—, se afloja el
// nivel antes que soltar la pregunta de otra categoría: la burbuja que pulsa
// el jugador tiene que preguntar lo que dice.
function nuevaRonda(clave, level) {
  const tipo = TIPO[clave] || pick(TIPOS);
  for (let intento = 0; intento < 60; intento++) {
    const nivelReal = Math.max(1, level - Math.floor(intento / 12) * 4);
    const r = tipo.gen(nivelReal);
    if (!r) continue;
    if (juego.vistas.has(r.firma)) continue;
    juego.vistas.add(r.firma);
    juego.ultima = r.firma;
    return { ...r, tipo: clave, etiqueta: tipo.etiqueta };
  }
  // Antes una pregunta repetida que una burbuja sin pregunta.
  const r = tipo.gen(1);
  return r ? { ...r, tipo: clave, etiqueta: tipo.etiqueta } : null;
}

// Los puntos bajan linealmente con lo que se tarda: instantáneo 100, a la
// mitad del tiempo 50, agotado 0.
function puntosPor(ms) {
  const queda = Math.max(0, TIEMPO - ms);
  return Math.round(PUNTOS_MAX * (queda / TIEMPO));
}

if (typeof module !== 'undefined') {
  module.exports = {
    VIDAS, TIEMPO, PUNTOS_MAX, BURBUJAS, TIPOS, TEAMS, PLAYERS, CHAMPS, AWARDS,
    siembra, reiniciaMotor, reparteCategorias, nuevaRonda, puntosPor,
    ESTRELLAS, HOF, P_ID, P_NAME, P_FAME, P_RINGS,
  };
}
