// Billions — preguntas de cine: taquilla, estrenos, directores, repartos y Óscars
// Datos en movies.js · imágenes en posters.js, directors.js y actors.js

// Clave nueva: el récord pasa a medirse en puntos, no en niveles, así que no
// puede heredar los valores guardados con el sistema anterior.
const BEST_KEY = 'billions.best.points';
const VIDAS = 3;           // se permiten dos fallos; el tercero acaba la partida
const TIEMPO = 10000;      // milisegundos para responder
const PUNTOS_MAX = 100;    // se cobran enteros al instante y bajan hasta 0
const TOAST_MS = 3000;     // lo que el aviso de resultado permanece visible
const REVEAL_MS = 3200;    // tiempo para leer la respuesta antes de la ronda siguiente
const GAMEOVER_MS = 3500;  // tiempo para leerla antes de la pantalla de fin
const COUNT_MS = 900;      // duración del contador de recaudación
const OUT_MS = 260;        // salida de las tarjetas al cambiar de nivel
const STAGGER_MS = 70;     // desfase entre tarjetas al entrar

// Dificultad de los duelos: la marca lo parecidos que son los dos valores.
// En taquilla es el ratio entre recaudaciones (2.0 = una dobla a la otra);
// en estrenos, los años de diferencia. Ambas empiezan holgadas y se estrechan.
const RATIO_INICIAL = 2.0, RATIO_SUELO = 1.12, RATIO_CAIDA = 0.85, BANDA = 1.45;
const ANIOS_INICIAL = 18, ANIOS_SUELO = 2, ANIOS_CAIDA = 0.88;

// Al elegir un "intruso" (director o actor que no es de la película) se coge de
// una película lejana en el tiempo: no tenemos el reparto completo, sólo cinco
// nombres, así que la distancia temporal es lo que evita afirmar en falso que
// dos actores no coincidieron.
const HUECO_SEGURO = 12;

// ---- Tablero ----
// Anillo de 20 casillas: es el perímetro de una rejilla 6x6 (6+5+5+4) y además
// es múltiplo de 5, así que cada categoría cae exactamente cuatro veces y el
// ciclo encaja al cerrarse sin repetir dos iguales seguidas.
const LADO = 6;
const CASILLAS = 20;
const CATEGORIAS = ['taquilla', 'anio', 'director', 'actores', 'oscar'];
const TABLERO = Array.from({ length: CASILLAS }, (_, i) => CATEGORIAS[i % CATEGORIAS.length]);
const CARAS = 6;           // caras del dado
const PASO_MS = 130;       // lo que tarda la ficha en saltar de casilla a casilla
const GIRO_MS = 900;       // lo que gira el dado antes de pararse

const COLORES = {
  taquilla: { claro: '#fbbf24', oscuro: '#78350f' },
  anio:     { claro: '#38bdf8', oscuro: '#0c4a6e' },
  director: { claro: '#a78bfa', oscuro: '#4c1d95' },
  actores:  { claro: '#34d399', oscuro: '#064e3b' },
  oscar:    { claro: '#fb7185', oscuro: '#881337' },
};
const INICIAL = { taquilla: 'T', anio: 'E', director: 'D', actores: 'R', oscar: 'O' };

// Caras del dado como puntos, en una rejilla de 3x3
const PUNTOS = {
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
};

const els = {
  trivial: document.getElementById('trivial'),
  ring: document.getElementById('ring'),
  leyenda: document.getElementById('leyenda'),
  ask: document.getElementById('ask'),
  board: document.getElementById('board'),
  question: document.getElementById('question'),
  kind: document.getElementById('round-kind'),
  cards: document.getElementById('cards'),
  vs: document.getElementById('vs'),
  answers: document.getElementById('answers'),
  score: document.getElementById('score'),
  points: document.getElementById('points'),
  bar: document.getElementById('timer-bar'),
  lives: document.getElementById('lives'),
  gameover: document.getElementById('gameover'),
  goTitle: document.getElementById('go-title'),
  goScore: document.getElementById('go-score'),
  goLabel: document.getElementById('go-label'),
  goDetail: document.getElementById('go-detail'),
  restart: document.getElementById('restart'),
  intro: document.getElementById('intro'),
  play: document.getElementById('play'),
  introBest: document.getElementById('intro-best'),
  toast: document.getElementById('toast'),
  toastBox: document.getElementById('toast-box'),
  toastMsg: document.getElementById('toast-msg'),
  toastPoints: document.getElementById('toast-points'),
  toastSub: document.getElementById('toast-sub'),
};

const state = {
  score: 0,
  puntos: 0,
  best: 0,
  vidas: VIDAS,
  round: 1,
  ronda: null,          // la ronda en juego
  next: null,           // ronda precargada para la siguiente
  locked: true,
  ultima: '',           // firma de la ronda anterior, para no repetirla
  newRecord: false,
  timer: null,
  casilla: 0,           // dónde está la ficha
  completadas: new Set(),   // casillas ya acertadas: no se vuelve a ellas
  dado: 0,              // último número sacado
  destinos: [],         // las dos casillas a las que se puede ir
  pendientes: {},       // ronda ya preparada para cada destino
  t0: 0,                // instante en que arrancó la ronda
  corriendo: false,     // bandera propia: t0 puede valer 0 y ser válido
  raf: 0,               // identificador de la animación de la barra
};

