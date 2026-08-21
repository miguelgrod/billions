// Billions — adivina qué película recaudó más
// Los datos viven en movies.js (const MOVIES)

const BEST_KEY = 'billions.best';
const REVEAL_MS = 2800;    // tiempo para leer las cifras antes de la ronda siguiente
const GAMEOVER_MS = 3200;  // tiempo para leerlas antes de la pantalla de fin
const COUNT_MS = 900;      // duración del contador de recaudación

const els = {
  cards: [...document.querySelectorAll('.choice')],
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
  pair: [null, null],   // las dos películas en juego
  next: null,           // pareja precargada para la ronda siguiente
  locked: true,         // bloquea clics durante la revelación
  lastPairKey: '',      // evita repetir la misma pareja seguida
  newRecord: false,     // ¿se ha batido el récord en esta partida?
  timer: null,
};

/* ---------- utilidades ---------- */

const rnd = (n) => Math.floor(Math.random() * n);

// Pareja aleatoria de películas distintas, nunca la misma que la ronda anterior
function randomPair() {
  let a, b, key;
  do {
    a = rnd(MOVIES.length);
    b = rnd(MOVIES.length);
    key = [a, b].sort((x, y) => x - y).join('-');
  } while (a === b || key === state.lastPairKey);
  state.lastPairKey = key;
  return Math.random() < 0.5 ? [MOVIES[a], MOVIES[b]] : [MOVIES[b], MOVIES[a]];
}

const fmtMoney = (n) =>
  '$' + n.toLocaleString('es-ES', { maximumFractionDigits: 0 });

