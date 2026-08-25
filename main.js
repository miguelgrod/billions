// Billions — preguntas de cine: taquilla, estrenos, directores, repartos y Óscars
// Datos en movies.js · imágenes en posters.js, directors.js y actors.js

// Clave nueva: el récord pasa a medirse en puntos, no en niveles, así que no
// puede heredar los valores guardados con el sistema anterior.
const BEST_KEY = 'billions.best.points';
const COOKIE_KEY = 'billions.cookieConsent.v1';
const COOKIE_CATALOG = [
  {
    id: 'essential',
    label: 'Necesarias',
    required: true,
    description: 'Mantienen el juego operativo y guardan tu mejor puntuación en el navegador.',
    cookies: ['billions.best.points'],
    enabledByDefault: true,
  },
  {
    id: 'analytics',
    label: 'Google Analytics',
    required: false,
    description: 'Miden visitas y uso del sitio para entender qué funciona mejor.',
    cookies: ['_ga', '_gid', '_gat', '_gat_gtag_UA_123456789_1'],
    vendor: 'Google',
    enabledByDefault: false,
  },
];
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
// En estrenos, la diferencia de años NUNCA pasa de ANIOS_MAX. Preguntar si se
// estrenó antes una de 1950 o una de 1995 no mide saber de cine: la gracia está
// en distinguir estrenos próximos, no lejanos. Aquí el número es el máximo
// admisible y baja con el nivel; en taquilla y en crítica el ratio y la nota
// funcionan igual.
const ANIOS_MAX = 5, ANIOS_SUELO = 1, ANIOS_CAIDA = 0.89;

// Al elegir un "intruso" (director o actor que no es de la película) se coge de
// una película lejana en el tiempo: no tenemos el reparto completo, sólo cinco
// nombres, así que la distancia temporal es lo que evita afirmar en falso que
// dos actores no coincidieron.
const HUECO_SEGURO = 12;
// Reparto: años de diferencia de edad admisibles entre los dos intérpretes.
// Sin tope salían parejas como Zendaya (1996) contra Ben Kingsley (1943): un
// cuarto de las preguntas separaba a los dos por más de 45 años y la mayor
// llegaba a 128. No es dificultad, es que la pareja resulte verosímil.
const EDAD_MAX = 22;

// ---- Campo de burbujas ----
// Veinte burbujas repartidas por la pantalla, cuatro de cada categoría. No hay
// recorrido ni ficha ni dado: el jugador pulsa la burbuja que quiere y esa
// plantea la pregunta de su categoría.
const BURBUJAS = 20;
const CATEGORIAS = ['taquilla', 'anio', 'director', 'actores', 'oscar', 'oscarcat',
                    'critica', 'filmografia', 'bso'];
// En pantalla estrecha la rejilla se pone de pie: cuatro columnas por cinco
// filas encajan con un móvil vertical y dejan sitio a burbujas más grandes.
const REJILLA_ANCHA = { columnas: 5, filas: 4 };
const REJILLA_ALTA = { columnas: 4, filas: 5 };
let campoRejilla = { columnas: 7, filas: 3 };
const esEstrecha = () =>
  typeof window !== 'undefined' && window.innerWidth ? window.innerWidth < 640 : false;
const ELEGIDA_MS = 1100;   // la elegida se luce antes de abrir la pregunta
const REVIENTA_MS = 620;   // lo que tarda en irse la burbuja acertada
const VACIO_MS = 450;      // el campo vacío se ve un momento antes de celebrar

// Colores de sistema de Apple en modo oscuro. Cada esfera se pinta con tres
// paradas —luz, color y sombra— para que tenga volumen sin necesidad de brillos
// añadidos: es lo que hace que se lean como cuerpos y no como círculos planos.
const COLORES = {
  oscarcat:    '#F49AB3',   // rosa
  oscar:       '#F49AD2',   // magenta
  taquilla:    '#F49AF1',   // orquídea
  bso:         '#D89AF4',   // malva
  director:    '#B99AF4',   // violeta
  actores:     '#9A9AF4',   // lila
  filmografia: '#9AB9F4',   // azul violáceo
  anio:        '#9AD8F4',   // azul cielo
  critica:     '#9AF4F1',   // turquesa
};
// Nueve tonos repartidos por igual entre el turquesa y el rosa (178°-343°, en
// pasos de 20,7°): es la gama de la referencia, y el paso regular de tono es lo
// que los mantiene distinguibles pese a ser todos pasteles de la misma familia.
// Las tres paradas salen siempre de la misma fórmula sobre ese tono: luz al
// 100/92,9 de saturación y luminosidad, medio al 80,4/78 y hondo al 44,9/58.
// Cada vez que entra una categoría se vuelve a repartir la rampa entera en vez
// de encajarla en el hueco más ancho, que la dejaría más cerca de sus dos
// vecinas de lo que ya están las demás entre sí. Se hizo así al entrar
// Filmografía y otra vez al entrar Banda sonora.
const ESFERA = {
  oscarcat:    { luz: '#FFDBE5', medio: '#F49AB3', hondo: '#C4647F' },
  oscar:       { luz: '#FFDBF1', medio: '#F49AD2', hondo: '#C464A0' },
  taquilla:    { luz: '#FFDBFE', medio: '#F49AF1', hondo: '#C464C1' },
  bso:         { luz: '#F4DBFF', medio: '#D89AF4', hondo: '#A664C4' },
  director:    { luz: '#E7DBFF', medio: '#B99AF4', hondo: '#8564C4' },
  actores:     { luz: '#DBDBFF', medio: '#9A9AF4', hondo: '#6464C4' },
  filmografia: { luz: '#DBE7FF', medio: '#9AB9F4', hondo: '#6485C4' },
  anio:        { luz: '#DBF4FF', medio: '#9AD8F4', hondo: '#64A6C4' },
  critica:     { luz: '#DBFFFE', medio: '#9AF4F1', hondo: '#64C4C1' },
};
const FADE_MS = 1000;      // fundido de entrada de la pregunta
const SALIDA_INTRO_MS = 1500;  // la portada se desvanece y descubre el campo

// Un icono por categoría, dibujado a trazo sobre una rejilla de 24. Va dentro de
// la esfera a muy poca opacidad: se lee como un relieve, no como un adorno.
const ICONOS = {
  taquilla: '<rect x="2" y="7" width="20" height="10" rx="2.5"/>' +
            '<path d="M15.5 7v1.5M15.5 10.5v1.5M15.5 13.5v1.5M15.5 16.5V17"/>' +
            '<path d="M5.5 10.5h6M5.5 13.5h4"/>',
  anio:     '<rect x="3" y="5" width="18" height="16" rx="2.5"/>' +
            '<path d="M8 3v4M16 3v4M3 10h18"/>' +
            '<path d="M7.5 14h2M13 14h2M7.5 17.5h2M13 17.5h2"/>',
  director: '<rect x="2.5" y="9" width="19" height="11.5" rx="2"/>' +
            '<path d="M2.8 9.2 4.9 4.4l16.6 2.3-.4 2.3"/>' +
            '<path d="M9 4.9 7.3 8.8M14.2 5.6l-1.7 3.9M19.4 6.3l-1.7 3.9"/>',
  actores:  '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.5"/>' +
            '<path d="M2.8 19.5c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6"/>' +
            '<path d="M15.6 19.5c.2-2.6 1.9-4.3 4.2-4.3 1 0 1.9.3 2.6.8"/>',
  oscar:    '<path d="M8 3.5h8v5.2a4 4 0 0 1-8 0z"/>' +
            '<path d="M8 5.2H5.6a2.6 2.6 0 0 0 2.8 4.2M16 5.2h2.4a2.6 2.6 0 0 1-2.8 4.2"/>' +
            '<path d="M12 12.7v3.1"/><path d="M9.4 15.8h5.2l.9 4.7H8.5z"/>',
  oscarcat: '<circle cx="12" cy="14.5" r="5.5"/>' +
            '<path d="M8.5 9.6 6 3.5h4.4L12 7M15.5 9.6 18 3.5h-4.4"/>' +
            '<path d="m12 12 .9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
  critica:  '<path d="m12 3.5 2.7 5.6 6 .9-4.4 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.3 10l6-.9z"/>',
  // corchea doble sobre una onda: la música de la película, no una nota suelta
  bso:      '<path d="M9.5 17.5V5.2l9-2v12.3"/>' +
            '<ellipse cx="7" cy="18" rx="2.6" ry="2.1"/>' +
            '<ellipse cx="16" cy="15.5" rx="2.6" ry="2.1"/>' +
            '<path d="M9.5 8.3l9-2"/>',
  // una pila de películas: es un recuento, no una película suelta
  filmografia: '<rect x="6.5" y="9" width="15" height="12" rx="2"/>' +
               '<path d="M4.6 6.8h13.6M2.8 4.2h11.4"/>' +
               '<path d="M10 12.4v5.2l4.4-2.6z"/>',
};

const iconoHTML = (cat, opts = {}) => `
  <svg viewBox="0 0 24 24" class="${opts.clase || 'pointer-events-none absolute inset-0 m-auto h-1/2 w-1/2'}"
       fill="none" stroke="${opts.color || '#2a123f'}" stroke-width="${opts.grosor || 1.4}"
       stroke-linecap="round" stroke-linejoin="round"
       style="opacity:${opts.opacidad ?? 1}" aria-hidden="true">
    ${ICONOS[cat] || ''}
  </svg>`;

