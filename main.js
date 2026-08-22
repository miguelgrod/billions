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

// ---- Campo de burbujas ----
// Veinte burbujas repartidas por la pantalla, cuatro de cada categoría. No hay
// recorrido ni ficha: cada turno un sorteo las va agrandando al azar hasta
// detenerse en una, y esa plantea la pregunta.
const BURBUJAS = 20;
const CATEGORIAS = ['taquilla', 'anio', 'director', 'actores', 'oscar'];
const COLUMNAS = 5;
const FILAS = 4;
const VER_MS = 1400;       // el tablero se ve un rato antes de sortear
const SORTEO_MS = 3400;    // lo que dura el sorteo, de principio a fin
const ELEGIDA_MS = 1100;   // la elegida se luce antes de abrir la pregunta
const SALTOS = 22;         // cuántas burbujas se encienden antes de parar

// Colores de sistema de Apple en modo oscuro. Cada esfera se pinta con tres
// paradas —luz, color y sombra— para que tenga volumen sin necesidad de brillos
// añadidos: es lo que hace que se lean como cuerpos y no como círculos planos.
const COLORES = {
  taquilla: '#FF9F0A',
  anio:     '#0A84FF',
  director: '#BF5AF2',
  actores:  '#30D158',
  oscar:    '#FF375F',
};
const ESFERA = {
  taquilla: { luz: '#FFE3B0', medio: '#FF9F0A', hondo: '#C2600A' },
  anio:     { luz: '#BEDCFF', medio: '#0A84FF', hondo: '#0A46B4' },
  director: { luz: '#EBCCFF', medio: '#BF5AF2', hondo: '#7B2BB0' },
  actores:  { luz: '#B8F5CC', medio: '#30D158', hondo: '#12833A' },
  oscar:    { luz: '#FFC2CF', medio: '#FF375F', hondo: '#B01038' },
};
const FADE_MS = 1000;      // fundido de entrada de la pregunta

const els = {
  trivial: document.getElementById('trivial'),
  burbujas: document.getElementById('burbujas'),
  rotulo: document.getElementById('rotulo'),
  rotuloCaja: document.getElementById('rotulo-caja'),
  rotuloTxt: document.getElementById('rotulo-txt'),
  estado: document.getElementById('estado'),
  leyenda: document.getElementById('leyenda'),
  ask: document.getElementById('ask'),
  board: document.getElementById('board'),
  question: document.getElementById('question'),
  kind: document.getElementById('round-kind'),
  cards: document.getElementById('cards'),
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
  campo: [],            // posición, tamaño y categoría de cada burbuja
  completadas: new Set(),   // burbujas ya acertadas: se apagan
  actual: null,         // burbuja que ha salido en el sorteo
  resaltada: null,      // burbuja encendida durante el sorteo
  sorteando: false,
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

// Los nombres propios van resaltados dentro del enunciado: la pregunta dice de
// qué película o de quién habla, en vez de remitir a las tarjetas.
const nom = (t) => `<b class="font-semibold text-white">${t}</b>`;

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
        pregunta: `¿Qué recaudó más en todo el mundo, ${nom(x.t)} o ${nom(y.t)}?`,
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
        pregunta: `¿Qué se estrenó antes, ${nom(x.t)} o ${nom(y.t)}?`,
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
    pregunta: `¿Dirigió ${nom(nombre)} la película ${nom(m.t)}?`,
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
    pregunta: `¿Coincidieron ${nom(a)} y ${nom(b)} en ${nom(m.t)}?`,
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
    pregunta: `¿Ganó ${nom(m.t)} algún Óscar?`,
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

// `categoria` la impone la burbuja que sale en el sorteo; sin ella se sortea por peso
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
  const alto = c.retrato
    ? 'min-h-[200px] sm:h-[270px] sm:w-[180px] lg:h-[405px] lg:w-[270px] sm:justify-self-center'
    : 'min-h-[220px] sm:h-[280px] sm:w-[186px] lg:h-[min(500px,56vh)] lg:w-[334px] sm:justify-self-center';
  return `
    <${etiqueta} ${clicable ? `data-index="${i}"` : ''}
      class="carta ${clicable ? 'choice foco cursor-pointer' : 'pointer-events-none'}
             group relative flex ${alto} flex-col justify-end overflow-hidden rounded-[26px]
             border border-white/10 bg-white/[.06] text-center shadow-[0_18px_50px_rgba(0,0,0,.55)]">
      <img class="js-img absolute inset-0 h-full w-full scale-105 object-cover ${c.retrato ? 'object-top' : ''}
                  opacity-0 brightness-[.62] saturate-[.95] transition-all duration-500
                  group-hover:brightness-90 group-hover:saturate-100"
           alt="" aria-hidden="true" />
      <div class="pointer-events-none absolute inset-0"
           style="background:linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.1) 100%)"></div>
      <div class="relative flex flex-col items-center px-4 pb-5 pt-6">
        ${c.sub ? `<span class="mb-2 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/80 backdrop-blur-sm">${c.sub}</span>` : ''}
        <span class="tight text-lg font-semibold leading-tight text-white lg:text-2xl">${c.titulo}</span>
        <span class="js-valor display mt-2 h-7 text-lg leading-none text-[#FF9F0A] opacity-0 transition-opacity duration-300 lg:text-2xl"></span>
        ${clicable ? '<span class="mt-1 text-[11px] text-white/45 transition group-hover:text-white/80">Pulsa para elegir</span>' : ''}
      </div>
    </${etiqueta}>`;
}

