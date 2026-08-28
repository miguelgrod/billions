// La pantalla: reparte el campo, pinta las burbujas, abre las preguntas, lleva
// el reloj y las vidas. Todo lo que decide QUÉ se pregunta está en motor.js.

// Ritmo. Se tocan a menudo, por eso están aquí arriba con nombre.
const ELEGIDA_MS = 900;      // lo que la burbuja elegida se luce antes de abrir
const FADE_MS = 700;         // la pregunta entra y hasta entonces no corre el reloj
const REVEAL_MS = 2600;      // pausa tras acertar
const GAMEOVER_MS = 3000;    // pausa tras fallar
const TOAST_MS = 2800;
const REVIENTA_MS = 620;
const VACIO_MS = 450;        // el campo vacío antes de la enhorabuena

// El color de cada categoría: la rueda entera repartida por igual entre las
// que haya, empezando por el verde del campo. El paso regular es lo que las
// mantiene distinguibles. **Si se añade una categoría hay que volver a
// repartir la rampa entera, no encajarla en un hueco**: metida en el hueco más
// ancho quedaría a menos distancia de sus dos vecinas de la que ya hay entre
// las demás. Recortar la rueda a dos tercios —lo primero que hice— dejaba el
// campo entero en morados y rosas.
const TONOS = {};
TIPOS.forEach((t, i) => { TONOS[t.clave] = Math.round(150 + i * (360 / TIPOS.length)) % 360; });
const esfera = (clave) => {
  const h = TONOS[clave];
  return `radial-gradient(circle at 32% 26%,
    hsl(${h} 78% 74%) 0%, hsl(${h} 62% 56%) 46%, hsl(${h} 66% 34%) 100%)`;
};
const colorPlano = (clave) => `hsl(${TONOS[clave]} 62% 56%)`;

const COLORES_EQUIPO = {
  ARI: '#A71930', ATL: '#CE1141', BAL: '#DF4601', BOS: '#BD3039', CHC: '#0E3386',
  CWS: '#27251F', CHW: '#27251F', CIN: '#C6011F', CLE: '#00385D', COL: '#33006F',
  DET: '#0C2340', HOU: '#EB6E1F', KC: '#004687', KCR: '#004687', LAA: '#BA0021',
  LAD: '#005A9C', MIA: '#00A3E0', MIL: '#12284B', MIN: '#002B5C', NYM: '#FF5910',
  NYY: '#0C2340', OAK: '#003831', ATH: '#003831', PHI: '#E81828', PIT: '#FDB827',
  SD: '#2F241D', SDP: '#2F241D', SF: '#FD5A1E', SFG: '#FD5A1E', SEA: '#0C2C56',
  STL: '#C41E3A', TB: '#092C5C', TBR: '#092C5C', TEX: '#003278', TOR: '#134A8E',
  WSH: '#AB0003', WSN: '#AB0003',
};
const colorEquipo = (abbr) => COLORES_EQUIPO[abbr] || '#3f4b46';

const $ = (id) => document.getElementById(id);
const campo = $('campo');

const state = {
  semilla: 0,
  campo: [],            // la categoría de cada burbuja
  vivas: [],            // qué burbujas siguen en el campo
  posiciones: [],
  actual: null,         // la burbuja elegida
  ronda: null,
  vidas: VIDAS,
  puntos: 0,
  aciertos: 0,
  reciente: null,       // la que está reventando
  // Cada jugada resuelta: qué burbuja, qué respondió y cuánto tardó. Con la
  // semilla y esto se reconstruye la partida entera, que es lo que permite al
  // servidor recalcular los puntos en vez de creérselos.
  bitacora: [],
  t0: 0,
  corriendo: false,
  bloqueado: false,
};