const getCookiePreferences = () => {
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return COOKIE_CATALOG.reduce((acc, cookie) => {
      const base = cookie.required || cookie.enabledByDefault;
      acc[cookie.id] = Object.prototype.hasOwnProperty.call(stored, cookie.id)
        ? Boolean(stored[cookie.id])
        : base;
      return acc;
    }, {});
  } catch (error) {
    return COOKIE_CATALOG.reduce((acc, cookie) => {
      acc[cookie.id] = cookie.required || cookie.enabledByDefault;
      return acc;
    }, {});
  }
};

// Guardar va entre try/catch como todo lo que toca localStorage: en modo
// privado lanza. Y aquí importa más que en el récord — con el muro puesto, una
// excepción al pulsar "Aceptar" dejaría la página bloqueada para siempre. Si no
// se puede guardar, la decisión vale para esta visita y el aviso volverá a la
// siguiente, que es el único fallo aceptable.
let decisionDeEstaVisita = null;

const saveCookiePreferences = (preferences) => {
  const normalized = COOKIE_CATALOG.reduce((acc, cookie) => {
    acc[cookie.id] = cookie.required || Boolean(preferences[cookie.id]);
    return acc;
  }, {});
  decisionDeEstaVisita = normalized;
  try {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(normalized));
  } catch (error) {
    /* modo privado: nos quedamos con la decisión en memoria */
  }
  return normalized;
};

// Si ya hay decisión no hace falta preguntar. `decisionDeEstaVisita` cubre el
// caso en que localStorage no admita escrituras.
const hayDecisionDeCookies = () => {
  if (decisionDeEstaVisita) return true;
  try {
    return localStorage.getItem(COOKIE_KEY) !== null;
  } catch (error) {
    return false;
  }
};

// ---- Muro de cookies -------------------------------------------------------
// Mientras no haya decisión no se juega ni se hace scroll. El velo tapa el
// tablero, `inert` en #app apaga de golpe el ratón, el foco y el árbol de
// accesibilidad de todo lo que hay debajo —incluida la portada, que vive
// dentro— y el overflow oculto en html/body corta el desplazamiento. El banner
// y el diálogo quedan fuera de #app a propósito: son lo único que responde.
const bloqueaHastaDecidir = () => {
  const app = document.getElementById('app');
  if (app) {
    app.setAttribute('aria-busy', 'true');
    app.style.pointerEvents = 'none';
  }
  // El sitio puede seguir siendo leído por el crawler y por el usuario mientras se
  // toma la decisión. La clave es bloquear sólo la interacción del juego, no la
  // página entera, para que la web siga siendo legible y accesible.
  document.getElementById('cookie-velo')?.classList.add('hidden');
};

const liberaTrasDecidir = () => {
  const app = document.getElementById('app');
  if (app) {
    app.removeAttribute('aria-busy');
    app.style.pointerEvents = '';
  }
  document.getElementById('cookie-velo')?.classList.add('hidden');
};

const deleteCookie = (name) => {
  const path = '; path=/';
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${path}`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}${path}`;
};

const removeAnalyticsCookies = () => {
  const analytics = COOKIE_CATALOG.find((cookie) => cookie.id === 'analytics');
  if (!analytics) return;
  analytics.cookies.forEach((cookie) => deleteCookie(cookie));
};