function pintaRonda(r) {
  const clicable = r.modo === 'elige';
  els.kind.textContent = ETIQUETAS[r.tipo] || '';
  els.kind.style.color = COLORES[r.tipo] || '#fff';
  els.question.innerHTML = r.pregunta;
  els.ask.classList.remove('ask-in');
  void els.ask.offsetWidth;
  els.ask.classList.add('ask-in');
  // sm:w-fit + mx-auto: las columnas se ajustan a la tarjeta y el grupo queda
  // centrado. Sin esto las tarjetas, ya pequeñas, se irían a los extremos.
  els.cards.className =
    'relative grid flex-1 grid-cols-1 gap-3 sm:mx-auto sm:w-fit sm:items-center sm:gap-4 lg:gap-5 ' +
    (COLS[r.cartas.length] || 'sm:grid-cols-2');
  els.cards.innerHTML = r.cartas.map((c, i) => cartaHTML(c, i, clicable)).join('');

  [...els.cards.querySelectorAll('.js-img')].forEach((img, i) => {
    const url = r.cartas[i].img;
    if (!url) return;                       // sin imagen la tarjeta se queda lisa
    img.onload = () => img.classList.remove('opacity-0');
    img.src = url;
  });

  els.answers.classList.toggle('hidden', clicable);
  els.answers.classList.toggle('flex', !clicable);
  botones().forEach((b) => {
    b.disabled = false;
    desmarca(b);
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

const COLOR_OK = '#30D158';
const COLOR_MAL = '#FF375F';

// El borde se marca con estilo en línea y no con clases: la superficie de
// cristal define su propio borde en el CSS y una clase de Tailwind podría
// quedar por debajo en la cascada.
function marca(el, ok) {
  el.style.borderColor = ok ? COLOR_OK : COLOR_MAL;
  el.style.background = ok ? 'rgba(48,209,88,.16)' : 'rgba(255,55,95,.16)';
}

function desmarca(el) {
  el.style.borderColor = '';
  el.style.background = '';
  el.style.opacity = '';
}

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

/* ---------- campo de burbujas ---------- */

// Rejilla con desorden: cada burbuja nace en su celda y se desplaza un poco al
// azar. Se ve repartido por la pantalla y, a diferencia de un sorteo libre de
// posiciones, nunca se solapan.
function reparteBurbujas() {
  const cats = [];
  for (let i = 0; i < BURBUJAS; i++) cats.push(CATEGORIAS[i % CATEGORIAS.length]);
  barajaEnSitio(cats);

  const campo = [];
  for (let f = 0; f < FILAS; f++) {
    for (let c = 0; c < COLUMNAS; c++) {
      const i = f * COLUMNAS + c;
      campo.push({
        cat: cats[i],
        x: ((c + 0.5) / COLUMNAS) * 100 + (Math.random() - 0.5) * 6,
        y: ((f + 0.5) / FILAS) * 100 + (Math.random() - 0.5) * 9,
        escala: 0.8 + Math.random() * 0.42,
        // deriva: dirección y ritmo propios, lentos, para que el campo fluya
        dx: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 14),
        dy: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 14),
        dur: 20 + Math.random() * 16,
        retardo: -Math.random() * 20,
      });
    }
  }
  return campo;
}

function barajaEnSitio(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function pintaBurbujas() {
  els.burbujas.innerHTML = state.campo.map((b, i) => {
    const { luz, medio, hondo } = ESFERA[b.cat];
    const hecha = state.completadas.has(i);
    const encendida = i === state.resaltada;
    const elegida = i === state.actual;
    const destacada = encendida || elegida;
    // Las pequeñas se desenfocan un poco: da profundidad, como en una foto con
    // poca distancia de enfoque. La destacada siempre entra a foco.
    const desenfoque = destacada ? 0 : Math.max(0, (1.08 - b.escala) * 6).toFixed(1);
    const escala = elegida ? 1.5 : encendida ? 1.3 : 1;
    const fondo = hecha
      ? 'radial-gradient(circle at 32% 26%, rgba(255,255,255,.16), rgba(255,255,255,.05) 70%)'
      : `radial-gradient(circle at 32% 26%, ${luz} 0%, ${medio} 46%, ${hondo} 100%)`;
    const sombra = hecha
      ? '0 18px 40px -18px rgba(0,0,0,.6)'
      : `0 26px 54px -14px ${medio}5c, 0 6px 18px -6px rgba(0,0,0,.5)`;
    return `
      <div class="burbuja deriva absolute"
           style="left:${b.x}%;top:${b.y}%;--dx:${b.dx}px;--dy:${b.dy}px;
                  --dur:${b.dur}s;--retardo:${b.retardo}s;
                  z-index:${elegida ? 30 : encendida ? 20 : 10}">
        <div data-burbuja="${i}"
             class="esfera ${elegida ? 'esfera-elegida' : ''}"
             style="width:clamp(52px, ${11 * b.escala}vw, ${112 * b.escala}px);aspect-ratio:1;
                    background:${fondo};
                    --sombra:${sombra};--halo:${medio}55;
                    box-shadow:${sombra};
                    scale:${escala};
                    filter:blur(${desenfoque}px);
                    opacity:${hecha ? .28 : destacada ? 1 : .92}"
             role="img" aria-label="${ETIQUETAS[b.cat]}${hecha ? ', completada' : ''}"></div>
      </div>`;
  }).join('');
  pintaLeyenda();
}

// Rótulo con la temática de la burbuja que ha salido
function muestraRotulo(cat) {
  els.rotuloTxt.textContent = ETIQUETAS[cat];
  els.rotuloTxt.style.color = COLORES[cat];
  els.rotulo.classList.remove('hidden');
  els.rotulo.classList.add('flex');
  els.rotuloCaja.classList.remove('rotulo-in');
  void els.rotuloCaja.offsetWidth;
  els.rotuloCaja.classList.add('rotulo-in');
}

function ocultaRotulo() {
  els.rotulo.classList.add('hidden');
  els.rotulo.classList.remove('flex');
}

function pintaLeyenda() {
  els.leyenda.innerHTML = CATEGORIAS.map((cat) => {
    const color = COLORES[cat];
    const total = state.campo.filter((b) => b.cat === cat).length;
    const hechas = state.campo.filter((b, i) => b.cat === cat && state.completadas.has(i)).length;
    const listo = total && hechas === total;
    return `<span class="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
      style="opacity:${listo ? '.35' : '1'}">
      <span class="h-2 w-2 rounded-full" style="background:${color}"></span>
      <span class="text-white/80">${ETIQUETAS[cat]}</span>
      <span class="tabular-nums text-white/40">${hechas}/${total}</span></span>`;
  }).join('');
}

function muestraTablero() {
  els.trivial.classList.remove('hidden');
  els.trivial.classList.add('flex');
  els.board.classList.add('hidden');
  els.board.classList.remove('flex');
  state.actual = null;
  state.resaltada = null;
  ocultaRotulo();
  pintaBurbujas();
  const quedan = BURBUJAS - state.completadas.size;
  els.estado.textContent = quedan === 1
    ? 'Queda una burbuja…'
    : `Quedan ${quedan} burbujas…`;
  // el sorteo arranca solo: no hay nada que pulsar
  state.timer = setTimeout(sorteo, VER_MS);
}

// Reparte SORTEO_MS entre los saltos con una curva cúbica: rápido al principio
// y muy lento al final. Al normalizar por la suma, el sorteo dura exactamente lo
// previsto por muchos saltos que se den.
function tiemposSorteo() {
  const pesos = Array.from({ length: SALTOS },
    (_, n) => 1 + Math.pow((n + 1) / SALTOS, 3) * 6);
  const suma = pesos.reduce((a, b) => a + b, 0);
  return pesos.map((p) => (p / suma) * SORTEO_MS);
}

// Va encendiendo burbujas al azar y frena hasta pararse en una. Sólo entran las
// pendientes: las ya acertadas están fuera del sorteo.
function sorteo() {
  const pendientes = state.campo
    .map((_, i) => i)
    .filter((i) => !state.completadas.has(i));
  if (!pendientes.length) return victoria();

  state.sorteando = true;
  els.estado.textContent = 'Eligiendo pregunta…';
  const tiempos = tiemposSorteo();
  let n = 0;
  const paso = () => {
    let siguiente;
    do { siguiente = pick(pendientes); }
    while (pendientes.length > 1 && siguiente === state.resaltada);
    state.resaltada = siguiente;
    pintaBurbujas();
    if (++n < SALTOS) {
      state.timer = setTimeout(paso, tiempos[n]);
    } else {
      state.sorteando = false;
      state.actual = state.resaltada;
      state.resaltada = null;
      pintaBurbujas();
      const cat = state.campo[state.actual].cat;
      els.estado.textContent = ETIQUETAS[cat];
      muestraRotulo(cat);
      const ronda = nuevaRonda(state.score + 1, state.campo[state.actual].cat);
      precarga(ronda);
      state.timer = setTimeout(() => lanzaPregunta(ronda), ELEGIDA_MS);
    }
  };
  paso();
}

function lanzaPregunta(ronda) {
  ocultaRotulo();
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
  els.bar.style.background = fraccion > 0.5 ? '#30D158'
    : fraccion > 0.25 ? '#FF9F0A'
    : '#FF375F';
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
    d.className = 'h-2 w-2 rounded-full transition-colors duration-300 ' +
      (viva ? 'bg-white' : 'bg-white/20');
    if (perdida && i === state.vidas) d.classList.add('life-out');
    els.lives.appendChild(d);
  }
  els.lives.setAttribute('aria-label',
    `${state.vidas} de ${VIDAS} vidas`);
}

/* ---------- aviso superpuesto ---------- */

const ACIERTOS = ['¡Correcto!', '¡Bien!', '¡Eso es!', '¡Exacto!', '¡Muy bien!'];
const TOAST_STYLES = {
  ok:   { borde: 'rgba(48,209,88,.45)',  msg: '#30D158' },
  fail: { borde: 'rgba(255,55,95,.45)', msg: '#FF375F' },
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
  els.toastBox.style.borderColor = style.borde;
  els.toastMsg.style.color = style.msg;
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
      marca(card, i === r.correcta);
      card.classList.add(i === r.correcta ? 'pop' : 'shake');
      if (i !== r.correcta) card.style.opacity = '.55';
    });
  } else {
    botones().forEach((b) => {
      const esta = b.dataset.answer === '1';
      marca(b, esta === r.correcta);
      if (esta !== r.correcta) b.style.opacity = '.45';
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
    state.completadas.add(state.actual);
    state.timer = setTimeout(
      state.completadas.size === BURBUJAS ? victoria : volverAlTablero, REVEAL_MS);
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
  pintaBarra(1);
  // Durante el fundido no se puede responder ni corre el reloj: sería injusto
  // descontar tiempo de una pregunta que todavía no se lee.
  state.locked = true;
  els.board.classList.remove('fundido');
  void els.board.offsetWidth;
  els.board.classList.add('fundido');
  state.timer = setTimeout(() => {
    state.locked = false;
    arrancaCronometro();
  }, FADE_MS);
}

function precarga(r) {
  if (!r) return;
  r.cartas.forEach((c) => { if (c.img) new Image().src = c.img; });
}

function victoria() {
  clearTimeout(state.timer);
  hideToast();
  els.goTitle.textContent = '¡Tablero completo!';
  els.goTitle.className = 'text-sm font-medium text-[#30D158]';
  els.goScore.textContent = state.puntos;
  els.goLabel.textContent = `puntos · las ${BURBUJAS} burbujas completadas`;
  els.goDetail.innerHTML =
    `Has vaciado la pantalla con <strong class="text-white">${state.vidas}</strong> ` +
    `${state.vidas === 1 ? 'vida' : 'vidas'} de sobra.` +
    (state.newRecord
      ? '<br><span class="text-[#30D158]">¡Nuevo récord!</span>'
      : `<br><span class="text-white/40">Tu récord: ${state.best} puntos</span>`);
  els.gameover.classList.remove('hidden');
  els.gameover.classList.add('flex');
  els.restart.focus();
}

function gameOver(detalle) {
  paraCronometro();
  els.goTitle.textContent = 'Fin de la partida';
  els.goTitle.className = 'text-sm font-medium text-white/50';
  els.goScore.textContent = state.puntos;
  els.goLabel.textContent =
    `puntos · ${state.completadas.size} de ${BURBUJAS} burbujas`;
  els.goDetail.innerHTML = detalle +
    (state.newRecord
      ? '<br><span class="text-[#30D158]">¡Nuevo récord!</span>'
      : `<br><span class="text-white/40">Tu récord: ${state.best} puntos</span>`);
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
  state.campo = reparteBurbujas();
  state.completadas = new Set();
  state.actual = null;
  state.resaltada = null;
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
  if (!els.trivial.classList.contains('hidden')) return;   // el sorteo va solo
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