// ------------------------------------------------------------- el campo
// Rejilla con desorden: cada burbuja nace en su celda y se desplaza un poco al
// azar. Parece repartido a mano y, a diferencia de sortear posiciones libres,
// no se amontonan. El desorden va en fracción de celda, no en píxeles: con
// rejillas distintas, un valor fijo se come filas enteras.
function rejilla() {
  return window.innerWidth < 640 ? { cols: 4, filas: 5 } : { cols: 5, filas: 4 };
}

function reparteBurbujas() {
  const { cols, filas } = rejilla();
  state.posiciones = state.campo.map((_, i) => ({
    // El desorden se mide en fracción de celda: con rejillas distintas, un
    // valor fijo en porcentaje de pantalla se come filas enteras.
    cx: (i % cols + 0.5) / cols + (Math.random() - 0.5) * 0.30 / cols,
    cy: (Math.floor(i / cols) + 0.5) / filas + (Math.random() - 0.5) * 0.30 / filas,
    escala: 0.74 + Math.random() * 0.52,
    // Dos ejes con periodos largos y distintos: la trayectoria resultante no se
    // repite a la vista y el movimiento nunca se detiene salvo en los extremos
    // de cada eje. El recorrido va en fracción del diámetro, no en píxeles
    // fijos: en un móvil, 38 px de deriva sacaban la burbuja fuera del campo.
    dx: (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.16),
    dy: (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.16),
    tx: 26 + Math.random() * 18,
    ty: 31 + Math.random() * 21,
    // Retrasos negativos: cada burbuja entra en su ciclo por un punto
    // distinto. Sin ellos las veinte respiran al unísono y se ve que es una
    // animación en vez de un flotar.
    rx: -Math.random() * 30,
    ry: -Math.random() * 35,
    foto: null,
  }));
}

// El diámetro se mide del contenedor —celda = mín(ancho/columnas,
// alto/filas)— porque sacarlo del ancho de la ventana ignora el alto y en un
// móvil corto las burbujas se solapaban verticalmente.
function diametroBase() {
  const { cols, filas } = rejilla();
  const w = campo.clientWidth || window.innerWidth;
  const h = campo.clientHeight || window.innerHeight * 0.6;
  return Math.min(w / cols, h / filas) * 0.80;
}

function pintaBurbujas() {
  const base = diametroBase();
  const w = campo.clientWidth, h = campo.clientHeight;
  let html = '';
  state.campo.forEach((clave, i) => {
    const viva = state.vivas.includes(i);
    if (!viva && state.reciente !== i) return;
    const p = state.posiciones[i];
    const d = base * p.escala;
    const elegida = state.actual === i;
    const reventando = state.reciente === i;
    // La posición se corrige para que la burbuja, con su deriva incluida, no
    // asome fuera del campo: sin esto las columnas de los extremos se salían
    // hasta 51 px en un móvil.
    const dxPx = p.dx * base, dyPx = p.dy * base;
    const mx = d / 2 + Math.abs(dxPx) + 2, my = d / 2 + Math.abs(dyPx) + 2;
    const x = Math.min(Math.max(p.cx * w, mx), Math.max(mx, w - mx));
    const y = Math.min(Math.max(p.cy * h, my), Math.max(my, h - my));
    // Profundidad de campo: las pequeñas quedan algo desenfocadas y la elegida
    // siempre entra a foco.
    const desenfoque = elegida ? 0 : Math.max(0, (1.06 - p.escala) * 5).toFixed(1);
    const color = colorPlano(clave);
    const sombra = `0 26px 54px -14px ${color}5c, 0 6px 18px -6px rgba(0,0,0,.5)`;
    const letra = Math.max(9, 11 * p.escala);
    html += `<div class="burbuja" style="left:${x}px;top:${y}px;z-index:${elegida ? 30 : 10}">
      <div class="deriva-x" style="--dx:${dxPx.toFixed(1)}px;--tx:${p.tx.toFixed(1)}s;--rx:${p.rx.toFixed(1)}s">
      <div class="deriva-y relative" style="--dy:${dyPx.toFixed(1)}px;--ty:${p.ty.toFixed(1)}s;--ry:${p.ry.toFixed(1)}s">
        <button type="button" data-b="${i}" ${state.bloqueado || reventando ? 'disabled' : ''}
          class="esfera relative block ${elegida ? 'esfera-elegida' : ''} ${reventando ? 'revienta' : 'esfera-tocable'}"
          style="width:${d.toFixed(1)}px;height:${d.toFixed(1)}px;
                 --sombra:${sombra};--halo:${color}55;box-shadow:${sombra};
                 transform:scale(${elegida ? 1.14 : 1});filter:blur(${desenfoque}px);
                 background-image:${p.foto ? `url('${p.foto}')` : 'none'};
                 background-color:${color}"
          aria-label="${TIPO_ETIQUETA[clave]}">
          <span class="velo" style="background:${esfera(clave)};opacity:${p.foto ? .62 : 1}"></span>
          ${reventando ? '' : `<span class="etiqueta" style="font-size:${letra.toFixed(1)}px">${TIPO_ETIQUETA[clave]}</span>`}
        </button>
      </div></div>
    </div>`;
  });
  campo.innerHTML = html;
  campo.querySelectorAll('[data-b]').forEach((b) => {
    b.addEventListener('click', () => elige(Number(b.dataset.b)));
  });
  $('left').textContent = `${state.vivas.length} bubble${state.vivas.length === 1 ? '' : 's'} left`;
}