// Cuenta ascendente hasta la cifra real
function countUp(el, target) {
  const start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / COUNT_MS, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtMoney(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const part = (card, cls) => card.querySelector('.' + cls);

/* ---------- carátulas ---------- */

const posterUrl = (movie) =>
  typeof POSTERS !== 'undefined' && POSTERS[movie.r] ? 'posters/' + POSTERS[movie.r] : null;

// Deja la carátula lista antes de que se vea la ronda; si falla, la tarjeta
// se queda con su fondo liso y el título, que es lo único imprescindible.
function paintPoster(card, movie) {
  const img = part(card, 'js-poster');
  const url = posterUrl(movie);
  img.classList.add('opacity-0');
  img.removeAttribute('src');
  if (!url) return;
  img.onload = () => img.classList.remove('opacity-0');
  img.onerror = () => img.classList.add('opacity-0');
  img.src = url;
}

// Adelanta la descarga de la siguiente ronda para que no parpadee
function preload(pair) {
  pair.forEach((movie) => {
    const url = posterUrl(movie);
    if (url) new Image().src = url;
  });
}

/* ---------- aviso superpuesto ---------- */

const ACIERTOS = ['¡Correcto!', '¡Bien!', '¡Eso es!', '¡Exacto!', '¡Muy bien!'];

const TOAST_STYLES = {
  ok:   { box: ['border-emerald-400/40', 'shadow-emerald-500/20'], msg: 'text-emerald-400' },
  fail: { box: ['border-red-400/40', 'shadow-red-500/20'], msg: 'text-red-400' },
};

// Mensaje breve superpuesto al tablero. Se autodesvanece con la animación CSS,
// así que no hay que programar nada para ocultarlo.
function showToast(kind, msg, sub) {
  const style = TOAST_STYLES[kind];
  els.toastBox.className =
    'max-w-[85%] rounded-2xl border bg-neutral-950/85 px-7 py-4 text-center ' +
    'shadow-2xl backdrop-blur-md ' +
    style.box.join(' ');
  els.toastMsg.className = 'display text-4xl leading-none sm:text-5xl ' + style.msg;
  els.toastMsg.textContent = msg;
  els.toastSub.textContent = sub;
  els.toast.classList.remove('toast-show');
  void els.toast.offsetWidth;            // reinicia la animación si venías de otro aviso
  els.toast.classList.add('toast-show');
}

function toastAcierto(score) {
  const hito = score > 0 && score % 5 === 0;
  showToast('ok',
    hito ? `¡${score} seguidas!` : ACIERTOS[score % ACIERTOS.length],
    `Nivel ${score} superado`);
}

function toastFallo(winner) {
  showToast('fail', '¡Fallaste!', `${winner.t} recaudó más`);
}

function hideToast() {
  els.toast.classList.remove('toast-show');
}

/* ---------- render ---------- */

const NEUTRAL_BORDER = ['border-neutral-800'];
const WIN_CLASSES = ['border-emerald-400', 'bg-emerald-500/10', 'pop'];
const LOSE_CLASSES = ['border-red-500', 'bg-red-500/10', 'shake'];

function resetCards() {
  els.cards.forEach((card) => {
    card.classList.remove(...WIN_CLASSES, ...LOSE_CLASSES, 'opacity-60');
    card.classList.add(...NEUTRAL_BORDER);
    part(card, 'js-poster').classList.remove('brightness-90', 'saturate-100', 'blur-0');
    const gross = part(card, 'js-gross');
    gross.textContent = '';
    gross.classList.add('opacity-0');
    part(card, 'js-hint').classList.remove('invisible');
  });
  hideToast();
}

function newRound() {
  clearTimeout(state.timer);
  resetCards();
  state.pair = state.next || randomPair();
  state.next = null;
  state.pair.forEach((movie, i) => {
    const card = els.cards[i];
    part(card, 'js-title').textContent = movie.t;
    part(card, 'js-year').textContent = movie.y;
    paintPoster(card, movie);
    card.disabled = false;
  });
  state.locked = false;
  state.next = randomPair();
  preload(state.next);
}

function revealCard(card, movie, isWinner) {
  const img = part(card, 'js-poster');
  if (isWinner) img.classList.add('brightness-90', 'saturate-100', 'blur-0');
  const gross = part(card, 'js-gross');
  gross.classList.remove('opacity-0');
  countUp(gross, movie.g);
  part(card, 'js-hint').classList.add('invisible');
  card.classList.remove(...NEUTRAL_BORDER);
  card.classList.add(...(isWinner ? WIN_CLASSES : LOSE_CLASSES));
  if (!isWinner) card.classList.add('opacity-60');
}

/* ---------- juego ---------- */

function choose(side) {
  if (state.locked) return;
  state.locked = true;
  els.cards.forEach((c) => (c.disabled = true));

  const [a, b] = state.pair;
  const winnerSide = a.g > b.g ? 0 : 1;   // no hay empates en el dataset
  const correct = side === winnerSide;

  els.cards.forEach((card, i) => revealCard(card, state.pair[i], i === winnerSide));

  if (correct) {
    state.score++;
    els.score.textContent = state.score;
    if (state.score > state.best) {
      state.best = state.score;
      state.newRecord = true;
      els.best.textContent = state.best;
      try { localStorage.setItem(BEST_KEY, String(state.best)); } catch (e) { /* modo privado */ }
    }
    toastAcierto(state.score);
    state.timer = setTimeout(newRound, REVEAL_MS);
  } else {
    toastFallo(state.pair[winnerSide]);
    state.timer = setTimeout(gameOver, GAMEOVER_MS);
  }
}

function gameOver() {
  const [a, b] = state.pair;
  const winner = a.g > b.g ? a : b;
  const loser = a.g > b.g ? b : a;
  const diff = winner.g - loser.g;

  els.goScore.textContent = state.score;
  els.goLabel.textContent = state.score === 1 ? 'nivel superado' : 'niveles superados';
  els.goDetail.innerHTML =
    `<strong class="text-neutral-100">${winner.t}</strong> recaudó ` +
    `<strong class="text-amber-400">${fmtMoney(diff)}</strong> más que ` +
    `<strong class="text-neutral-100">${loser.t}</strong>.` +
    (state.newRecord
      ? '<br><span class="text-emerald-400">¡Nuevo récord!</span>'
      : `<br><span class="text-neutral-500">Tu récord: ${state.best}</span>`);

  els.gameover.classList.remove('hidden');
  els.gameover.classList.add('flex');
  els.restart.focus();
}

function startGame() {
  state.score = 0;
  state.next = null;
  state.newRecord = false;
  els.score.textContent = '0';
  els.gameover.classList.add('hidden');
  els.gameover.classList.remove('flex');
  newRound();
}

const introVisible = () => !els.intro.classList.contains('hidden');

function closeIntro() {
  els.intro.classList.add('hidden');
  els.intro.classList.remove('flex');
}

/* ---------- eventos ---------- */

els.cards.forEach((card) =>
  card.addEventListener('click', () => choose(Number(card.dataset.side)))
);

els.restart.addEventListener('click', startGame);
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
  if (e.key === 'ArrowLeft' || e.key === '1') choose(0);
  if (e.key === 'ArrowRight' || e.key === '2') choose(1);
});

try {
  state.best = Number(localStorage.getItem(BEST_KEY)) || 0;
} catch (e) { state.best = 0; }
els.best.textContent = state.best;
els.introBest.textContent = state.best > 0 ? `Tu récord: ${state.best} niveles` : '';

// Prepara la primera ronda por detrás: al cerrar la intro el tablero ya está listo
startGame();
els.play.focus();