const injectAnalytics = () => {
  if (document.querySelector('script[data-cookie="analytics"]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-2W59RJL0L7';
  script.dataset.cookie = 'analytics';
  script.onload = () => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', 'G-2W59RJL0L7');
  };
  document.head.appendChild(script);
};

const applyCookiePreferences = (preferences) => {
  const analyticsAllowed = Boolean(preferences.analytics);
  window['ga-disable-G-2W59RJL0L7'] = !analyticsAllowed;

  if (analyticsAllowed) {
    injectAnalytics();
  } else {
    removeAnalyticsCookies();
  }
};

const renderCookieOptions = (container, selected = getCookiePreferences()) => {
  container.innerHTML = COOKIE_CATALOG.map((cookie) => {
    const checked = Boolean(selected[cookie.id]);
    const disabled = cookie.required ? 'disabled' : '';
    return `
      <label class="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/3 p-3 ${cookie.required ? 'opacity-90' : ''}">
        <input type="checkbox" data-cookie-id="${cookie.id}" ${checked ? 'checked' : ''} ${disabled}
               class="mt-1 h-4 w-4 accent-white" />
        <span class="flex-1">
          <span class="flex items-center gap-2 text-sm font-semibold text-white">
            ${cookie.label}
            ${cookie.required ? '<span class="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[.12em] text-white/60">Obligatoria</span>' : ''}
          </span>
          <span class="mt-1 block text-sm leading-relaxed text-white/65">${cookie.description}</span>
          ${cookie.vendor ? `<span class="mt-1 block text-[11px] uppercase tracking-[.12em] text-white/50">Proveedor: ${cookie.vendor}</span>` : ''}
        </span>
      </label>
    `;
  }).join('');
};

const openCookieModal = () => {
  const modal = document.getElementById('cookie-modal');
  if (!modal) return;
  renderCookieOptions(document.getElementById('cookie-options'), getCookiePreferences());
  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

const closeCookieModal = () => {
  const modal = document.getElementById('cookie-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
};

const showCookieBanner = () => {
  const banner = document.getElementById('cookie-banner');
  if (!banner) return;
  if (hayDecisionDeCookies()) {
    banner.classList.add('hidden');
    liberaTrasDecidir();
    return;
  }
  banner.classList.remove('hidden');
  bloqueaHastaDecidir();
};

const initCookieBanner = () => {
  const preferences = getCookiePreferences();
  applyCookiePreferences(preferences);

  const banner = document.getElementById('cookie-banner');
  if (banner) {
    const acceptButton = document.getElementById('cookie-accept');
    const rejectButton = document.getElementById('cookie-reject');
    const settingsButton = document.getElementById('cookie-settings');
    const linkButton = document.getElementById('cookie-link');
    const closeButton = document.getElementById('cookie-close');
    const saveButton = document.getElementById('cookie-save');
    const acceptSelectedButton = document.getElementById('cookie-accept-selected');
    const acceptAllModalButton = document.getElementById('cookie-accept-all-modal');

    const allAccepted = COOKIE_CATALOG.reduce((acc, cookie) => {
      acc[cookie.id] = true;
      return acc;
    }, {});

    const acceptPreferences = (nextPrefs) => {
      const saved = saveCookiePreferences(nextPrefs);
      applyCookiePreferences(saved);
      closeCookieModal();
      banner.classList.add('hidden');
      liberaTrasDecidir();
    };

    acceptButton?.addEventListener('click', () => acceptPreferences(allAccepted));
    rejectButton?.addEventListener('click', () => {
      const rejected = COOKIE_CATALOG.reduce((acc, cookie) => {
        acc[cookie.id] = Boolean(cookie.required || cookie.enabledByDefault);
        return acc;
      }, {});
      acceptPreferences(rejected);
    });
    settingsButton?.addEventListener('click', openCookieModal);
    linkButton?.addEventListener('click', openCookieModal);
    closeButton?.addEventListener('click', closeCookieModal);
    saveButton?.addEventListener('click', () => {
      const inputs = document.querySelectorAll('[data-cookie-id]');
      const nextPrefs = COOKIE_CATALOG.reduce((acc, cookie) => {
        const input = [...inputs].find((el) => el.dataset.cookieId === cookie.id);
        acc[cookie.id] = Boolean(cookie.required || input?.checked);
        return acc;
      }, {});
      acceptPreferences(nextPrefs);
    });
    acceptSelectedButton?.addEventListener('click', () => {
      const inputs = document.querySelectorAll('[data-cookie-id]');
      const nextPrefs = COOKIE_CATALOG.reduce((acc, cookie) => {
        const input = [...inputs].find((el) => el.dataset.cookieId === cookie.id);
        acc[cookie.id] = Boolean(cookie.required || input?.checked);
        return acc;
      }, {});
      acceptPreferences(nextPrefs);
    });
    acceptAllModalButton?.addEventListener('click', () => acceptPreferences(allAccepted));
  }

  const current = getCookiePreferences();
  if (!hayDecisionDeCookies()) {
    banner?.classList.remove('hidden');
    bloqueaHastaDecidir();
  } else {
    banner?.classList.add('hidden');
    liberaTrasDecidir();
  }
  if (current.analytics === false) {
    window['ga-disable-G-2W59RJL0L7'] = true;
  }
};

initCookieBanner();

const els = {
  trivial: document.getElementById('trivial'),
  burbujas: document.getElementById('burbujas'),
  rotulo: document.getElementById('rotulo'),
  rotuloCaja: document.getElementById('rotulo-caja'),
  rotuloTxt: document.getElementById('rotulo-txt'),
  rotuloIcono: document.getElementById('rotulo-icono'),
  estado: document.getElementById('estado'),
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
  intro: document.getElementById('intro'),
  introBurbujas: document.getElementById('intro-burbujas'),
  introCats: document.getElementById('intro-cats'),
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
  vistas: new Set(),    // películas ya preguntadas en esta partida
  ronda: null,          // la ronda en juego
  next: null,           // ronda precargada para la siguiente
  locked: true,
  ultima: '',           // firma de la ronda anterior, para no repetirla
  semilla: 0,           // de aquí salen el campo y las veinte rondas
  bitacora: [],         // qué burbuja pulsó, qué respondió y cuánto tardó
  newRecord: false,
  timer: null,
  campo: [],            // posición, tamaño y categoría de cada burbuja
  completadas: new Set(),   // burbujas ya acertadas: salen del campo
  actual: null,         // burbuja elegida por el jugador
  saliendoIntro: false, // la portada se está desvaneciendo
  timerIntro: null,
  reciente: null,       // la recién acertada, que se pinta una vez para reventar
  burbujaTimer: null,   // repintado del campo cuando la acertada acaba de irse

  t0: 0,                // instante en que arrancó la ronda
  corriendo: false,     // bandera propia: t0 puede valer 0 y ser válido
  raf: 0,               // identificador de la animación de la barra
};

/* ---------- utilidades ---------- */

/* ---------- el azar de la partida ----------

   Dos generadores, y no es un capricho: todo lo que decide QUÉ se pregunta y
   cuál es la respuesta sale de `azarPartida`, que va sembrado, de modo que una
   partida entera se puede reproducir a partir de un número. Lo que sólo decide
   cómo se ve —dónde cae cada burbuja, cuánto deriva, qué foto lleva de fondo—
   se queda en `Math.random`.

   Si lo decorativo compartiera el generador sembrado, la secuencia dependería
   del tamaño de la pantalla y de qué imágenes hay en disco, y dos personas con
   la misma semilla jugarían partidas distintas. */

// mulberry32: un PRNG de 32 bits, corto y de calidad de sobra para esto.
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const semillaAlAzar = () => (Math.random() * 4294967296) >>> 0;
let semillaPartida = semillaAlAzar();
let azarPartida = mulberry32(semillaPartida);

// Vuelve a empezar la partida desde esta semilla. Devuelve la que ha quedado,
// que es la que hay que guardar para poder reproducirla.
function siembra(semilla) {
  semillaPartida = (semilla === undefined ? semillaAlAzar() : semilla) >>> 0;
  azarPartida = mulberry32(semillaPartida);
  return semillaPartida;
}

const rnd = (n) => Math.floor(azarPartida() * n);
const pick = (arr) => arr[rnd(arr.length)];
const coin = () => azarPartida() < 0.5;

// Las tres de siempre, para lo que sólo se ve y no se juega.
const rndAdorno = (n) => Math.floor(Math.random() * n);
const pickAdorno = (arr) => arr[rndAdorno(arr.length)];
const fmtMoney = (n) => '$' + n.toLocaleString('es-ES', { maximumFractionDigits: 0 });

/* ---------- imágenes ---------- */

const posterOf = (m) =>
  typeof POSTERS !== 'undefined' && POSTERS[m.r] ? 'posters/' + POSTERS[m.r] : null;
const directorPhoto = (n) =>
  typeof DIRECTOR_PHOTOS !== 'undefined' && DIRECTOR_PHOTOS[n] ? 'directors/' + DIRECTOR_PHOTOS[n] : null;
const actorPhoto = (n) =>
  typeof ACTOR_PHOTOS !== 'undefined' && ACTOR_PHOTOS[n] ? 'actors/' + ACTOR_PHOTOS[n] : null;
const composerPhoto = (n) =>
  typeof COMPOSER_PHOTOS !== 'undefined' && COMPOSER_PHOTOS[n] ? 'composers/' + COMPOSER_PHOTOS[n] : null;

/* ---------- edades ---------- */

const nacio = (n) => (typeof NACIMIENTOS !== 'undefined' ? NACIMIENTOS[n] : undefined);
// Si de alguno de los dos no hay fecha, se deja pasar en vez de descartar: son
// muy pocos y quedarse sin pareja es peor que no poder juzgar la diferencia.
const edadCerca = (a, b, tope = EDAD_MAX) => {
  const x = nacio(a), y = nacio(b);
  return x === undefined || y === undefined ? true : Math.abs(x - y) <= tope;
};

/* ---------- fondos de datos ----------
   Nada entra en juego sin fotografía: las películas siempre tienen carátula,
   pero hay directores y actores sin foto, y esos quedan fuera. */

const PELIS = MOVIES.filter(posterOf);
const CON_DIRECTOR = PELIS.filter((m) => (m.d || []).length && m.d.every(directorPhoto));
const CON_REPARTO = PELIS.filter((m) => reparto(m).length >= 2);
// Como en dirección, se exige foto de todos los firmantes: si a una banda
// sonora a cuatro manos le falta la cara de uno, la carta quedaría a medias.
const CON_BSO = PELIS.filter((m) => (m.bso || []).length && m.bso.every(composerPhoto));
// Una película entra en cada temática para la que tenga datos: no hace falta
// que los tenga todos. Las clásicas, por ejemplo, no siempre traen recaudación.
const CON_TAQUILLA = PELIS.filter((m) => typeof m.g === 'number');
const CON_OSCAR = PELIS.filter((m) => typeof m.o === 'number');
const CON_NOTA = PELIS.filter((m) => typeof m.fa === 'number');
const CON_CATEGORIA = PELIS.filter((m) => (m.oc || []).length);
const CATEGORIAS_OSCAR = [...new Set(CON_CATEGORIA.flatMap((m) => m.oc))];
// En qué años trabajó cada actor, hasta donde alcanzan nuestros datos. Es lo que
// permite escoger un intruso cuya carrera conocida no roce la película por la
// que se pregunta.
const ANIOS_DE_ACTOR = (() => {
  const mapa = new Map();
  CON_REPARTO.forEach((p) => reparto(p).forEach((n) => {
    if (!mapa.has(n)) mapa.set(n, []);
    mapa.get(n).push(p.y);
  }));
  return mapa;
})();
const REPARTOS = [...ANIOS_DE_ACTOR.keys()];
// Los cincuenta con más películas rodadas (actores.js). La foto la trae cada
// uno consigo, así que aquí sólo hay que comprobar que venga.
// La foto la trae cada uno consigo y tools/build-actores.py garantiza que el
// archivo existe: aquí sólo se comprueba que venga el dato.
const TOP_ACTORES = (typeof ACTORES_TOP !== 'undefined' ? ACTORES_TOP : [])
  .filter((a) => a.f && typeof a.p === 'number');
const fotoActorTop = (a) => 'actors/' + a.f;
const DIRECTORES = [...new Set(CON_DIRECTOR.flatMap((m) => m.d))];
const COMPOSITORES = [...new Set(CON_BSO.flatMap((m) => m.bso))];
// En qué años compuso cada uno, hasta donde alcanzan nuestros datos: es lo que
// permite medir si un intruso es de la época de la película o de otra.
const ANIOS_DE_COMPOSITOR = (() => {
  const mapa = new Map();
  CON_BSO.forEach((m) => m.bso.forEach((n) => {
    if (!mapa.has(n)) mapa.set(n, []);
    mapa.get(n).push(m.y);
  }));
  return mapa;
})();

function reparto(m) {
  return (m.a || []).filter(actorPhoto);
}

// Deja fuera las películas ya preguntadas en esta partida. Si quedasen muy
// pocas, devuelve el depósito entero: antes repetir que quedarse sin preguntas.
function frescas(pool, minimo = 10) {
  const libres = pool.filter((m) => !state.vistas.has(m.r));
  return libres.length >= minimo ? libres : pool;
}

/* ---------- construcción de rondas ---------- */

function bandaRatio(level) {
  const lo = RATIO_SUELO + (RATIO_INICIAL - RATIO_SUELO) * Math.pow(RATIO_CAIDA, level - 1);
  return [lo, lo * BANDA];
}

// Filmografía: cuántas películas ha rodado cada uno, medido como ratio igual
// que la taquilla. El tope de 2.0 (2.9 con la banda) es el mismo criterio de no
// enfrentar cosas dispares que rige en los demás duelos.
const FILMO_INICIAL = 2.0, FILMO_SUELO = 1.3, FILMO_CAIDA = 0.87;
// Y además una diferencia mínima en películas, porque los recuentos no son
// exactos: el Excel marca cada cifra como verificada, estimada o provisional y
// le asigna su margen (`tol`). El duelo exige que la diferencia supere la suma
// de los dos márgenes; si no, no lo decidiría el jugador sino el criterio de la
// fuente. Un provisional contra un verificado necesita 18 películas de hueco;
// dos verificados, con 10 les basta.
const FILMO_MINIMO = 10;
const margen = (a, b) => Math.max(FILMO_MINIMO, (a.tol || 0) + (b.tol || 0));

// Diferencia de nota admisible: como mucho punto y medio, y estrechándose hasta
// un par de décimas. Punto y medio ya es un abismo en FilmAffinity, donde el
// catálogo entero cabe entre el 4,8 y el 9.
const NOTA_MAX = 1.5, NOTA_SUELO = 0.2, NOTA_CAIDA = 0.86;

function bandaFilmo(level) {
  const lo = FILMO_SUELO + (FILMO_INICIAL - FILMO_SUELO) * Math.pow(FILMO_CAIDA, level - 1);
  return [lo, lo * BANDA];
}

function huecoNota(level) {
  return NOTA_SUELO + (NOTA_MAX - NOTA_SUELO) * Math.pow(NOTA_CAIDA, level - 1);
}

// Diferencia de años admisible: cinco al principio, uno al final.
function huecoAnios(level) {
  return Math.max(ANIOS_SUELO,
    Math.round(ANIOS_SUELO + (ANIOS_MAX - ANIOS_SUELO) * Math.pow(ANIOS_CAIDA, level - 1)));
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
  decimal: !!opts.decimal,
});

const cartaPersona = (nombre, foto, rol, valor, sufijo) => ({
  img: foto, titulo: nombre, sub: rol, retrato: true, valor, sufijo,
});

// ---- Taquilla: ¿cuál recaudó más? ----
function rondaTaquilla(level) {
  const ratio = (a, b) => (a.g > b.g ? a.g / b.g : b.g / a.g);
  const pool = frescas(CON_TAQUILLA);
  let [lo, hi] = bandaRatio(level);
  for (let i = 0; i < 40; i++) {
    const a = pick(pool);
    // el `b.g !== a.g` es imprescindible: varias películas antiguas comparten
    // cifra redondeada, y un duelo empatado no tendría respuesta correcta
    const rivales = pool.filter((b) => b !== a && b.g !== a.g
      && ratio(a, b) >= lo && ratio(a, b) <= hi);
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
        pelis: [x, y],
        firma: [x.r, y.r].sort((p, q) => p - q).join('-'),
      };
    }
    if (i % 8 === 7) { lo *= 0.92; hi *= 1.12; }
  }
  return null;
}