/* ---------- utilidades ---------- */

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const coin = () => Math.random() < 0.5;
const fmtMoney = (n) => '$' + n.toLocaleString('es-ES', { maximumFractionDigits: 0 });

/* ---------- imágenes ---------- */

const posterOf = (m) =>
  typeof POSTERS !== 'undefined' && POSTERS[m.r] ? 'posters/' + POSTERS[m.r] : null;
const directorPhoto = (n) =>
  typeof DIRECTOR_PHOTOS !== 'undefined' && DIRECTOR_PHOTOS[n] ? 'directors/' + DIRECTOR_PHOTOS[n] : null;
const actorPhoto = (n) =>
  typeof ACTOR_PHOTOS !== 'undefined' && ACTOR_PHOTOS[n] ? 'actors/' + ACTOR_PHOTOS[n] : null;

/* ---------- fondos de datos ----------
   Nada entra en juego sin fotografía: las películas siempre tienen carátula,
   pero hay directores y actores sin foto, y esos quedan fuera. */

const PELIS = MOVIES.filter(posterOf);
const CON_DIRECTOR = PELIS.filter((m) => (m.d || []).length && m.d.every(directorPhoto));
const CON_REPARTO = PELIS.filter((m) => reparto(m).length >= 2);
const CON_OSCAR = PELIS.filter((m) => typeof m.o === 'number');
const DIRECTORES = [...new Set(CON_DIRECTOR.flatMap((m) => m.d))];

function reparto(m) {
  return (m.a || []).filter(actorPhoto);
}

/* ---------- construcción de rondas ---------- */

function bandaRatio(level) {
  const lo = RATIO_SUELO + (RATIO_INICIAL - RATIO_SUELO) * Math.pow(RATIO_CAIDA, level - 1);
  return [lo, lo * BANDA];
}

function huecoAnios(level) {
  return Math.max(ANIOS_SUELO,
    Math.round(ANIOS_SUELO + (ANIOS_INICIAL - ANIOS_SUELO) * Math.pow(ANIOS_CAIDA, level - 1)));
}

const cartaPeli = (m, opts = {}) => ({
  img: posterOf(m),
  titulo: m.t,
  sub: opts.sinAnio ? null : String(m.y),
  valor: opts.valor,
  dinero: !!opts.dinero,
});

const cartaPersona = (nombre, foto, rol) => ({
  img: foto, titulo: nombre, sub: rol, retrato: true,
});

// ---- Taquilla: ¿cuál recaudó más? ----
function rondaTaquilla(level) {
  const ratio = (a, b) => (a.g > b.g ? a.g / b.g : b.g / a.g);
  let [lo, hi] = bandaRatio(level);
  for (let i = 0; i < 40; i++) {
    const a = pick(PELIS);
    const rivales = PELIS.filter((b) => b !== a && ratio(a, b) >= lo && ratio(a, b) <= hi);
    if (rivales.length) {
      const b = pick(rivales);
      const [x, y] = coin() ? [a, b] : [b, a];
      return {
        tipo: 'taquilla',
        pregunta: '¿Cuál recaudó más en todo el mundo?',
        modo: 'elige',
        cartas: [cartaPeli(x, { valor: x.g, dinero: true }),
                 cartaPeli(y, { valor: y.g, dinero: true })],
        correcta: x.g > y.g ? 0 : 1,
        firma: [x.r, y.r].sort((p, q) => p - q).join('-'),
      };
    }
    if (i % 8 === 7) { lo *= 0.92; hi *= 1.12; }
  }
  return null;
}

// ---- Estrenos: ¿cuál se estrenó antes? ----
function rondaAnio(level) {
  const hueco = huecoAnios(level);
  for (let i = 0; i < 40; i++) {
    const a = pick(PELIS);
    const rivales = PELIS.filter((b) => {
      const d = Math.abs(a.y - b.y);
      return d >= hueco && d <= hueco * 2.2;
    });
    if (rivales.length) {
      const b = pick(rivales);
      const [x, y] = coin() ? [a, b] : [b, a];
      return {
        tipo: 'anio',
        pregunta: '¿Cuál se estrenó antes?',
        modo: 'elige',
        // el año va oculto: es justo lo que hay que adivinar
        cartas: [cartaPeli(x, { sinAnio: true, valor: x.y }),
                 cartaPeli(y, { sinAnio: true, valor: y.y })],
        correcta: x.y < y.y ? 0 : 1,
        firma: [x.r, y.r].sort((p, q) => p - q).join('-'),
      };
    }
  }
  return null;
}