const TIPO_ETIQUETA = {};
TIPOS.forEach((t) => { TIPO_ETIQUETA[t.clave] = t.etiqueta; });

// Las fotos son decorativas y por eso van con Math.random y no con el azar
// sembrado: si compartieran generador, la partida dependería de qué imágenes
// hay en disco y dos personas con la misma semilla jugarían cosas distintas.
function repartefotos() {
  // Sólo los que tienen retrato descargado: una burbuja lisa entre diecinueve
  // con cara se lee como una imagen que no ha cargado. Y con sesgo a lo
  // moderno, que si no el campo entero sale en blanco y negro.
  const conFoto = PLAYERS.filter((p) => p[P_PHOTO] && p[P_FAME] >= 140);
  const modernos = conFoto.filter((p) => p[P_TO] >= 1995);
  const usadas = new Set();
  state.posiciones.forEach((p) => {
    for (let i = 0; i < 12 && conFoto.length; i++) {
      const lista = (Math.random() < 0.6 && modernos.length) ? modernos : conFoto;
      const j = lista[Math.floor(Math.random() * lista.length)];
      if (usadas.has(j[P_ID])) continue;
      usadas.add(j[P_ID]);
      p.foto = `photos/${j[P_ID]}.jpg`;
      return;
    }
  });
}

// ------------------------------------------------------------ la jugada
function elige(i) {
  // La partida terminada no admite más jugadas. Que el aviso de fin tape el
  // campo no basta: es la capa de la pantalla la que estaría impidiéndolo, y
  // aquí manda el estado.
  if (state.terminada || state.bloqueado || state.actual !== null) return;
  state.actual = i;
  state.bloqueado = true;
  pintaBurbujas();
  const etiqueta = campo.querySelector('.esfera-elegida .etiqueta');
  if (etiqueta) etiqueta.classList.add('rotulo-in');
  setTimeout(() => abrePregunta(i), ELEGIDA_MS);
}

