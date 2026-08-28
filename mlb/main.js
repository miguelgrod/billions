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
    // El desorden va en fracción de celda. Con 0,55 se solapaban de dos en
    // dos; con 0,36 el campo sigue pareciendo repartido a mano y no se tocan.
    cx: (i % cols + 0.5) / cols + (Math.random() - 0.5) * 0.36 / cols,
    cy: (Math.floor(i / cols) + 0.5) / filas + (Math.random() - 0.5) * 0.34 / filas,
    escala: 0.88 + Math.random() * 0.20,
    // Dos ejes con periodos distintos: así el movimiento sólo se detiene en
    // los extremos de cada eje y la trayectoria compuesta no se repite a la
    // vista. Un solo recorrido con varios puntos frenaba en cada uno.
    dx: (26 + Math.random() * 18).toFixed(1) + 's',
    dy: (31 + Math.random() * 21).toFixed(1) + 's',
    // El recorrido va en fracción del diámetro, no en píxeles fijos: 38 px
    // sacaban la burbuja del campo en una pantalla pequeña.
    rx: (0.10 + Math.random() * 0.10),
    ry: (0.08 + Math.random() * 0.10),
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
    // La posición se corrige para que ninguna burbuja asome fuera: sin esto,
    // las columnas de los extremos se salían hasta 51 px en un móvil.
    const margen = d / 2 + d * Math.max(p.rx, p.ry) + 2;
    const x = Math.min(Math.max(p.cx * w, margen), w - margen);
    const y = Math.min(Math.max(p.cy * h, margen), h - margen);
    const elegida = state.actual === i;
    const reventando = state.reciente === i;
    const letra = Math.max(9, Math.min(14, d * 0.115));
    html += `<div class="burbuja" style="left:${x}px;top:${y}px">
      <div class="deriva-x" style="--dx:${p.dx};--rx:${(d * p.rx).toFixed(1)}px">
      <div class="deriva-y" style="--dy:${p.dy};--ry:${(d * p.ry).toFixed(1)}px">
        <button type="button" data-b="${i}" ${state.bloqueado || reventando ? 'disabled' : ''}
          class="pompa relative block ${elegida ? 'elegida' : ''} ${reventando ? 'revienta' : ''}"
          style="width:${d}px;height:${d}px;transform:scale(${elegida ? 1.14 : 1});
                 box-shadow:0 10px 30px ${colorPlano(clave)}44;
                 background-image:${p.foto ? `url('${p.foto}')` : 'none'};
                 background-color:${colorPlano(clave)}">
          <span class="velo" style="background:${esfera(clave)};opacity:${p.foto ? .62 : 1}"></span>
          <span class="rotulo" style="font-size:${letra}px">${TIPO_ETIQUETA[clave]}</span>
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
  $('categoria').style.color = colorPlano(clave);
  $('enunciado').innerHTML = state.ronda.pregunta;
  $('pista').textContent = state.ronda.pista || '';
  pintaCartas();

  // Durante la entrada no se puede responder ni corre el reloj: sería injusto
  // descontar tiempo de una pregunta que aún no se lee.
  setTimeout(arrancaReloj, FADE_MS);
}

function pintaCartas() {
  const r = state.ronda;
  const grid = $('cartas');
  const n = r.opciones.length;
  grid.className = `mt-5 grid gap-2.5 sm:gap-3 ${n === 2 ? 'grid-cols-2' : n === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`;
  grid.innerHTML = r.opciones.map((o, i) => cartaHTML(o, i)).join('');
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
    if (ms >= TIEMPO) { state.corriendo = false; responde(-1); return; }
    bucle = requestAnimationFrame(paso);
  };
  bucle = requestAnimationFrame(paso);
}

function paraReloj() {
  state.corriendo = false;
  cancelAnimationFrame(bucle);
}

// ------------------------------------------------------------ responder
function responde(indice) {
  if (!state.ronda || state.respondida || state.terminada) return;
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

  const correcta = r.opciones.find((o) => o.id === r.correcta);
  if (acierta) {
    state.puntos += puntos;
    state.aciertos++;
    $('score').textContent = state.puntos;
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
    return `<span class="h-2.5 w-2.5 rounded-full ${viva ? 'bg-[#2EA166]' : 'bg-white/15'}"></span>`;
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

function acaba(gana) {
  state.terminada = true;
  const r = record(state.puntos);
  $('fin-titulo').textContent = gana ? 'Field cleared.' : 'Three outs.';
  $('fin-detalle').textContent = `${state.aciertos} of ${BURBUJAS} correct · ${state.puntos} points`;
  $('fin-record').textContent = r.nuevo ? 'New personal best' : `Personal best ${r.mejor}`;
  $('fin').classList.replace('hidden', 'flex');
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
  reparteBurbujas();
  repartefotos();
  $('score').textContent = '0';
  pintaVidas();
  pintaBurbujas();
  $('fin').classList.replace('flex', 'hidden');
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
    const d = Math.max(58, Math.min(window.innerWidth, 900) / 7) * (0.7 + Math.random() * 0.7);
    const x = 6 + Math.random() * 88, y = 6 + Math.random() * 88;
    const j = conFoto[Math.floor(Math.random() * conFoto.length)];
    html += `<div class="burbuja" style="left:${x}%;top:${y}%">
      <div class="deriva-x" style="--dx:${(26 + Math.random() * 18).toFixed(1)}s;--rx:${(d * 0.14).toFixed(0)}px">
      <div class="deriva-y" style="--dy:${(31 + Math.random() * 20).toFixed(1)}s;--ry:${(d * 0.12).toFixed(0)}px">
        <span class="pompa relative block" style="width:${d}px;height:${d}px;
          background-image:url('photos/${j[P_ID]}.jpg');background-color:${colorPlano(clave)};
          filter:blur(${d < 70 ? 1.4 : 0}px);opacity:${d < 70 ? .75 : .95}">
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
$('otra').addEventListener('click', () => nuevaPartida());
$('reset').addEventListener('click', () => {
  $('fin').classList.replace('flex', 'hidden');
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