// ---- Director: ¿dirigió esta persona esta película? ----
function rondaDirector(level) {
  const m = pick(CON_DIRECTOR);
  const verdadero = coin();
  let nombre;
  if (verdadero) {
    nombre = pick(m.d);
  } else {
    // cuanto más alto el nivel, más plausible el intruso: mismo momento del cine
    const cerca = level > 6;
    const candidatos = DIRECTORES.filter((n) => {
      if (m.d.includes(n)) return false;
      if (!cerca) return true;
      return CON_DIRECTOR.some((o) => o.d.includes(n) && Math.abs(o.y - m.y) <= 6);
    });
    nombre = pick(candidatos.length ? candidatos : DIRECTORES.filter((n) => !m.d.includes(n)));
  }
  if (!nombre) return null;
  const real = m.d.length > 1 ? `La dirigieron ${m.d.join(' y ')}` : `La dirigió ${m.d[0]}`;
  return {
    tipo: 'director',
    pregunta: `¿Dirigió <b class="text-amber-400">${nombre}</b> esta película?`,
    modo: 'sino',
    cartas: [cartaPeli(m), cartaPersona(nombre, directorPhoto(nombre), 'Director')],
    correcta: verdadero,
    explica: `${real}.`,
    firma: `dir-${m.r}-${nombre}`,
  };
}

// ---- Reparto: ¿coincidieron estos dos actores? ----
function rondaActores(level) {
  const m = pick(CON_REPARTO);
  const cast = reparto(m);
  const juntos = coin();
  let a = pick(cast), b;
  if (juntos) {
    b = pick(cast.filter((n) => n !== a));
  } else {
    const hueco = Math.max(HUECO_SEGURO, Math.round(30 - level));
    const lejanas = CON_REPARTO.filter((o) => Math.abs(o.y - m.y) >= hueco);
    const ajenos = [...new Set(lejanas.flatMap(reparto))]
      .filter((n) => !(m.a || []).includes(n));
    if (!ajenos.length) return null;
    b = pick(ajenos);
  }
  if (!a || !b) return null;
  return {
    tipo: 'actores',
    pregunta: '¿Coincidieron estos dos actores en esta película?',
    modo: 'sino',
    cartas: [cartaPeli(m),
             cartaPersona(a, actorPhoto(a), 'Reparto'),
             cartaPersona(b, actorPhoto(b), 'Reparto')],
    correcta: juntos,
    explica: juntos ? `Sí: los dos están en ${m.t}.` : `No: ${b} no sale en ${m.t}.`,
    firma: `act-${m.r}-${a}-${b}`,
  };
}

// ---- Óscars: ¿ganó alguno? ----
function rondaOscar() {
  // se equilibra a propósito: sin esto saldría "no" tres de cada cuatro veces
  const conPremio = coin();
  const pool = CON_OSCAR.filter((m) => (m.o > 0) === conPremio);
  if (!pool.length) return null;
  const m = pick(pool);
  return {
    tipo: 'oscar',
    pregunta: '¿Ganó esta película algún Óscar?',
    modo: 'sino',
    cartas: [cartaPeli(m)],
    correcta: m.o > 0,
    explica: m.o > 0
      ? `Ganó ${m.o} ${m.o === 1 ? 'Óscar' : 'Óscars'}.`
      : 'No ganó ninguno.',
    firma: `osc-${m.r}`,
  };
}

const TIPOS = [
  { id: 'taquilla', peso: 3, crea: rondaTaquilla, hay: () => PELIS.length > 1 },
  { id: 'anio', peso: 2, crea: rondaAnio, hay: () => PELIS.length > 1 },
  { id: 'director', peso: 2, crea: rondaDirector, hay: () => CON_DIRECTOR.length > 1 },
  { id: 'actores', peso: 2, crea: rondaActores, hay: () => CON_REPARTO.length > 1 },
  { id: 'oscar', peso: 2, crea: rondaOscar, hay: () => CON_OSCAR.length > 1 },
];

// `categoria` la impone la casilla del tablero; sin ella se sortea por peso
function nuevaRonda(level, categoria) {
  const disponibles = TIPOS.filter((t) => t.hay());
  const forzado = categoria && TIPOS.find((t) => t.id === categoria && t.hay());
  for (let intento = 0; intento < 30; intento++) {
    const tipo = forzado || porPeso(disponibles);
    const r = tipo.crea(level);
    if (r && r.firma !== state.ultima) {
      state.ultima = r.firma;
      return r;
    }
  }
  return rondaTaquilla(level) || rondaOscar();
}

function porPeso(tipos) {
  const total = tipos.reduce((s, t) => s + t.peso, 0);
  let n = Math.random() * total;
  for (const t of tipos) {
    n -= t.peso;
    if (n <= 0) return t;
  }
  return tipos[tipos.length - 1];
}

/* ---------- pintado ---------- */

const COLS = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

// Con cinco tipos de ronda conviene decir de qué va antes de leer la pregunta
const ETIQUETAS = {
  taquilla: 'Taquilla',
  anio: 'Estrenos',
  director: 'Dirección',
  actores: 'Reparto',
  oscar: 'Óscars',
};