function abrePregunta(i) {
  const clave = state.campo[i];
  state.ronda = nuevaRonda(clave, state.aciertos + 1);
  if (!state.ronda) { state.actual = null; state.bloqueado = false; pintaBurbujas(); return; }

  campo.classList.add('hidden');
  $('pregunta').classList.remove('hidden');
  $('pregunta').classList.add('flex', 'entra');
  $('creditos').classList.remove('hidden');
  $('categoria').textContent = state.ronda.etiqueta;
  ['categoria', 'enunciado', 'pista'].forEach((id) => {
    $(id).classList.remove('ask-in'); void $(id).offsetWidth; $(id).classList.add('ask-in');
  });
  $('categoria').style.color = colorPlano(clave);
  $('enunciado').innerHTML = state.ronda.pregunta;
  $('pista').textContent = state.ronda.pista || '';
  pintaCartas();

  // Durante la entrada no se puede responder ni corre el reloj: sería injusto
  // descontar tiempo de una pregunta que aún no se lee. Y no basta con parar
  // el reloj: si las cartas siguen vivas, quien responde antes de que arranque
  // paga el tiempo entero —`ms` cae a TIEMPO— y se queda sin puntos habiendo
  // acertado. Salió jugando una partida automática, que responde al instante.
  $('cartas').querySelectorAll('[data-o]').forEach((b) => { b.disabled = true; });
  setTimeout(arrancaReloj, FADE_MS);
}

function pintaCartas() {
  const r = state.ronda;
  const grid = $('cartas');
  const n = r.opciones.length;
  grid.className = `mt-5 grid gap-2.5 sm:gap-3 ${n === 2 ? 'grid-cols-2' : n === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`;
  grid.innerHTML = r.opciones.map((o, i) => cartaHTML(o, i)).join('');
  // Entran escalonadas: 60 ms entre una y otra es lo que hace que se lean como
  // que aparecen y no como que ya estaban.
  grid.querySelectorAll('[data-o]').forEach((b, i) => {
    b.classList.add('card-in');
    b.style.animationDelay = `${i * 0.06}s`;
  });
  grid.querySelectorAll('[data-o]').forEach((b) => {
    b.addEventListener('click', () => responde(Number(b.dataset.o)));
  });
}

function cartaHTML(o, i) {
  const borde = 'border-white/12';
  let dentro;
  if (o.tipo === 'jugador') {
    dentro = `<span class="block h-24 w-full overflow-hidden rounded-xl bg-white/5 sm:h-36">
        <img src="photos/${o.id}.jpg" alt="" loading="lazy"
             class="h-full w-full object-cover object-[50%_22%]"
             onerror="this.style.display='none'">
      </span>
      <span class="mt-2 block text-[13px] font-semibold leading-tight text-white sm:text-sm">${o.texto}</span>
      ${o.pie ? `<span class="mt-0.5 block text-[10px] text-white/35">${o.pie}</span>` : ''}`;
  } else if (o.tipo === 'equipo') {
    dentro = `<span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-sm font-extrabold text-white sm:h-16 sm:w-16"
        style="background:${colorEquipo(o.abbr)}">${o.abbr}</span>
      <span class="mt-2 block text-[13px] font-semibold leading-tight text-white sm:text-sm">${o.texto}</span>`;
  } else {
    dentro = `<span class="block py-3 text-2xl font-extrabold text-white sm:py-5 sm:text-3xl">${o.texto}</span>`;
  }
  return `<button type="button" data-o="${i}"
    class="carta glass rounded-2xl border-2 ${borde} p-2.5 text-center sm:p-3">${dentro}</button>`;
}

// ---------------------------------------------------------------- reloj
let bucle = 0;
function arrancaReloj() {
  $('cartas').querySelectorAll('[data-o]').forEach((b) => { b.disabled = false; });
  state.t0 = performance.now();
  state.corriendo = true;
  const paso = () => {
    if (!state.corriendo) return;
    const ms = performance.now() - state.t0;
    const queda = Math.max(0, 1 - ms / TIEMPO);
    const barra = $('barra');
    barra.style.width = `${queda * 100}%`;
    // La barra se pinta a mano en cada fotograma, no con una transición CSS,
    // porque el mismo reloj decide los puntos: lo que se ve y lo que se cobra
    // salen del mismo sitio.
    barra.style.background = queda < 0.25 ? '#FF453A' : queda < 0.5 ? '#FF9F0A' : '#FFB000';
    if (ms >= TIEMPO) { state.corriendo = false; responde(-1, true); return; }
    bucle = requestAnimationFrame(paso);
  };
  bucle = requestAnimationFrame(paso);
}

