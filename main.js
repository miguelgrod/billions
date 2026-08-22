// Billions — preguntas de cine: taquilla, estrenos, directores, repartos y Óscars
// Datos en movies.js · imágenes en posters.js, directors.js y actors.js

const BEST_KEY = 'billions.best';
const REVEAL_MS = 2800;    // tiempo para leer la respuesta antes de la ronda siguiente
const GAMEOVER_MS = 3200;  // tiempo para leerla antes de la pantalla de fin
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

const els = {
  question: document.getElementById('question'),
  cards: document.getElementById('cards'),
  vs: document.getElementById('vs'),
  answers: document.getElementById('answers'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  gameover: document.getElementById('gameover'),
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
  toastSub: document.getElementById('toast-sub'),
};

const state = {
  score: 0,
  best: 0,
  round: 1,
  ronda: null,          // la ronda en juego
  next: null,           // ronda precargada para la siguiente
  locked: true,
  ultima: '',           // firma de la ronda anterior, para no repetirla
  newRecord: false,
  timer: null,
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
    pregunta: `¿Dirigió <b class="text-neutral-100">${nombre}</b> esta película?`,
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
  { peso: 3, crea: rondaTaquilla, hay: () => PELIS.length > 1 },
  { peso: 2, crea: rondaAnio, hay: () => PELIS.length > 1 },
  { peso: 2, crea: rondaDirector, hay: () => CON_DIRECTOR.length > 1 },
  { peso: 2, crea: rondaActores, hay: () => CON_REPARTO.length > 1 },
  { peso: 2, crea: rondaOscar, hay: () => CON_OSCAR.length > 1 },
];

function nuevaRonda(level) {
  const disponibles = TIPOS.filter((t) => t.hay());
  for (let intento = 0; intento < 30; intento++) {
    // la primera ronda es siempre de taquilla: es la que explica la mecánica
    const tipo = level === 1 ? TIPOS[0] : porPeso(disponibles);
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

function cartaHTML(c, i, clicable) {
  const etiqueta = clicable ? 'button' : 'div';
  const extra = clicable
    ? 'choice cursor-pointer'
    : 'pointer-events-none';
  const alto = c.retrato ? 'min-h-[200px] sm:min-h-[320px]' : 'min-h-[220px] sm:min-h-[360px]';
  return `
    <${etiqueta} ${clicable ? `data-index="${i}"` : ''} class="carta ${extra} group relative flex ${alto} flex-col justify-end overflow-hidden rounded-2xl border-4 border-neutral-800 bg-neutral-900 text-center transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default">
      <img class="js-img absolute inset-0 h-full w-full scale-105 object-cover ${c.retrato ? 'object-top' : ''} opacity-0 blur-[1px] brightness-[.55] saturate-[.9] transition-all duration-500 group-hover:brightness-75 group-hover:saturate-100" alt="" aria-hidden="true" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950/20"></div>
      <div class="relative flex flex-col items-center px-4 pb-5 pt-6">
        ${c.sub ? `<span class="mb-2 rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-xs font-medium text-neutral-300 backdrop-blur-sm">${c.sub}</span>` : ''}
        <span class="display text-xl leading-tight text-white drop-shadow-lg sm:text-3xl">${c.titulo}</span>
        <span class="js-valor display mt-2 h-7 text-xl leading-none text-amber-400 opacity-0 transition-opacity duration-300 sm:text-2xl"></span>
        ${clicable ? '<span class="mt-1 text-xs text-neutral-400 transition group-hover:text-amber-400">Pulsa para elegir</span>' : ''}
      </div>
    </${etiqueta}>`;
}

function pintaRonda(r) {
  const clicable = r.modo === 'elige';
  els.question.innerHTML = r.pregunta;
  els.cards.className =
    `relative grid flex-1 grid-cols-1 gap-3 sm:gap-4 ${COLS[r.cartas.length] || 'sm:grid-cols-2'}`;
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

/* ---------- aviso superpuesto ---------- */

const ACIERTOS = ['¡Correcto!', '¡Bien!', '¡Eso es!', '¡Exacto!', '¡Muy bien!'];
const TOAST_STYLES = {
  ok:   { box: ['border-emerald-400/40', 'shadow-emerald-500/20'], msg: 'text-emerald-400' },
  fail: { box: ['border-red-400/40', 'shadow-red-500/20'], msg: 'text-red-400' },
};

function showToast(kind, msg, sub) {
  const style = TOAST_STYLES[kind];
  els.toastBox.className =
    'max-w-[85%] rounded-2xl border bg-neutral-950/85 px-7 py-4 text-center ' +
    'shadow-2xl backdrop-blur-md ' + style.box.join(' ');
  els.toastMsg.className = 'display text-4xl leading-none sm:text-5xl ' + style.msg;
  els.toastMsg.textContent = msg;
  els.toastSub.textContent = sub || '';
  els.toast.classList.remove('toast-show');
  void els.toast.offsetWidth;
  els.toast.classList.add('toast-show');
}

const hideToast = () => els.toast.classList.remove('toast-show');

/* ---------- juego ---------- */

function responde(eleccion) {
  if (state.locked) return;
  state.locked = true;
  const r = state.ronda;
  const correcto = eleccion === r.correcta;

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
    state.score++;
    els.score.textContent = state.score;
    if (state.score > state.best) {
      state.best = state.score;
      state.newRecord = true;
      els.best.textContent = state.best;
      try { localStorage.setItem(BEST_KEY, String(state.best)); } catch (e) { /* modo privado */ }
    }
    els.score.classList.remove('score-bump');
    void els.score.offsetWidth;
    els.score.classList.add('score-bump');
    const hito = state.score % 5 === 0;
    showToast('ok', hito ? `¡${state.score} seguidas!` : ACIERTOS[state.score % ACIERTOS.length],
      detalle);
    state.timer = setTimeout(newRound, REVEAL_MS);
  } else {
    showToast('fail', '¡Fallaste!', detalle);
    state.timer = setTimeout(() => gameOver(detalle), GAMEOVER_MS);
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

function newRound() {
  clearTimeout(state.timer);
  if (!state.ronda) return mountRound();
  tarjetas().forEach((card) => card.classList.add('card-out'));
  state.timer = setTimeout(mountRound, OUT_MS);
}

function mountRound() {
  hideToast();
  state.round = state.score + 1;
  state.ronda = state.next || nuevaRonda(state.round);
  state.next = null;
  pintaRonda(state.ronda);
  state.locked = false;

  state.next = nuevaRonda(state.round + 1);
  precarga(state.next);
}

function precarga(r) {
  if (!r) return;
  r.cartas.forEach((c) => { if (c.img) new Image().src = c.img; });
}

function gameOver(detalle) {
  els.goScore.textContent = state.score;
  els.goLabel.textContent = state.score === 1 ? 'nivel superado' : 'niveles superados';
  els.goDetail.innerHTML = detalle +
    (state.newRecord
      ? '<br><span class="text-emerald-400">¡Nuevo récord!</span>'
      : `<br><span class="text-neutral-500">Tu récord: ${state.best}</span>`);
  els.gameover.classList.remove('hidden');
  els.gameover.classList.add('flex');
  els.restart.focus();
}

function startGame() {
  state.score = 0;
  state.round = 1;
  state.ronda = null;
  state.next = null;
  state.ultima = '';
  state.newRecord = false;
  els.score.textContent = '0';
  els.gameover.classList.add('hidden');
  els.gameover.classList.remove('flex');
  newRound();
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
  entradaTarjetas();
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
els.best.textContent = state.best;
els.introBest.textContent = state.best > 0 ? `Tu récord: ${state.best} niveles` : '';

// Prepara la primera ronda por detrás: al cerrar la intro el tablero ya está listo
startGame();
els.play.focus();