function cartaHTML(c, i, clicable) {
  const etiqueta = clicable ? 'button' : 'div';
  const extra = clicable
    ? 'choice cursor-pointer'
    : 'pointer-events-none';
  // En móvil la tarjeta ocupa el ancho y se estira. De tablet hacia arriba va a
  // tamaño fijo con proporción 2:3, la del cartel de cine. El tamaño de tablet es
  // el que permite tres tarjetas (rondas de reparto) sin desbordar los 640 px.
  // El alto lleva un tope en vh para que en pantallas bajas la tarjeta no
  // empuje el tablero fuera de la ventana; el recorte lo absorbe object-cover.
  const alto = c.retrato
    ? 'min-h-[200px] sm:h-[270px] sm:w-[180px] lg:h-[min(510px,56vh)] lg:w-[340px] sm:justify-self-center'
    : 'min-h-[220px] sm:h-[280px] sm:w-[186px] lg:h-[min(525px,58vh)] lg:w-[350px] sm:justify-self-center';
  return `
    <${etiqueta} ${clicable ? `data-index="${i}"` : ''} class="carta ${extra} group relative flex ${alto} flex-col justify-end overflow-hidden rounded-2xl border-4 border-neutral-800 bg-neutral-900 text-center transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default">
      <img class="js-img absolute inset-0 h-full w-full scale-105 object-cover ${c.retrato ? 'object-top' : ''} opacity-0 blur-[1px] brightness-[.55] saturate-[.9] transition-all duration-500 group-hover:brightness-75 group-hover:saturate-100" alt="" aria-hidden="true" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950/20"></div>
      <div class="relative flex flex-col items-center px-4 pb-5 pt-6">
        ${c.sub ? `<span class="mb-2 rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-xs font-medium text-neutral-300 backdrop-blur-sm">${c.sub}</span>` : ''}
        <span class="display text-xl leading-tight text-white drop-shadow-lg sm:text-lg lg:text-2xl">${c.titulo}</span>
        <span class="js-valor display mt-2 h-7 text-xl leading-none text-amber-400 opacity-0 transition-opacity duration-300 sm:text-lg lg:text-2xl"></span>
        ${clicable ? '<span class="mt-1 text-xs text-neutral-400 transition group-hover:text-amber-400">Pulsa para elegir</span>' : ''}
      </div>
    </${etiqueta}>`;
}

function pintaRonda(r) {
  const clicable = r.modo === 'elige';
  els.kind.textContent = ETIQUETAS[r.tipo] || '';
  els.question.innerHTML = r.pregunta;
  els.ask.classList.remove('ask-in');
  void els.ask.offsetWidth;
  els.ask.classList.add('ask-in');
  // sm:w-fit + mx-auto: las columnas se ajustan a la tarjeta y el grupo queda
  // centrado. Sin esto las tarjetas, ya pequeñas, se irían a los extremos.
  els.cards.className =
    'relative grid flex-1 grid-cols-1 gap-3 sm:mx-auto sm:w-fit sm:items-center sm:gap-4 lg:gap-6 ' +
    (COLS[r.cartas.length] || 'sm:grid-cols-2');
  els.cards.innerHTML = r.cartas.map((c, i) => cartaHTML(c, i, clicable)).join('');

  [...els.cards.querySelectorAll('.js-img')].forEach((img, i) => {
    const url = r.cartas[i].img;
    if (!url) return;                       // sin imagen la tarjeta se queda lisa
    img.onload = () => img.classList.remove('opacity-0');
    img.src = url;
  });

  // 'hidden' se queda siempre puesto: 'sm:block' lo levanta sólo de tablet
  // hacia arriba, que es donde las dos tarjetas están una al lado de la otra
  els.vs.classList.toggle('sm:block', clicable && r.cartas.length === 2);
  els.answers.classList.toggle('hidden', clicable);
  els.answers.classList.toggle('flex', !clicable);
  botones().forEach((b) => {
    b.disabled = false;
    b.classList.remove('border-emerald-400', 'border-red-500', 'bg-emerald-500/10',
      'bg-red-500/10', 'opacity-50');
    b.classList.add('border-neutral-800');
  });
  entradaTarjetas();
}

const tarjetas = () => [...els.cards.querySelectorAll('.carta')];
const botones = () => [...els.answers.querySelectorAll('.yesno')];

function entradaTarjetas() {
  tarjetas().forEach((card, i) => {
    card.style.animationDelay = `${i * STAGGER_MS}ms`;
    card.classList.add('card-in');
  });
}