function paraReloj() {
  state.corriendo = false;
  cancelAnimationFrame(bucle);
}

// ------------------------------------------------------------ responder
function responde(indice, porTiempo) {
  if (!state.ronda || state.respondida || state.terminada) return;
  // Sin reloj no hay respuesta válida: o la pregunta aún está entrando, o ya
  // se contestó. La única excepción es el propio aviso de tiempo agotado.
  if (!state.corriendo && !porTiempo) return;
  state.respondida = true;
  const ms = state.corriendo ? performance.now() - state.t0 : TIEMPO;
  paraReloj();

  const r = state.ronda;
  const elegida = indice >= 0 ? r.opciones[indice] : null;
  const acierta = elegida !== null && elegida.id === r.correcta;
  const puntos = acierta ? puntosPor(ms) : 0;

  // Se marca con estilo en línea y no con clases: la superficie de cristal
  // define su propio borde en el CSS y una clase de Tailwind podría quedar por
  // debajo en la cascada.
  $('cartas').querySelectorAll('[data-o]').forEach((b) => {
    const o = r.opciones[Number(b.dataset.o)];
    b.disabled = true;
    if (o.id === r.correcta) { b.style.borderColor = '#2EA166'; b.style.background = 'rgba(46,161,102,.16)'; }
    else if (b === (indice >= 0 ? $('cartas').children[indice] : null)) {
      b.style.borderColor = '#C8102E'; b.style.background = 'rgba(200,16,46,.16)';
    }
  });

  // `r` a null es que se agotó el tiempo, que no es lo mismo que fallar.
  state.bitacora.push({ b: state.actual, r: indice >= 0 ? indice : null, ms: Math.round(ms) });

  const correcta = r.opciones.find((o) => o.id === r.correcta);
  if (acierta) {
    state.puntos += puntos;
    state.aciertos++;
    $('score').textContent = state.puntos;
    $('score').classList.remove('score-bump'); void $('score').offsetWidth;
    $('score').classList.add('score-bump');
    aviso('ok', 'Correct', puntos, '');
  } else {
    state.vidas--;
    pintaVidas(true);
    aviso('fail', indice < 0 ? "Out of time" : 'Wrong',
          null, `The answer was ${correcta ? correcta.texto : '—'}.`);
  }

  // La burbuja jugada desaparece del campo, se acierte o se falle: si la
  // fallada se quedara, la partida podría tener más jugadas que burbujas y el
  // jugador se reencontraría la misma burbuja con otra pregunta detrás.
  const gastada = state.actual;
  setTimeout(() => {
    state.vivas = state.vivas.filter((b) => b !== gastada);
    state.reciente = gastada;
    state.actual = null;
    state.ronda = null;
    state.respondida = false;
    $('pregunta').classList.add('hidden');
    $('pregunta').classList.remove('flex', 'entra');
    $('creditos').classList.add('hidden');
    campo.classList.remove('hidden');
    pintaBurbujas();
    // El repintado va por temporizador y no por `animationend`: un cambio de
    // tamaño de ventana rehace el marcado entero y el evento se perdería con
    // el nodo, dejando la burbuja congelada en el campo para siempre.
    setTimeout(() => {
      state.reciente = null;
      state.bloqueado = false;
      pintaBurbujas();
      if (state.vidas <= 0) setTimeout(() => acaba(false), 300);
      else if (!state.vivas.length) setTimeout(() => acaba(true), VACIO_MS);
    }, REVIENTA_MS);
  }, acierta ? REVEAL_MS : GAMEOVER_MS);
}