// ---- Estrenos: ¿cuál se estrenó antes? ----
function rondaAnio(level) {
  // El máximo manda: la pareja nunca se separa más de lo que diga el nivel, y
  // el nivel nunca pasa de ANIOS_MAX. El mínimo va pegado al máximo para que un
  // nivel bajo no suelte por sorpresa un duelo de un año, que es el difícil.
  const maximo = huecoAnios(level);
  const minimo = Math.max(1, maximo - 1);
  const pool = frescas(PELIS);
  for (let i = 0; i < 40; i++) {
    const a = pick(pool);
    const rivales = pool.filter((b) => {
      // `minimo` nunca baja de 1, así que el empate a año queda descartado: un
      // duelo de estreno empatado no tendría respuesta correcta
      const d = Math.abs(a.y - b.y);
      return d >= minimo && d <= maximo;
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
        pelis: [x, y],
        firma: [x.r, y.r].sort((p, q) => p - q).join('-'),
      };
    }
  }
  return null;
}

// ---- Director: ¿dirigió esta persona esta película? ----
function rondaDirector(level) {
  const m = pick(frescas(CON_DIRECTOR));
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
    pelis: [m],
    explica: `${real}.`,
    firma: `dir-${m.r}-${nombre}`,
  };
}

// ---- Banda sonora: ¿compuso esta persona la de esta película? ----
// Calcada de la de dirección, incluido el equilibrio: la respuesta se sortea
// primero y luego se busca a quién nombrar, para que ni el sí ni el no salgan
// gratis.
function rondaBso(level) {
  const m = pick(frescas(CON_BSO));
  const verdadero = coin();
  let nombre;
  if (verdadero) {
    nombre = pick(m.bso);
  } else {
    // cuanto más alto el nivel, más plausible el intruso: de la misma época,
    // que es cuando de verdad hay que saberse quién firmó qué
    const cerca = level > 6;
    const candidatos = COMPOSITORES.filter((n) => {
      if (m.bso.includes(n)) return false;
      if (!cerca) return true;
      return (ANIOS_DE_COMPOSITOR.get(n) || []).some((y) => Math.abs(y - m.y) <= 6);
    });
    nombre = pick(candidatos.length ? candidatos : COMPOSITORES.filter((n) => !m.bso.includes(n)));
  }
  if (!nombre) return null;
  const real = m.bso.length > 1
    ? `La compusieron ${m.bso.join(' y ')}`
    : `La compuso ${m.bso[0]}`;
  return {
    tipo: 'bso',
    pregunta: `¿Compuso ${nom(nombre)} la banda sonora de ${nom(m.t)}?`,
    modo: 'sino',
    cartas: [cartaPeli(m), cartaPersona(nombre, composerPhoto(nombre), 'Compositor')],
    correcta: verdadero,
    pelis: [m],
    explica: `${real}.`,
    firma: `bso-${m.r}-${nombre}`,
  };
}

// ---- Reparto: ¿coincidieron estos dos actores? ----
function rondaActores(level) {
  const m = pick(frescas(CON_REPARTO));
  const cast = reparto(m);
  const juntos = coin();
  let candidatos;
  if (juntos) {
    candidatos = cast;
  } else {
    const hueco = Math.max(HUECO_SEGURO, Math.round(30 - level));
    // El intruso tiene que estar lejos en TODA su filmografía conocida, no sólo
    // en una película. Antes se cogía el reparto de las películas lejanas, y
    // bastaba con que el actor tuviera una lejana para entrar: podía tener otra
    // del mismo año que la preguntada y aun así afirmarse que no coincidieron.
    candidatos = REPARTOS.filter((n) => !(m.a || []).includes(n)
      && (ANIOS_DE_ACTOR.get(n) || []).every((y) => Math.abs(y - m.y) >= hueco));
    if (!candidatos.length) return null;
  }
  // Varias tiradas buscando dos de una quinta parecida. Si no aparece ninguna
  // —un reparto con un niño y un veterano, por ejemplo—, vale la última que
  // salga: quedarse sin ronda es peor, porque la burbuja acabaría soltando la
  // pregunta de otra categoría.
  let a = null, b = null;
  for (let i = 0; i < 12; i++) {
    const x = pick(cast);
    const otros = candidatos.filter((n) => n !== x);
    if (!otros.length) continue;
    const cerca = otros.filter((n) => edadCerca(x, n));
    a = x;
    b = pick(cerca.length ? cerca : otros);
    if (cerca.length) break;
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
    pelis: [m],
    explica: juntos ? `Sí: los dos están en ${m.t}.` : `No: ${b} no sale en ${m.t}.`,
    firma: `act-${m.r}-${a}-${b}`,
  };
}

// ---- Óscars: ¿ganó alguno? ----
function rondaOscar() {
  // se equilibra a propósito: sin esto saldría "no" tres de cada cuatro veces
  const conPremio = coin();
  const pool = frescas(CON_OSCAR.filter((m) => (m.o > 0) === conPremio), 6);
  if (!pool.length) return null;
  const m = pick(pool);
  return {
    tipo: 'oscar',
    pregunta: `¿Ganó ${nom(m.t)} algún Óscar?`,
    modo: 'sino',
    cartas: [cartaPeli(m)],
    correcta: m.o > 0,
    pelis: [m],
    explica: m.o > 0
      ? `Ganó ${m.o} ${m.o === 1 ? 'Óscar' : 'Óscars'}.`
      : 'No ganó ninguno.',
    firma: `osc-${m.r}`,
  };
}

// ---- Crítica: ¿cuál tiene mejor nota en FilmAffinity? ----
function rondaCritica(level) {
  const maximo = huecoNota(level);
  const minimo = Math.max(0.1, maximo * 0.55);
  const pool = frescas(CON_NOTA);
  for (let i = 0; i < 40; i++) {
    const a = pick(pool);
    const rivales = pool.filter((b) => {
      // la resta de dos notas de una decimal arrastra ruido binario (8.1 - 7.2
      // da 0.8999…), y sin redondear la comparación con la banda falla por poco
      const d = Math.round(Math.abs(a.fa - b.fa) * 10) / 10;
      return d >= minimo && d <= maximo;
    });
    if (rivales.length) {
      const b = pick(rivales);
      const [x, y] = coin() ? [a, b] : [b, a];
      return {
        tipo: 'critica',
        pregunta: `¿Cuál tiene mejor nota en FilmAffinity, ${nom(x.t)} o ${nom(y.t)}?`,
        modo: 'elige',
        cartas: [cartaPeli(x, { valor: x.fa, decimal: true }),
                 cartaPeli(y, { valor: y.fa, decimal: true })],
        correcta: x.fa > y.fa ? 0 : 1,
        pelis: [x, y],
        firma: `fa-${[x.r, y.r].sort((p, q) => p - q).join('-')}`,
      };
    }
  }
  return null;
}