// Cuenta ascendente hasta la cifra real
function countUp(el, target, dinero) {
  const start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / COUNT_MS, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = Math.round(target * eased);
    el.textContent = dinero ? fmtMoney(v) : String(v);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const GANA = ['border-emerald-400', 'bg-emerald-500/10'];
const PIERDE = ['border-red-500', 'bg-red-500/10'];

function revelaCartas(r) {
  tarjetas().forEach((card, i) => {
    const c = r.cartas[i];
    if (c.valor === undefined) return;
    const v = card.querySelector('.js-valor');
    v.classList.remove('opacity-0');
    if (c.dinero || r.tipo === 'anio') countUp(v, c.valor, c.dinero);
    else v.textContent = c.valor;
  });
}

/* ---------- tablero ---------- */

// Perímetro de la rejilla en sentido horario, empezando arriba a la izquierda
function perimetro(n) {
  const pos = [];
  for (let c = 1; c <= n; c++) pos.push([1, c]);
  for (let r = 2; r <= n; r++) pos.push([r, n]);
  for (let c = n - 1; c >= 1; c--) pos.push([n, c]);
  for (let r = n - 1; r >= 2; r--) pos.push([r, 1]);
  return pos;
}

const POSICIONES = perimetro(LADO);

function pintaTablero() {
  els.ring.innerHTML = POSICIONES.map((rc, i) => {
    const cat = TABLERO[i];
    const { claro, oscuro } = COLORES[cat];
    const aqui = i === state.casilla;
    const hecha = state.completadas.has(i);
    const elegible = state.destinos.includes(i);
    // La casilla se rellena entera con el color de su categoría. Las que no
    // están en juego bajan de intensidad para que las dos elegibles canten, y
    // las ya resueltas pierden el color del todo.
    const fondo = hecha
      ? 'linear-gradient(155deg, #1c1c1c, #0d0d0d)'
      : elegible
        ? `linear-gradient(155deg, ${claro}, ${oscuro})`
        : `linear-gradient(155deg, ${claro}59, ${oscuro}b3)`;
    return `
      <button data-casilla="${i}" ${elegible ? '' : 'disabled'}
        style="grid-row:${rc[0]};grid-column:${rc[1]};background:${fondo};--glow:${claro}99;
               border-color:${hecha ? '#2a2a2a' : elegible ? 'rgba(255,255,255,.75)' : claro + '3d'}"
        class="casilla group relative flex items-center justify-center overflow-hidden rounded-xl
               border transition duration-200
               ${elegible ? 'casilla-elegible cursor-pointer' : 'cursor-default'}
               focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label="${ETIQUETAS[cat]}${hecha ? ', completada' : ''}${aqui ? ', tu ficha está aquí' : ''}${elegible ? ', puedes ir aquí' : ''}">
        ${hecha ? '' : '<span class="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl bg-white/15"></span>'}
        <span class="display relative text-sm leading-none sm:text-lg"
              style="color:${hecha ? '#3f9d6a' : elegible ? 'rgba(0,0,0,.5)' : claro + 'cc'}">${hecha ? '✓' : INICIAL[cat]}</span>
        ${aqui ? fichaHTML() : ''}
      </button>`;
  }).join('') + centroHTML();
  pintaLeyenda();
}

// Ficha del jugador: un disco claro que se ve sobre cualquiera de los colores
const fichaHTML = () => `
  <span class="absolute inset-0 flex items-center justify-center">
    <span class="h-4 w-4 rounded-full bg-white ring-2 ring-neutral-900/50 sm:h-5 sm:w-5"
          style="box-shadow:0 0 14px rgba(255,255,255,.85)"></span>
  </span>`;

function caraHTML(valor) {
  if (!valor) {
    return '<span class="display text-3xl text-neutral-500 sm:text-4xl">?</span>';
  }
  const puntos = PUNTOS[valor] || [];
  return `<span class="grid h-full w-full grid-cols-3 grid-rows-3 gap-0.5 p-2">` +
    Array.from({ length: 9 }, (_, k) =>
      `<span class="flex items-center justify-center">${
        puntos.includes(k + 1)
          ? '<span class="h-1.5 w-1.5 rounded-full bg-neutral-900 sm:h-2 sm:w-2"></span>'
          : ''}</span>`).join('') + '</span>';
}

function centroHTML() {
  return `
    <div style="grid-row:2/${LADO};grid-column:2/${LADO}"
         class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-800
                bg-neutral-950/70 p-3 backdrop-blur-sm">
      <div id="dado"
           class="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 sm:h-20 sm:w-20
                  ${state.dado ? 'pop' : ''}"
           style="box-shadow:0 8px 24px rgba(0,0,0,.6), inset 0 -4px 0 rgba(0,0,0,.12)"
           aria-label="${state.dado ? 'Has sacado ' + state.dado : 'Dado sin tirar'}">
        ${caraHTML(state.dado)}
      </div>
      <button id="tirar" ${state.destinos.length ? 'disabled' : ''}
              class="rounded-xl bg-amber-400 px-5 py-2 text-sm font-semibold text-neutral-900 shadow-lg
                     shadow-amber-500/20 transition hover:bg-amber-300 focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-amber-200
                     disabled:cursor-default disabled:opacity-40 disabled:shadow-none">
        Tirar el dado
      </button>
      <p id="tablero-msg" class="text-balance px-1 text-center text-xs leading-snug text-neutral-400"></p>
      <p class="text-[11px] font-semibold text-neutral-500">
        <span class="text-amber-400">${state.completadas.size}</span> / ${CASILLAS} completadas
      </p>
    </div>`;
}

function pintaLeyenda() {
  els.leyenda.innerHTML = CATEGORIAS.map((cat) => {
    const { claro } = COLORES[cat];
    const activa = state.destinos.some((i) => TABLERO[i] === cat);
    const total = TABLERO.filter((c) => c === cat).length;
    const hechas = TABLERO.filter((c, i) => c === cat && state.completadas.has(i)).length;
    const listo = hechas === total;
    return `<span class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition"
      style="border-color:${claro}${activa ? 'cc' : '33'};background:${claro}${activa ? '2e' : '14'};
             color:${claro};opacity:${listo ? '.4' : '1'}">
      <span class="h-2 w-2 rounded-full" style="background:${claro}"></span>${ETIQUETAS[cat]}
      <span class="tabular-nums opacity-70">${hechas}/${total}</span></span>`;
  }).join('');
}

function muestraTablero() {
  els.trivial.classList.remove('hidden');
  els.trivial.classList.add('flex');
  els.board.classList.add('hidden');
  els.board.classList.remove('flex');
  state.destinos = [];
  pintaTablero();
  const quedan = CASILLAS - state.completadas.size;
  mensajeTablero(quedan === 1
    ? '¡Queda una casilla! Tira el dado.'
    : `Tira el dado. Quedan ${quedan} casillas.`);
}

const mensajeTablero = (t) => {
  const el = document.getElementById('tablero-msg');
  if (el) el.textContent = t;
};

// Las casillas completadas son transparentes al movimiento: el dado cuenta sólo
// las pendientes. Así siempre queda jugada posible, que es lo que se rompería si
// una tirada pudiera dejarte apuntando a casillas ya resueltas.
function avanza(desde, pasos, sentido) {
  let i = desde, contadas = 0;
  const tope = CASILLAS * (pasos + 1);
  for (let n = 0; n < tope && contadas < pasos; n++) {
    i = (i + sentido + CASILLAS) % CASILLAS;
    if (!state.completadas.has(i)) contadas++;
  }
  return contadas === pasos ? i : null;
}

// Las dos casillas alcanzables, una por sentido. Es lo que convierte la tirada
// en una decisión y no en un trámite.
function destinosDe(desde, pasos) {
  const a = avanza(desde, pasos, 1);
  const b = avanza(desde, pasos, -1);
  const unicos = [...new Set([a, b].filter((x) => x !== null))];
  return unicos;
}

function tiraDado() {
  const boton = document.getElementById('tirar');
  const dado = document.getElementById('dado');
  if (!boton || boton.disabled || state.destinos.length) return;
  boton.disabled = true;
  boton.classList.add('opacity-40');
  dado.classList.add('dado-gira');
  mensajeTablero('…');

  const giro = setInterval(() => { dado.innerHTML = caraHTML(1 + rnd(CARAS)); }, 80);
  setTimeout(() => {
    clearInterval(giro);
    dado.classList.remove('dado-gira');
    state.dado = 1 + rnd(CARAS);
    state.destinos = destinosDe(state.casilla, state.dado);
    pintaTablero();          // el número lo pinta el estado, no este trozo
    mensajeTablero(`Has sacado ${state.dado}. Elige hacia dónde ir.`);
    // se preparan las dos preguntas posibles para que al elegir no haya espera
    state.pendientes = {};
    state.destinos.forEach((i) => {
      const r = nuevaRonda(state.score + 1, TABLERO[i]);
      state.pendientes[i] = r;
      precarga(r);
    });
  }, GIRO_MS);
}

function eligeCasilla(destino) {
  if (!state.destinos.includes(destino)) return;
  const ronda = state.pendientes[destino];
  state.destinos = [];
  // la ficha recorre el camino paso a paso para que se vea por dónde va
  const sentido = avanza(state.casilla, state.dado, 1) === destino ? 1 : -1;
  const salto = () => {
    state.casilla = (state.casilla + sentido + CASILLAS) % CASILLAS;
    pintaTablero();
    if (state.casilla !== destino) return setTimeout(salto, PASO_MS);
    setTimeout(() => lanzaPregunta(ronda), PASO_MS * 2);
  };
  salto();
}

function lanzaPregunta(ronda) {
  els.trivial.classList.add('hidden');
  els.trivial.classList.remove('flex');
  els.board.classList.remove('hidden');
  els.board.classList.add('flex');
  state.ronda = ronda;
  mountRound();
}

function volverAlTablero() {
  clearTimeout(state.timer);
  tarjetas().forEach((card) => card.classList.add('card-out'));
  state.timer = setTimeout(() => {
    hideToast();
    muestraTablero();
  }, OUT_MS);
}

/* ---------- cuenta atrás ---------- */

// La barra se pinta a mano en cada fotograma en vez de con una transición CSS
// porque el mismo reloj decide los puntos: así lo que se ve y lo que se cobra
// salen del mismo sitio y no pueden desincronizarse.
function arrancaCronometro() {
  paraCronometro();
  state.t0 = performance.now();
  state.corriendo = true;
  pintaBarra(1);
  const paso = (ahora) => {
    const queda = Math.max(0, 1 - (ahora - state.t0) / TIEMPO);
    pintaBarra(queda);
    if (queda <= 0) return tiempoAgotado();
    state.raf = requestAnimationFrame(paso);
  };
  state.raf = requestAnimationFrame(paso);
}

// Devuelve los milisegundos consumidos y detiene la cuenta
function paraCronometro() {
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = 0;
  const ms = state.corriendo ? performance.now() - state.t0 : TIEMPO;
  state.corriendo = false;
  return ms;
}

function pintaBarra(fraccion) {
  els.bar.style.transform = `scaleX(${fraccion})`;
  const color = fraccion > 0.5 ? 'bg-amber-400'
    : fraccion > 0.25 ? 'bg-orange-500'
    : 'bg-red-500';
  els.bar.className =
    `h-full w-full origin-left rounded-full transition-colors duration-200 ${color}`;
}

// Responder al instante vale PUNTOS_MAX; agotar el tiempo, 0
const puntosPor = (ms) =>
  Math.max(0, Math.round(PUNTOS_MAX * (1 - Math.min(ms, TIEMPO) / TIEMPO)));

/* ---------- vidas ---------- */

// Tres puntos: los gastados quedan como aro vacío. `perdida` late al apagarse
// para que el fallo se note también arriba, no sólo en el tablero.
function pintaVidas(perdida) {
  els.lives.innerHTML = '';
  for (let i = 0; i < VIDAS; i++) {
    const viva = i < state.vidas;
    const d = document.createElement('span');
    d.className = 'h-2.5 w-2.5 rounded-full border-2 transition-colors duration-300 ' +
      (viva ? 'border-amber-400 bg-amber-400' : 'border-neutral-700 bg-transparent');
    if (perdida && i === state.vidas) d.classList.add('life-out');
    els.lives.appendChild(d);
  }
  els.lives.setAttribute('aria-label',
    `${state.vidas} de ${VIDAS} vidas`);
}

/* ---------- aviso superpuesto ---------- */

const ACIERTOS = ['¡Correcto!', '¡Bien!', '¡Eso es!', '¡Exacto!', '¡Muy bien!'];
const TOAST_STYLES = {
  ok:   { box: ['border-emerald-400/40', 'shadow-emerald-500/20'], msg: 'text-emerald-400' },
  fail: { box: ['border-red-400/40', 'shadow-red-500/20'], msg: 'text-red-400' },
};

// Sube de 0 a los puntos ganados. Frena al final (misma curva que el contador
// de recaudación) y cabe de sobra en lo que dura el aviso.
const PUNTOS_MS = 700;

function cuentaPuntos(total) {
  const el = els.toastPoints;
  el.classList.remove('hidden');
  const inicio = performance.now();
  const paso = (ahora) => {
    const p = Math.min((ahora - inicio) / PUNTOS_MS, 1);
    el.textContent = '+' + Math.round(total * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function showToast(kind, msg, sub, puntos) {
  const style = TOAST_STYLES[kind];
  els.toastBox.className =
    'max-w-[85%] rounded-2xl border bg-neutral-950/85 px-7 py-4 text-center ' +
    'shadow-2xl backdrop-blur-md ' + style.box.join(' ');
  els.toastMsg.className = 'display text-4xl leading-none sm:text-5xl ' + style.msg;
  els.toastMsg.textContent = msg;
  els.toastSub.textContent = sub || '';
  els.toastPoints.classList.add('hidden');
  els.toastPoints.textContent = '';
  els.toast.classList.remove('toast-show');
  void els.toast.offsetWidth;
  els.toast.style.animationDuration = `${TOAST_MS}ms`;
  els.toast.classList.add('toast-show');
  if (typeof puntos === 'number') cuentaPuntos(puntos);
}

const hideToast = () => els.toast.classList.remove('toast-show');

/* ---------- juego ---------- */

function responde(eleccion) {
  if (state.locked) return;
  resuelve(eleccion === state.ronda.correcta, paraCronometro());
}

function tiempoAgotado() {
  if (state.locked) return;
  paraCronometro();
  pintaBarra(0);
  resuelve(false, TIEMPO, true);
}

function resuelve(correcto, ms, agotado) {
  state.locked = true;
  const r = state.ronda;

  tarjetas().forEach((c) => (c.disabled = true));
  botones().forEach((b) => (b.disabled = true));
  revelaCartas(r);

  if (r.modo === 'elige') {
    tarjetas().forEach((card, i) => {
      card.classList.remove('border-neutral-800');
      card.classList.add(...(i === r.correcta ? GANA : PIERDE));
      card.classList.add(i === r.correcta ? 'pop' : 'shake');
      if (i !== r.correcta) card.classList.add('opacity-60');
    });
  } else {
    botones().forEach((b) => {
      const esta = b.dataset.answer === '1';
      b.classList.remove('border-neutral-800');
      b.classList.add(...(esta === r.correcta ? GANA : PIERDE));
      if (esta !== r.correcta) b.classList.add('opacity-50');
    });
    tarjetas().forEach((c) => c.classList.add(correcto ? 'pop' : 'shake'));
  }

  const detalle = r.explica || explicaDuelo(r);
  if (correcto) {
    const ganados = puntosPor(ms);
    state.score++;
    state.puntos += ganados;
    els.score.textContent = state.score;
    els.points.textContent = state.puntos;
    if (state.puntos > state.best) {
      state.best = state.puntos;
      state.newRecord = true;
      try { localStorage.setItem(BEST_KEY, String(state.best)); } catch (e) { /* modo privado */ }
    }
    [els.points, els.score].forEach((el) => {
      el.classList.remove('score-bump');
      void el.offsetWidth;
      el.classList.add('score-bump');
    });
    const hito = state.score % 5 === 0;
    showToast('ok',
      hito ? `¡${state.score} seguidas!` : ACIERTOS[state.score % ACIERTOS.length],
      detalle,
      ganados);
    state.completadas.add(state.casilla);
    state.timer = setTimeout(
      state.completadas.size === CASILLAS ? victoria : volverAlTablero, REVEAL_MS);
  } else {
    state.vidas--;
    pintaVidas(true);
    const titulo = agotado ? '¡Tiempo!' : '¡Fallaste!';
    if (state.vidas > 0) {
      const quedan = state.vidas === 1 ? 'Te queda 1 vida' : `Te quedan ${state.vidas} vidas`;
      showToast('fail', titulo, `${detalle} · ${quedan}`);
      state.timer = setTimeout(volverAlTablero, GAMEOVER_MS);
    } else {
      showToast('fail', 'Sin vidas', detalle);
      state.timer = setTimeout(() => gameOver(detalle), GAMEOVER_MS);
    }
  }
}

function explicaDuelo(r) {
  const [a, b] = r.cartas;
  const gana = r.cartas[r.correcta];
  if (r.tipo === 'taquilla') {
    const diff = Math.abs(a.valor - b.valor);
    return `${gana.titulo} recaudó ${fmtMoney(diff)} más.`;
  }
  return `${gana.titulo} se estrenó en ${gana.valor}.`;
}

function mountRound() {
  hideToast();
  state.round = state.score + 1;
  pintaRonda(state.ronda);
  state.locked = false;
  pintaBarra(1);
  arrancaCronometro();
}

function precarga(r) {
  if (!r) return;
  r.cartas.forEach((c) => { if (c.img) new Image().src = c.img; });
}

function victoria() {
  clearTimeout(state.timer);
  hideToast();
  els.goTitle.textContent = '¡Tablero completo!';
  els.goTitle.className = 'display text-xl text-emerald-400';
  els.goScore.textContent = state.puntos;
  els.goLabel.textContent = `puntos · las ${CASILLAS} casillas completadas`;
  els.goDetail.innerHTML =
    `Has completado el tablero con <strong class="text-neutral-100">${state.vidas}</strong> ` +
    `${state.vidas === 1 ? 'vida' : 'vidas'} de sobra.` +
    (state.newRecord
      ? '<br><span class="text-emerald-400">¡Nuevo récord!</span>'
      : `<br><span class="text-neutral-500">Tu récord: ${state.best} puntos</span>`);
  els.gameover.classList.remove('hidden');
  els.gameover.classList.add('flex');
  els.restart.focus();
}

function gameOver(detalle) {
  paraCronometro();
  els.goTitle.textContent = 'Fin de la partida';
  els.goTitle.className = 'display text-xl text-neutral-400';
  els.goScore.textContent = state.puntos;
  els.goLabel.textContent =
    `puntos · ${state.completadas.size} de ${CASILLAS} casillas`;
  els.goDetail.innerHTML = detalle +
    (state.newRecord
      ? '<br><span class="text-emerald-400">¡Nuevo récord!</span>'
      : `<br><span class="text-neutral-500">Tu récord: ${state.best} puntos</span>`);
  els.gameover.classList.remove('hidden');
  els.gameover.classList.add('flex');
  els.restart.focus();
}

function startGame() {
  paraCronometro();
  state.score = 0;
  state.puntos = 0;
  state.vidas = VIDAS;
  state.round = 1;
  state.ronda = null;
  state.next = null;
  state.ultima = '';
  state.casilla = 0;
  state.completadas = new Set();
  state.dado = 0;
  state.destinos = [];
  state.pendientes = {};
  state.ronda = null;
  state.newRecord = false;
  els.score.textContent = '0';
  els.points.textContent = '0';
  pintaVidas(false);
  els.gameover.classList.add('hidden');
  els.gameover.classList.remove('flex');
  muestraTablero();
}

/* ---------- eventos ---------- */

els.ring.addEventListener('click', (e) => {
  if (e.target.closest('#tirar')) return tiraDado();
  const casilla = e.target.closest('.casilla');
  if (casilla && !casilla.disabled) eligeCasilla(Number(casilla.dataset.casilla));
});

els.cards.addEventListener('click', (e) => {
  const card = e.target.closest('.choice');
  if (card) responde(Number(card.dataset.index));
});

els.answers.addEventListener('click', (e) => {
  const b = e.target.closest('.yesno');
  if (b) responde(b.dataset.answer === '1');
});

els.restart.addEventListener('click', startGame);

const introVisible = () => !els.intro.classList.contains('hidden');

function closeIntro() {
  els.intro.classList.add('hidden');
  els.intro.classList.remove('flex');
  // El reloj sólo corre durante una pregunta, y al cerrar la intro lo que
  // aparece es el tablero.
}

els.play.addEventListener('click', closeIntro);

document.addEventListener('keydown', (e) => {
  if (introVisible()) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeIntro(); }
    return;
  }
  if (!els.gameover.classList.contains('hidden')) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
    return;
  }
  if (!els.trivial.classList.contains('hidden')) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tiraDado(); }
    return;
  }
  const r = state.ronda;
  if (!r) return;
  if (r.modo === 'elige') {
    if (e.key === 'ArrowLeft' || e.key === '1') responde(0);
    if (e.key === 'ArrowRight' || e.key === '2') responde(1);
  } else {
    if (e.key === 'ArrowLeft' || e.key === '1' || e.key.toLowerCase() === 's') responde(true);
    if (e.key === 'ArrowRight' || e.key === '2' || e.key.toLowerCase() === 'n') responde(false);
  }
});

try {
  state.best = Number(localStorage.getItem(BEST_KEY)) || 0;
} catch (e) { state.best = 0; }
els.introBest.textContent = state.best > 0 ? `Tu récord: ${state.best} puntos` : '';

// Prepara la primera ronda por detrás: al cerrar la intro el tablero ya está listo
startGame();
els.play.focus();