// ------------------------------------------------------------- avisos
function aviso(tipo, mensaje, puntos, detalle) {
  const t = $('toast');
  t.className = `pointer-events-none fixed inset-x-0 bottom-6 z-40 mx-auto w-[min(92%,26rem)] rounded-3xl px-5 py-4 text-center ${
    tipo === 'ok' ? 'bg-[#2EA166]/92 text-white' : 'bg-[#C8102E]/92 text-white'}`;
  t.style.setProperty('--dur', `${TOAST_MS}ms`);
  $('toast-msg').textContent = mensaje;
  $('toast-det').textContent = detalle || '';
  const pts = $('toast-pts');
  if (puntos === null) { pts.textContent = ''; pts.classList.add('hidden'); }
  else {
    pts.classList.remove('hidden');
    // Sube de 0 a lo ganado, dentro de lo que dura el aviso.
    const t0 = performance.now();
    const sube = () => {
      const k = Math.min(1, (performance.now() - t0) / 700);
      pts.textContent = `+${Math.round(puntos * k)}`;
      if (k < 1) requestAnimationFrame(sube);
    };
    sube();
  }
  t.classList.remove('hidden');
  // Reiniciar la animación: sin esto, dos avisos seguidos no se ven.
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  setTimeout(() => t.classList.add('hidden'), TOAST_MS);
}

function pintaVidas(perdida) {
  $('vidas').innerHTML = Array.from({ length: VIDAS }, (_, i) => {
    const viva = i < state.vidas;
    // La que se acaba de perder late al apagarse: es la que hay que mirar.
    const cae = perdida && i === state.vidas;
    return `<span class="h-2.5 w-2.5 rounded-full ${viva ? 'bg-[#2EA166]' : 'bg-white/15'} ${cae ? 'life-out' : ''}"></span>`;
  }).join('');
}

// --------------------------------------------------------------- final
const CLAVE_RECORD = 'pn.best.points';
function record(puntos) {
  try {
    const antes = Number(localStorage.getItem(CLAVE_RECORD) || 0);
    if (puntos > antes) { localStorage.setItem(CLAVE_RECORD, String(puntos)); return { mejor: puntos, nuevo: true }; }
    return { mejor: antes, nuevo: false };
  } catch (e) { return { mejor: puntos, nuevo: false }; }
}

// Las huellas de los archivos con los que se ha jugado. Si se regeneran los
// datos, las mismas semillas dejan de dar las mismas preguntas, así que el
// servidor necesita saber con cuáles fue. Ya las pone sella-versiones.py en
// cada <script src>: aquí sólo se leen del DOM.
function versionDeDatos() {
  const v = {};
  document.querySelectorAll('script[src]').forEach((e) => {
    const m = e.getAttribute('src').match(/([^/?]+)\?v=([0-9a-f]+)/);
    if (m) v[m[1]] = m[2];
  });
  return v;
}

// La partida acaba en una página aparte, no en un aviso superpuesto: ahí caben
// el resumen, la clasificación y el resto sin apretar el tablero.
const FIN_KEY = 'pn.lastResult';

function acaba(gana, ficticia) {
  state.terminada = true;
  const r = record(state.puntos);
  const resultado = {
    titulo: gana ? 'Field cleared.' : 'Three outs.',
    score: state.puntos,
    etiqueta: 'points',
    detalle: `<p><b class="text-white">${state.aciertos} of ${BURBUJAS}</b> questions right`
      + `${state.vidas < VIDAS ? ` · ${VIDAS - state.vidas} out${VIDAS - state.vidas === 1 ? '' : 's'}` : ''}.</p>`
      + `<p class="mt-2 text-white/60">${r.nuevo ? 'A new personal best.' : `Your personal best is ${r.mejor}.`}</p>`,
  };
  if (ficticia) resultado.ficticia = true;
  else {
    resultado.partida = {
      semilla: state.semilla,
      campo: state.campo,
      jugadas: state.bitacora,
      datos: versionDeDatos(),
    };
  }
  try { localStorage.setItem(FIN_KEY, JSON.stringify(resultado)); } catch (e) { /* modo privado */ }
  location.href = 'end.html';
}