// ---- Filmografía: ¿quién ha rodado más películas? ----
function rondaFilmografia(level) {
  const ratio = (a, b) => (a.p > b.p ? a.p / b.p : b.p / a.p);
  const pool = TOP_ACTORES;
  let [lo, hi] = bandaFilmo(level);
  for (let i = 0; i < 40; i++) {
    const a = pick(pool);
    // Siete actores comparten las 55 películas y cinco las 60: un duelo
    // empatado no tendría respuesta correcta, así que `FILMO_MINIMO` los
    // descarta de paso.
    const rivales = pool.filter((b) => b !== a
      && Math.abs(b.p - a.p) >= margen(a, b)
      && ratio(a, b) >= lo && ratio(a, b) <= hi);
    if (rivales.length) {
      const b = pick(rivales);
      const [x, y] = coin() ? [a, b] : [b, a];
      return {
        tipo: 'filmografia',
        pregunta: `¿Quién ha rodado más películas, ${nom(x.n)} o ${nom(y.n)}?`,
        modo: 'elige',
        cartas: [cartaPersona(x.n, fotoActorTop(x), 'Intérprete', x.p, ' películas'),
                 cartaPersona(y.n, fotoActorTop(y), 'Intérprete', y.p, ' películas')],
        correcta: x.p > y.p ? 0 : 1,
        // no lleva `pelis`: el depósito son personas, no películas, y `vistas`
        // guarda identificadores de película
        firma: `fi-${[x.n, y.n].sort().join('-')}`,
      };
    }
    if (i % 8 === 7) { lo *= 0.94; hi *= 1.1; }
  }
  return null;
}

// ---- Categoría: ¿ganó el Óscar a tal cosa? ----
function rondaCategoria() {
  const m = pick(frescas(CON_CATEGORIA, 6));
  const acertada = coin();
  const ajenas = CATEGORIAS_OSCAR.filter((c) => !m.oc.includes(c));
  const cat = acertada ? pick(m.oc) : pick(ajenas);
  if (!cat) return null;
  return {
    tipo: 'oscarcat',
    pregunta: `¿Ganó ${nom(m.t)} el Óscar a ${nom(cat)}?`,
    modo: 'sino',
    cartas: [cartaPeli(m)],
    correcta: acertada,
    pelis: [m],
    explica: `Ganó ${m.oc.length === 1 ? 'el Óscar a' : 'los Óscars a'} ${m.oc.join(', ')}.`,
    firma: `cat-${m.r}-${cat}`,
  };
}

const TIPOS = [
  { id: 'taquilla', peso: 3, crea: rondaTaquilla, hay: () => CON_TAQUILLA.length > 1 },
  { id: 'anio', peso: 2, crea: rondaAnio, hay: () => PELIS.length > 1 },
  { id: 'director', peso: 2, crea: rondaDirector, hay: () => CON_DIRECTOR.length > 1 },
  { id: 'actores', peso: 2, crea: rondaActores, hay: () => CON_REPARTO.length > 1 },
  { id: 'oscar', peso: 2, crea: rondaOscar, hay: () => CON_OSCAR.length > 1 },
  { id: 'oscarcat', peso: 2, crea: rondaCategoria, hay: () => CON_CATEGORIA.length > 1 },
  { id: 'critica', peso: 2, crea: rondaCritica, hay: () => CON_NOTA.length > 1 },
  { id: 'filmografia', peso: 2, crea: rondaFilmografia, hay: () => TOP_ACTORES.length > 1 },
  { id: 'bso', peso: 2, crea: rondaBso, hay: () => CON_BSO.length > 1 && COMPOSITORES.length > 1 },
];

// `categoria` la impone la burbuja elegida; sin ella se sortea por peso
function nuevaRonda(level, categoria) {
  const disponibles = TIPOS.filter((t) => t.hay());
  const forzado = categoria && TIPOS.find((t) => t.id === categoria && t.hay());
  for (let intento = 0; intento < 30; intento++) {
    const tipo = forzado || porPeso(disponibles);
    const r = tipo.crea(level);
    if (r && r.firma !== state.ultima) {
      state.ultima = r.firma;
      (r.pelis || []).forEach((m) => state.vistas.add(m.r));
      return r;
    }
  }
  return rondaTaquilla(level) || rondaOscar();
}

function porPeso(tipos) {
  const total = tipos.reduce((s, t) => s + t.peso, 0);
  let n = azarPartida() * total;
  for (const t of tipos) {
    n -= t.peso;
    if (n <= 0) return t;
  }
  return tipos[tipos.length - 1];
}

/* ---------- pintado ---------- */

// En móvil, las rondas de tres tarjetas ponen la película sola arriba y los dos
// actores debajo compartiendo fila; de tablet en adelante van las tres en línea.
const COLS = {
  1: 'grid-cols-1 sm:grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
};

// Con cinco tipos de ronda conviene decir de qué va antes de leer la pregunta
const ETIQUETAS = {
  taquilla: 'Taquilla',
  anio: 'Estrenos',
  director: 'Dirección',
  actores: 'Reparto',
  oscar: 'Óscars',
  oscarcat: 'Categoría',
  critica: 'Crítica',
  filmografia: 'Filmografía',
  bso: 'Banda sonora',
};

function cartaHTML(c, i, clicable, anchaEnMovil) {
  const etiqueta = clicable ? 'button' : 'div';
  // la película ocupa la fila entera en móvil cuando hay tres tarjetas
  const tramo = anchaEnMovil ? 'col-span-2 sm:col-span-1' : '';
  // Altos un 15 % por debajo, sobre el mínimo de móvil que ya bajaba otro 10 %
  // en pantalla estrecha. Los anchos no se tocan: el encuadre recorta algo más
  // y eso lo absorbe object-cover.
  const ALTO = 0.85;
  const escalaMovil = typeof window !== 'undefined' && window.innerWidth
    ? (window.innerWidth < 640 ? 0.9 : 1) : 1;
  const minMovil = Math.round((c.retrato ? 200 : 220) * escalaMovil * ALTO);
  const alto = c.retrato
    ? `min-h-[${minMovil}px] sm:h-[230px] sm:w-[180px] lg:h-[344px] lg:w-[270px] sm:justify-self-center`
    : `min-h-[${minMovil}px] sm:h-[238px] sm:w-[186px] lg:h-[min(425px,48vh)] lg:w-[334px] sm:justify-self-center`;
  return `
    <${etiqueta} ${clicable ? `data-index="${i}"` : ''}
      class="carta ${tramo} ${clicable ? 'choice foco cursor-pointer' : 'pointer-events-none'}
             group relative flex ${alto} flex-col justify-end overflow-hidden rounded-[26px]
             border border-white/10 bg-white/[.06] text-center shadow-[0_18px_50px_rgba(0,0,0,.55)]"
      style="min-height: ${minMovil}px">
      <img class="js-img absolute inset-0 h-full w-full scale-105 object-cover ${c.retrato ? '[object-position:50%_25%]' : ''}
                  opacity-0 brightness-[.62] saturate-[.95] transition-all duration-500
                  group-hover:brightness-90 group-hover:saturate-100"
           alt="" aria-hidden="true" />
      <div class="pointer-events-none absolute inset-0"
           style="background:linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.1) 100%)"></div>
      <div class="relative flex flex-col items-center px-4 pb-5 pt-6">
        ${c.sub ? `<span class="mb-2 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/80 backdrop-blur-sm">${c.sub}</span>` : ''}
        <span class="tight text-lg font-semibold leading-tight text-white lg:text-2xl">${c.titulo}</span>
        <span class="js-valor display mt-2 h-7 whitespace-nowrap text-lg leading-none text-white opacity-0 transition-opacity duration-300 lg:text-2xl"></span>
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
    'relative grid flex-1 gap-3 sm:mx-auto sm:w-fit sm:items-center sm:gap-4 lg:gap-5 ' +
    (COLS[r.cartas.length] || COLS[2]);
  els.cards.innerHTML = r.cartas
    .map((c, i) => cartaHTML(c, i, clicable, r.cartas.length === 3 && i === 0))
    .join('');

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
function countUp(el, target, dinero, decimal, sufijo = '') {
  const start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / COUNT_MS, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = target * eased;
    el.textContent = (dinero ? fmtMoney(Math.round(v))
      : decimal ? v.toFixed(1).replace('.', ',')
      : String(Math.round(v))) + sufijo;
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
    if (c.dinero || c.decimal || r.tipo === 'anio' || r.tipo === 'filmografia')
      countUp(v, c.valor, c.dinero, c.decimal, c.sufijo || '');
    else v.textContent = c.valor;
  });
}

/* ---------- pantalla previa ---------- */

// La portada se dibuja con las mismas piezas que el juego: esferas de las siete
// categorías y sus iconos. Así lo primero que se ve ya explica de qué va.
function pintaIntro() {
  // Doce esferas repartidas por la pantalla entera, con la misma receta que el
  // campo: foto debajo, velo de color encima, la misma deriva de dos ejes y el
  // desenfoque de profundidad de campo. La portada no ilustra el juego: es el
  // juego en reposo.
  // El tamaño sale de medir el contenedor, no de píxeles fijos: aquí el
  // contenedor es la ventana entera y unas esferas de 70 px se perderían.
  const W = els.introBurbujas.clientWidth || 1280;
  const H = els.introBurbujas.clientHeight || 800;
  const base = Math.max(52, Math.min(190, Math.min(W / 6.2, H / 4.4)));
  // x, y en % de la pantalla · k, factor sobre el diámetro base
  const reparto = [
    { cat: 'taquilla',    x:  8, y: 18, k: .82, tx: 31, ty: 25, rx: -7,  ry: -12 },
    { cat: 'critica',     x: 23, y: 72, k: 1.0, tx: 35, ty: 28, rx: -14, ry: -9 },
    { cat: 'anio',        x: 38, y: 12, k: .58, tx: 33, ty: 27, rx: -11, ry: -14 },
    { cat: 'oscar',       x: 91, y: 30, k: .95, tx: 29, ty: 23, rx: -5,  ry: -6 },
    { cat: 'filmografia', x: 76, y: 78, k: .74, tx: 26, ty: 36, rx: -18, ry: -21 },
    { cat: 'director',    x: 60, y: 86, k: .62, tx: 27, ty: 34, rx: -3,  ry: -2 },
    { cat: 'actores',     x: 93, y: 62, k: .5,  tx: 22, ty: 32, rx: -9,  ry: -17 },
    { cat: 'oscarcat',    x: 12, y: 46, k: .66, tx: 24, ty: 30, rx: 0,   ry: -5 },
    { cat: 'taquilla',    x: 68, y: 16, k: .54, tx: 28, ty: 33, rx: -22, ry: -8 },
    { cat: 'anio',        x: 45, y: 44, k: .44, tx: 36, ty: 26, rx: -16, ry: -25 },
    { cat: 'oscar',       x: 30, y: 30, k: .4,  tx: 30, ty: 38, rx: -12, ry: -3 },
    { cat: 'actores',     x: 55, y: 66, k: .46, tx: 25, ty: 31, rx: -20, ry: -19 },
  ];
  const usadas = new Set();
  els.introBurbujas.innerHTML = reparto.map((b) => {
    const { luz, medio, hondo } = ESFERA[b.cat];
    const img = imagenPara(b.cat, usadas);
    const d = base * b.k;
    // las pequeñas quedan al fondo y desenfocadas, como en el campo
    const desenfoque = Math.max(0, (1 - b.k) * 4.5).toFixed(1);
    const velo = `${luz}99 0%, ${medio}80 46%, ${hondo}a6 100%`;
    const encuadre = ES_PERSONA.has(b.cat) ? 'center 28%' : 'center';
    // comillas simples: las dobles cerrarían el atributo style
    const fondo = img
      ? `radial-gradient(circle at 32% 26%, ${velo}), url('${img}') ${encuadre}/cover`
      : `radial-gradient(circle at 32% 26%, ${luz} 0%, ${medio} 46%, ${hondo} 100%)`;
    const sombra = `0 26px 54px -14px ${medio}5c, 0 6px 18px -6px rgba(0,0,0,.5)`;
    const dx = (d * 0.16).toFixed(1);
    const dy = (d * 0.14).toFixed(1);
    return `
      <div class="burbuja absolute" style="left:${b.x}%;top:${b.y}%">
       <div class="deriva-x" style="--dx:${dx}px;--tx:${b.tx}s;--rx:${b.rx}s">
        <div class="deriva-y" style="--dy:${dy}px;--ty:${b.ty}s;--ry:${b.ry}s">
         <div class="esfera" style="width:${d.toFixed(1)}px;aspect-ratio:1;
                background:${fondo};
                box-shadow:${sombra};
                filter:blur(${desenfoque}px)"></div>
        </div>
       </div>
      </div>`;
  }).join('');

  // Cada temática como un cartelito, con una foto suya de fondo igual que las
  // burbujas: el código de color y el tipo de imagen se aprenden aquí y no a
  // base de fallar partidas. Comparten el `usadas` de las esferas, así que en
  // toda la portada no se repite ninguna imagen.
  els.introCats.innerHTML = CATEGORIAS.map((cat) => {
    const color = COLORES[cat];
    const { medio, hondo } = ESFERA[cat];
    const img = imagenPara(cat, usadas);
    const encuadre = ES_PERSONA.has(cat) ? 'center 22%' : 'center';
    // comillas simples: las dobles cerrarían el atributo style
    const fondo = img
      ? `url('${img}') ${encuadre}/cover`
      : `linear-gradient(160deg, ${medio}, ${hondo})`;
    return `<span class="cartel group relative block w-[calc(20%-0.3rem)] overflow-hidden rounded-xl sm:w-auto sm:rounded-2xl"
                  style="aspect-ratio:3/4;background:${fondo};box-shadow:0 14px 30px -14px rgba(0,0,0,.8)">
      <!-- velo de color: identifica la categoría y deja legible el rótulo -->
      <span class="pointer-events-none absolute inset-0"
            style="background:linear-gradient(to top, ${hondo}f2 0%, ${hondo}bf 34%, ${medio}4d 72%, ${medio}1a 100%)"></span>
      <span class="absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 px-0.5 pb-1.5 pt-5 sm:gap-1.5 sm:px-1 sm:pb-2.5 sm:pt-6">
        ${iconoHTML(cat, { clase: 'h-3 w-3 sm:h-[18px] sm:w-[18px]', color: '#fff', grosor: 1.9 })}
        <span class="text-center text-[8px] font-semibold leading-[1.15] tracking-tight text-white sm:text-[11px]"
              style="text-shadow:0 1px 6px rgba(0,0,0,.7)">${ETIQUETAS[cat]}</span>
      </span>
      <!-- filo de color, que es lo que los hace parecer carteles enmarcados -->
      <span class="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl"
            style="box-shadow:inset 0 0 0 1px ${color}59"></span>
    </span>`;
  }).join('');
}

/* ---------- campo de burbujas ---------- */

// Cada burbuja lleva de fondo una foto de su temática, sacada de los archivos
// del propio juego: un director para dirección, un actor para reparto, y
// carátulas escogidas según el criterio de cada categoría.
const ACTORES_EN_JUEGO = [...new Set(CON_REPARTO.flatMap(reparto))];
const ES_PERSONA = new Set(['director', 'actores', 'filmografia', 'bso']);
// Depósitos de imagen de fondo. Son amplios a propósito: con 4 burbujas de cada
// categoría por partida, un depósito de 15 hace que se repitan las mismas
// carátulas partida tras partida.
const TOP_TAQUILLA = CON_TAQUILLA.slice(0, 45);
const CLASICAS = PELIS.filter((m) => m.y <= 2012);
const PREMIADAS = PELIS.filter((m) => (m.o || 0) >= 1);
const MEJOR_VALORADAS = [...CON_NOTA].sort((a, b) => b.fa - a.fa).slice(0, 40);

function imagenPara(cat, usadas) {
  const fuentes = {
    taquilla: () => posterOf(pickAdorno(TOP_TAQUILLA)),
    anio: () => posterOf(pickAdorno(CLASICAS.length ? CLASICAS : PELIS)),
    director: () => directorPhoto(pickAdorno(DIRECTORES)),
    actores: () => actorPhoto(pickAdorno(ACTORES_EN_JUEGO)),
    oscar: () => posterOf(pickAdorno(PREMIADAS.length ? PREMIADAS : PELIS)),
    filmografia: () => (TOP_ACTORES.length ? fotoActorTop(pickAdorno(TOP_ACTORES)) : null),
    bso: () => (COMPOSITORES.length ? composerPhoto(pickAdorno(COMPOSITORES)) : null),
  };
  const dame = fuentes[cat] || fuentes.taquilla;
  // varios intentos para no repetir imagen en el mismo campo
  for (let i = 0; i < 25; i++) {
    const url = dame();
    if (url && !usadas.has(url)) { usadas.add(url); return url; }
  }
  return dame();
}

// Rejilla con desorden: cada burbuja nace en su celda y se desplaza un poco al
// azar. Se ve repartido por la pantalla y, a diferencia de sortear posiciones
// libres, nunca se solapan.
function reparteBurbujas() {
  // Veinte burbujas entre nueve categorías no reparten exacto: cada una sale dos
  // veces y dos salen una tercera. Las agraciadas se sortean en cada partida,
  // así que no son siempre las mismas las que aparecen más.
  // Se reparte a mano en vez de quitar sobrantes al azar: quitando al azar podía
  // caer tres veces sobre la misma categoría y dejarla sin ninguna burbuja.
  // Sólo las que de verdad pueden plantear pregunta: si un archivo de datos no
  // llegara a cargar, su categoría se queda fuera del campo en vez de dar una
  // burbuja que al pulsarla suelta la pregunta de otra.
  const jugables = CATEGORIAS.filter((c) => {
    const t = TIPOS.find((x) => x.id === c);
    return t && t.hay();
  });
  const usables = jugables.length ? jugables : CATEGORIAS;
  const base = Math.floor(BURBUJAS / usables.length);
  const extra = BURBUJAS % usables.length;
  const cats = [];
  usables.forEach((c) => { for (let i = 0; i < base; i++) cats.push(c); });
  // Estas dos barajas sí salen del azar sembrado: qué categorías hay en el campo
  // y en qué orden es parte de la partida, no de cómo se ve.
  const sobran = [...usables];
  barajaEnSitio(sobran);
  cats.push(...sobran.slice(0, extra));
  barajaEnSitio(cats);

  const campo = [];
  const usadas = new Set();
  const rejilla = esEstrecha() ? REJILLA_ALTA : REJILLA_ANCHA;
  const { columnas, filas } = rejilla;
  campoRejilla = rejilla;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const i = f * columnas + c;
      campo.push({
        cat: cats[i],
        img: imagenPara(cats[i], usadas),
        // el desorden se mide en fracción de celda: con rejillas distintas, un
        // valor fijo en porcentaje de pantalla se come filas enteras
        // De aquí abajo todo es adorno y va con Math.random: la posición y la
        // deriva dependen de la rejilla, y la rejilla del tamaño de la pantalla.
        x: ((c + 0.5) / columnas) * 100 + (Math.random() - 0.5) * (100 / columnas) * 0.3,
        y: ((f + 0.5) / filas) * 100 + (Math.random() - 0.5) * (100 / filas) * 0.3,
        escala: 0.74 + Math.random() * 0.52,
        // Dos ejes con periodos largos y distintos: la trayectoria resultante no
        // se repite a la vista y el movimiento nunca se detiene salvo en los
        // extremos de cada eje. El recorrido va en fracción del diámetro, no en
        // píxeles fijos: en un móvil, 38 px de deriva sacaban la burbuja fuera.
        dx: (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.16),
        dy: (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.16),
        tx: 26 + Math.random() * 18,
        ty: 31 + Math.random() * 21,
        rx: -Math.random() * 30,
        ry: -Math.random() * 30,
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

// El diámetro se calcula midiendo el contenedor. Sacarlo sólo del ancho (vw)
// ignoraba el alto, y con siete filas en un móvil corto las burbujas se
// solapaban verticalmente.
function diametroBase() {
  const w = els.burbujas.clientWidth || 1104;
  const h = els.burbujas.clientHeight || 700;
  const celda = Math.min(w / campoRejilla.columnas, h / campoRejilla.filas);
  const base = celda * 0.78;
  // En móvil las burbujas deben ser un 15% más grandes
  const movilMult = esEstrecha() ? 1.15 : 1;
  return Math.max(30, Math.min(150, base * movilMult));
}

function pintaBurbujas() {
  const base = diametroBase();
  const W = els.burbujas.clientWidth || 1104;
  const H = els.burbujas.clientHeight || 700;
  els.burbujas.innerHTML = state.campo.map((b, i) => {
    const { luz, medio, hondo } = ESFERA[b.cat];
    // Las acertadas desaparecen del campo. La de la ronda que acaba de caer se
    // pinta una última vez para que se la vea reventar; a partir de ahí, ni se
    // dibuja. Antes se quedaban apagadas, y el campo terminaba lleno de restos.
    const reventando = i === state.reciente;
    if (state.completadas.has(i) && !reventando) return '';
    const elegida = i === state.actual;
    const desenfoque = elegida ? 0 : Math.max(0, (1.06 - b.escala) * 5).toFixed(1);
    const escala = elegida ? 1.5 : 1;
    // La foto va debajo y el color encima con alfa: el resultado es la foto a la
    // mitad de intensidad, conservando la identidad de color de la categoría.
    const velo = `${luz}99 0%, ${medio}80 46%, ${hondo}a6 100%`;
    // comillas simples: las dobles cerrarían el atributo style y tumbarían el
    // estilo entero a partir de ahí
    // Las fotos de personas se encuadran algo por encima del centro: es donde
    // cae la cara en un retrato, y en un recorte circular el centro geométrico
    // la deja demasiado arriba.
    const encuadre = ES_PERSONA.has(b.cat) ? 'center 28%' : 'center';
    const fondo = b.img
      ? `radial-gradient(circle at 32% 26%, ${velo}), url('${b.img}') ${encuadre}/cover`
      : `radial-gradient(circle at 32% 26%, ${luz} 0%, ${medio} 46%, ${hondo} 100%)`;
    const sombra = `0 26px 54px -14px ${medio}5c, 0 6px 18px -6px rgba(0,0,0,.5)`;
    // La posición se corrige para que la burbuja, con su deriva incluida, no
    // asome fuera del campo: sin esto las columnas de los extremos se salían.
    const radio = (base * b.escala) / 2;
    const dxPx = b.dx * base;
    const dyPx = b.dy * base;
    const mx = radio + Math.abs(dxPx) + 2;
    const my = radio + Math.abs(dyPx) + 2;
    const cx = Math.min(Math.max((b.x / 100) * W, mx), Math.max(mx, W - mx));
    const cy = Math.min(Math.max((b.y / 100) * H, my), Math.max(my, H - my));
    return `
      <div class="burbuja absolute"
           style="left:${((cx / W) * 100).toFixed(2)}%;top:${((cy / H) * 100).toFixed(2)}%;z-index:${elegida ? 30 : 10}">
       <div class="deriva-x" style="--dx:${dxPx.toFixed(1)}px;--tx:${b.tx}s;--rx:${b.rx}s">
        <div class="deriva-y relative" style="--dy:${dyPx.toFixed(1)}px;--ty:${b.ty}s;--ry:${b.ry}s">
        <button data-burbuja="${i}" ${reventando ? 'disabled aria-hidden="true"' : ''}
             class="esfera relative ${elegida ? 'esfera-elegida' : ''}
                    ${reventando ? 'revienta pointer-events-none' : 'esfera-tocable'}"
             style="width:${(base * b.escala).toFixed(1)}px;aspect-ratio:1;
                    background:${fondo};
                    --sombra:${sombra};--halo:${medio}55;
                    box-shadow:${sombra};
                    transform: scale(${escala});
                    filter:blur(${desenfoque}px)"
             aria-label="${ETIQUETAS[b.cat]}, elegir">
          ${reventando ? '' : `<span class="etiqueta pointer-events-none absolute inset-0 flex items-center
                          justify-center px-2 text-center font-bold uppercase leading-none tracking-tight text-white"
                          style="font-size:${Math.max(9, 11 * b.escala).toFixed(1)}px;
                                 text-shadow:0 1px 8px rgba(0,0,0,.65), 0 0 2px rgba(0,0,0,.5)">${ETIQUETAS[b.cat]}</span>`}
        </button>
        </div>
       </div>
      </div>`;
  }).join('');
}

// Rótulo con la temática de la burbuja que ha salido
function muestraRotulo(cat) {
  els.rotuloIcono.innerHTML =
    iconoHTML(cat, { clase: 'h-full w-full', color: COLORES[cat], grosor: 1.5 });
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

function muestraTablero() {
  clearTimeout(state.burbujaTimer);
  els.trivial.classList.remove('hidden');
  els.trivial.classList.add('flex');
  els.board.classList.add('hidden');
  els.board.classList.remove('flex');
  state.actual = null;
  ocultaRotulo();
  pintaBurbujas();
  const quedan = BURBUJAS - state.completadas.size;
  // La recién acertada se ha pintado sólo para reventar: al acabar la animación
  // se repinta el campo ya sin ella. El repintado va por temporizador y no por
  // `animationend`, porque un cambio de tamaño de ventana rehace el marcado y
  // el evento se perdería con el nodo.
  if (state.reciente !== null) {
    state.burbujaTimer = setTimeout(() => {
      state.reciente = null;
      pintaBurbujas();
      // La vigésima también revienta, y la enhorabuena espera a que el campo se
      // haya quedado vacío: es el remate de la partida y hay que verlo.
      if (quedan === 0) state.burbujaTimer = setTimeout(victoria, VACIO_MS);
    }, REVIENTA_MS);
  } else if (quedan === 0) {
    return victoria();
  }
  els.estado.textContent = quedan === 0
    ? '¡Las veinte!'
    : quedan === 1
      ? 'Elige la última burbuja'
      : `Elige una burbuja · quedan ${quedan}`;
}

// El usuario elige la burbuja; ya no hay sorteo. Se luce un momento con su
// rótulo y a continuación se abre la pregunta de su categoría.
function eligeBurbuja(i) {
  if (state.actual !== null || state.completadas.has(i)) return;
  const previo = state.actual;
  state.actual = i;
  // Actualiza sólo las burbujas afectadas para evitar re-render completo
  updateBubbleSelection(previo, i);
  const cat = state.campo[i].cat;
  els.estado.textContent = ETIQUETAS[cat];
  muestraRotulo(cat);
  const ronda = nuevaRonda(state.score + 1, cat);
  precarga(ronda);
  state.timer = setTimeout(() => lanzaPregunta(ronda), ELEGIDA_MS);
}

function updateBubbleSelection(prevIndex, newIndex) {
  // Remove selection from previous (apply in RAF to avoid layout thrash)
  if (prevIndex !== null && prevIndex !== undefined) {
    const prevBtn = document.querySelector(`[data-burbuja="${prevIndex}"]`);
    if (prevBtn) {
      window.requestAnimationFrame(() => {
        prevBtn.classList.remove('esfera-elegida');
        prevBtn.classList.add('esfera-tocable');
        // reset transform to normal (use translateZ(0) to trigger compositing)
        prevBtn.style.transform = 'translateZ(0) scale(1)';
        const prevWrapper = prevBtn.closest('.burbuja');
        if (prevWrapper) prevWrapper.style.zIndex = '';
      });
    }
  }

  // Apply selection to new (in RAF)
  if (newIndex !== null && newIndex !== undefined) {
    const newBtn = document.querySelector(`[data-burbuja="${newIndex}"]`);
    if (newBtn) {
      window.requestAnimationFrame(() => {
        newBtn.classList.add('esfera-elegida');
        newBtn.classList.remove('esfera-tocable');
        // selection uses scale 1.5 for emphasis; ensure compositing with translateZ(0)
        newBtn.style.transform = 'translateZ(0) scale(1.5)';
        const newWrapper = newBtn.closest('.burbuja');
        if (newWrapper) newWrapper.style.zIndex = 30;
      });
    }
  }
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

// La partida se anota jugada a jugada. Con esto y la semilla se puede
// reconstruir entera: la burbuja dice qué categoría se preguntó, y de ahí sale
// la ronda; la respuesta y el tiempo son lo único que pone el jugador.
// `r` a null es que se agotó el tiempo, que no es lo mismo que fallar.
function anota(eleccion, ms) {
  state.bitacora.push({ b: state.actual, r: eleccion, ms: Math.round(ms) });
}

function responde(eleccion) {
  if (state.locked) return;
  const ms = paraCronometro();
  anota(eleccion, ms);
  resuelve(eleccion === state.ronda.correcta, ms);
}

function tiempoAgotado() {
  if (state.locked) return;
  paraCronometro();
  anota(null, TIEMPO);
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
    state.reciente = state.actual;
    state.timer = setTimeout(volverAlTablero, REVEAL_MS);
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
      state.timer = setTimeout(gameOver, GAMEOVER_MS);
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
  if (r.tipo === 'critica') {
    return `${gana.titulo} tiene un ${gana.valor.toFixed(1).replace('.', ',')} en FilmAffinity.`;
  }
  if (r.tipo === 'filmografia') {
    return `${gana.titulo} ha rodado ${gana.valor} películas, ${Math.abs(a.valor - b.valor)} más.`;
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

// Con qué versión de los datos se jugó. Reproducir una partida exige el mismo
// `movies.js` que tenía delante el jugador: si se regenera el catálogo, las
// mismas semillas dejan de dar las mismas rondas. La huella ya está puesta en
// cada `<script src>` por tools/sella-versiones.py, así que basta con leerla.
function versionDeDatos() {
  const datos = {};
  document.querySelectorAll('script[src]').forEach((s) => {
    const m = s.getAttribute('src').match(/^([\w.-]+\.js)\?v=([a-f0-9]+)$/);
    if (m && m[1] !== 'main.js') datos[m[1]] = m[2];
  });
  return datos;
}

function guardaResultadoFinal({ titulo, etiqueta, detalle, record }) {
  const payload = {
    titulo,
    score: state.puntos,
    best: state.best,
    etiqueta,
    detalle,
    record,
    completadas: state.completadas.size,
    total: BURBUJAS,
    // La partida en crudo: con esto se puede rehacer y comprobar entera.
    partida: {
      semilla: state.semilla,
      campo: state.campo.map((b) => b.cat),
      jugadas: state.bitacora,
      datos: versionDeDatos(),
    },
  };
  try {
    localStorage.setItem('billions.lastResult', JSON.stringify(payload));
  } catch (error) {
    // Modo privado o almacenamiento no disponible: no bloquea la experiencia.
  }
  window.location.href = 'fin.html';
}

function victoria() {
  clearTimeout(state.timer);
  hideToast();
  const sinFallos = state.vidas === VIDAS;
  const detalle =
    (sinFallos
      ? 'Y además <strong class="text-white">sin fallar ni una vez</strong>.'
      : `Te ${state.vidas === 1 ? 'quedaba' : 'quedaban'} <strong class="text-white">${state.vidas}</strong> ` +
        `${state.vidas === 1 ? 'vida' : 'vidas'}.`) +
    (state.newRecord
      ? '<br><span class="text-[#30D158]">¡Nuevo récord!</span>'
      : `<br><span class="text-white/40">Tu récord: ${state.best} puntos</span>`);
  guardaResultadoFinal({
    titulo: '¡Enhorabuena!',
    etiqueta: 'puntos conseguidos',
    detalle, record: state.newRecord,
  });
}

// La pantalla de fin no repite la solución de la última pregunta: ésa ya se ha
// visto en el aviso, y ahí es donde toca. En el resumen sólo van los puntos.
function gameOver() {
  paraCronometro();
  const detalleFinal =
    (state.newRecord
      ? '<span class="text-[#30D158]">¡Nuevo récord!</span>'
      : `<span class="text-white/40">Tu récord: ${state.best} puntos</span>`);
  guardaResultadoFinal({
    titulo: 'Fin de la partida',
    etiqueta: `puntos · ${state.completadas.size} de ${BURBUJAS} burbujas`,
    detalle: detalleFinal,
    record: state.newRecord,
  });
}

function startGame(semilla) {
  paraCronometro();
  // Lo primero: sembrar. A partir de aquí, el campo y las veinte rondas salen
  // de este número, así que guardándolo se puede reproducir la partida entera.
  state.semilla = siembra(semilla);
  state.bitacora = [];
  state.score = 0;
  state.puntos = 0;
  state.vidas = VIDAS;
  state.round = 1;
  state.ronda = null;
  state.next = null;
  state.ultima = '';
  state.vistas = new Set();
  state.campo = reparteBurbujas();
  state.completadas = new Set();
  state.actual = null;
  state.reciente = null;
  // El fundido de salida de la portada se cancela aquí con su temporizador, y
  // es ese temporizador el que bajaba la bandera: sin esto, reiniciar mientras
  // la portada se iba la dejaba levantada y "Jugar" no volvía a responder.
  state.saliendoIntro = false;
  state.ronda = null;
  state.newRecord = false;
  els.score.textContent = '0';
  els.points.textContent = '0';
  pintaVidas(false);
  muestraTablero();
}

/* ---------- eventos ---------- */

els.burbujas.addEventListener('click', (e) => {
  const b = e.target.closest('.esfera');
  if (b && !b.disabled) eligeBurbuja(Number(b.dataset.burbuja));
});

els.cards.addEventListener('click', (e) => {
  const card = e.target.closest('.choice');
  if (card) responde(Number(card.dataset.index));
});

els.answers.addEventListener('click', (e) => {
  const b = e.target.closest('.yesno');
  if (b) responde(b.dataset.answer === '1');
});

// El tamaño de la burbuja depende del contenedor, así que hay que repintar
// cuando cambia la ventana. Protegido como el resto de accesos a `window`.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    if (!els.trivial.classList.contains('hidden')) pintaBurbujas();
    // la portada también mide su contenedor, y ahora ese contenedor es la
    // ventana entera
    if (!els.intro.classList.contains('hidden')) pintaIntro();
  });
}

const refreshGameToIntro = () => {
  paraCronometro();
  clearTimeout(state.timer);
  clearTimeout(state.burbujaTimer);
  clearTimeout(state.timerIntro);
  state.actual = null;
  state.reciente = null;
  state.score = 0;
  state.puntos = 0;
  state.vidas = VIDAS;
  state.round = 1;
  state.vistas = new Set();
  state.ronda = null;
  state.next = null;
  state.ultima = '';
  state.semilla = siembra();
  state.bitacora = [];
  state.campo = reparteBurbujas();
  state.completadas = new Set();
  state.newRecord = false;
  els.score.textContent = '0';
  els.points.textContent = '0';
  pintaVidas(false);
  hideToast();
  els.trivial.classList.add('hidden');
  els.trivial.classList.remove('flex');
  els.board.classList.add('hidden');
  els.board.classList.remove('flex');
  els.intro.classList.remove('hidden');
  els.intro.classList.remove('intro-fuera');
  els.introBest.textContent = state.best > 0 ? `Tu récord: ${state.best} puntos` : '';
  pintaIntro();
  els.play.focus({ preventScroll: true });
};

document.getElementById('refresh-game')?.addEventListener('click', refreshGameToIntro);

const introVisible = () => !els.intro.classList.contains('hidden');

function closeIntro() {
  // Dos vías llegan aquí —el botón y la tecla—, y sin la bandera se podía
  // encadenar el fundido dos veces.
  if (state.saliendoIntro) return;
  state.saliendoIntro = true;
  // El campo ya está pintado por detrás: basta con desvanecer la portada para
  // que el paso se vea como un cruce entre las dos, sin pantalla intermedia.
  els.intro.classList.add('intro-fuera');
  // La portada sigue capturando pulsaciones mientras se va: si no, se podría
  // elegir una burbuja a través de ella y abrir una pregunta con la portada
  // todavía a medio desaparecer.
  state.timerIntro = setTimeout(() => {
    els.intro.classList.add('hidden');
    els.intro.classList.remove('intro-fuera');
    state.saliendoIntro = false;
  }, SALIDA_INTRO_MS);
  // El reloj sólo corre durante una pregunta; aquí lo que aparece es el campo.
}

els.play.addEventListener('click', closeIntro);

document.addEventListener('keydown', (e) => {
  // `inert` no alcanza a los oyentes colgados de document: sin esto se podía
  // arrancar la partida con Enter por debajo del muro.
  if (!hayDecisionDeCookies()) return;
  if (introVisible()) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeIntro(); }
    return;
  }
  if (!els.trivial.classList.contains('hidden')) return;   // se elige con el ratón
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
pintaIntro();

// Prepara la primera ronda por detrás: al cerrar la intro el tablero ya está listo
startGame();
// Con `preventScroll` no se desplaza la portada al enfocar. Sin él, el
// navegador llevaba el botón a la vista y empujaba el título fuera de la
// pantalla en cuanto la vista no cabía entera.
els.play.focus({ preventScroll: true });