// ------------------------------------------------------------ arranque
function nuevaPartida(semilla) {
  state.semilla = reiniciaMotor(semilla);
  state.campo = reparteCategorias();
  state.vivas = state.campo.map((_, i) => i);
  state.actual = null;
  state.ronda = null;
  state.reciente = null;
  state.vidas = VIDAS;
  state.puntos = 0;
  state.aciertos = 0;
  state.bloqueado = false;
  state.respondida = false;
  state.terminada = false;
  state.bitacora = [];
  reparteBurbujas();
  repartefotos();
  $('score').textContent = '0';
  pintaVidas();
  pintaBurbujas();
  campo.classList.remove('hidden');
  $('pregunta').classList.add('hidden');
}

// La portada usa las mismas pompas del campo, no una versión simplificada: lo
// primero que se ve es la pieza de verdad.
function pintaIntro() {
  const caja = $('intro-burbujas');
  const conFoto = PLAYERS.filter((p) => p[P_PHOTO] && p[P_FAME] >= 150);
  const claves = TIPOS.map((t) => t.clave);
  let html = '';
  for (let i = 0; i < 12; i++) {
    const clave = claves[i % claves.length];
    const k = 0.7 + Math.random() * 0.7;
    const d = Math.max(58, Math.min(window.innerWidth, 900) / 7) * k;
    const x = 6 + Math.random() * 88, y = 6 + Math.random() * 88;
    const j = conFoto[Math.floor(Math.random() * conFoto.length)];
    const color = colorPlano(clave);
    // Las mismas pompas del campo, con su deriva desfasada y su profundidad de
    // campo: lo primero que se ve es la pieza de verdad.
    html += `<div class="burbuja" style="left:${x}%;top:${y}%">
      <div class="deriva-x" style="--dx:${(d * (Math.random() < .5 ? -.18 : .18)).toFixed(0)}px;--tx:${(26 + Math.random() * 18).toFixed(1)}s;--rx:${(-Math.random() * 30).toFixed(1)}s">
      <div class="deriva-y" style="--dy:${(d * (Math.random() < .5 ? -.16 : .16)).toFixed(0)}px;--ty:${(31 + Math.random() * 21).toFixed(1)}s;--ry:${(-Math.random() * 35).toFixed(1)}s">
        <span class="esfera relative block" style="width:${d}px;height:${d}px;
          background-image:url('photos/${j[P_ID]}.jpg');background-color:${color};
          box-shadow:0 26px 54px -14px ${color}5c;
          filter:blur(${Math.max(0, (1.06 - k) * 4.5).toFixed(1)}px);opacity:${k < .85 ? .8 : .95}">
          <span class="velo" style="background:${esfera(clave)};opacity:.62"></span>
        </span>
      </div></div></div>`;
  }
  caja.innerHTML = html;

  $('intro-temas').innerHTML = TIPOS.map((t) => `
    <span class="flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-semibold text-white/80">
      <span class="h-3 w-3 rounded-full" style="background:${esfera(t.clave)}"></span>${t.etiqueta}
    </span>`).join('');
}

$('jugar').addEventListener('click', () => {
  $('intro').classList.add('hidden');
  nuevaPartida();
});
$('reset').addEventListener('click', () => {
  $('intro').classList.remove('hidden');
  pintaIntro();
  nuevaPartida();
});
// El campo se repinta al cambiar el tamaño porque el diámetro se mide del
// contenedor.
addEventListener('resize', () => { if (state.campo.length) pintaBurbujas(); });
addEventListener('keydown', (e) => {
  if (!state.ronda || state.respondida) return;
  const n = Number(e.key);
  if (n >= 1 && n <= state.ronda.opciones.length) responde(n - 1);
});

pintaIntro();
nuevaPartida();
