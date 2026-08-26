// Billions — el motor de la partida
//
// Todo lo que decide QUÉ se pregunta y cuánto vale: el azar sembrado, los
// depósitos de datos, los generadores de ronda y la fórmula de los puntos.
//
// Vive aparte de main.js por un motivo concreto: **aquí no se toca el DOM**, así
// que este mismo archivo puede correr fuera del navegador para rehacer una
// partida a partir de su semilla y comprobar si la puntuación es la que dice
// ser. Si la validación tuviera su propia copia de estas reglas, las dos se
// desincronizarían a la primera y la clasificación empezaría a rechazar
// partidas buenas.
//
// **No metas aquí nada que pinte, mida la ventana o lea `localStorage`.** El
// límite es ése, y es lo único que hace que el archivo sirva para las dos cosas.

const VIDAS = 3;           // se permiten dos fallos; el tercero acaba la partida
const TIEMPO = 10000;      // milisegundos para responder
const PUNTOS_MAX = 100;    // se cobran enteros al instante y bajan hasta 0

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

const BURBUJAS = 20;
// Dos burbujas de las veinte puntúan el doble. Salen del azar sembrado como el
// reparto de categorías —son parte de la partida, no adorno—, y por eso las
// decide `reparteCategorias()` y no main.js: el servidor rehace la partida con
// este mismo archivo y tiene que llegar a los mismos puntos.
const DORADAS = 2;
const MULTI_DORADA = 2;
const CATEGORIAS = ['taquilla', 'anio', 'director', 'actores', 'oscar', 'oscarcat',
                    'critica', 'filmografia', 'bso'];

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

/* ---------- sagas ----------
   Los jugadores avisaron de que salían superhéroes a todas horas, y era verdad:
   3,1 de las 20 rondas de una partida. No es que el sorteo los prefiera —su
   cuota de apariciones, 14,4 %, va con su peso en el catálogo, 12,6 %—, es que
   Marvel y DC son 22 películas de 191 y las bandas de dificultad aprietan los
   duelos contra el grupo más denso del catálogo, que es el bloque moderno.
   Así que el tope no es de superhéroes, es de saga: TOPE_SAGA rondas por
   partida y el resto se rechaza. Marvel entra entero como una sola saga, porque
   como tal se percibe.

   Se etiqueta por el título y no por identificador para que una película nueva
   de una saga ya conocida entre sola al regenerar los datos. */
const SAGAS = [
  // Marvel y DC van en el mismo saco a propósito. Por separado, con dos rondas
  // cada uno, una partida podía sacar cuatro de superhéroes y la queja seguiría
  // en pie: quien juega no ve dos universos, ve más de lo mismo.
  [/^(Avengers|Iron Man|Captain America|Captain Marvel|Black Panther|Doctor Strange|Guardians of the Galaxy|Deadpool|Spider-Man|Venom|Thor|Ant-Man|The Dark Knight|Batman|Superman|Aquaman|Joker|Wonder Woman|X-Men|Logan|The Wolverine)/, 'Superhéroes'],
  [/^(Star Wars|Rogue One|The Empire Strikes Back|Return of the Jedi)/, 'Star Wars'],
  [/^Harry Potter|^Fantastic Beasts/, 'Harry Potter'],
  [/^(LOTR|The Hobbit|Hobbit)/, 'Tolkien'],
  [/^Jurassic/, 'Jurassic'],
  [/^Avatar/, 'Avatar'],
  [/^Toy Story/, 'Toy Story'],
  [/^(Despicable Me|Minions)/, 'Gru'],
  [/^Pirates of the Caribbean|^Pirates Caribbean/, 'Piratas'],
  [/^Ice Age/, 'Ice Age'],
  [/^Transformers/, 'Transformers'],
  [/^Frozen/, 'Frozen'],
  [/^(The Godfather|El Padrino)/, 'Padrino'],
  [/^(Furious|The Fate of the Furious|Fast)/, 'Fast'],
  [/^The Lion King/, 'Rey León'],
  [/^Zootopia/, 'Zootrópolis'],
  [/^Finding (Nemo|Dory)/, 'Nemo'],
  [/^(The )?Incredibles/, 'Increíbles'],
  [/^Inside Out/, 'Del revés'],
  [/^Moana/, 'Vaiana'],
  [/^(The Super Mario|Super Mario)/, 'Mario'],
  [/^(The Hunger Games|Hunger Games)/, 'Hunger Games'],
  [/^Dune/, 'Dune'],
];
const TOPE_SAGA = 2;
// Se resuelve una vez y se guarda: la comprobación entra en el bucle de sorteo.
const SAGA_DE = new Map(
  MOVIES.map((m) => [m.r, (SAGAS.find(([re]) => re.test(m.t)) || [])[1]]).filter(([, s]) => s),
);
const sagasDe = (r) => new Set((r.pelis || []).map((m) => SAGA_DE.get(m.r)).filter(Boolean));
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
  const libres = pool.filter((m) => !juego.vistas.has(m.r));
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

// Siete películas llevan el año en el título para distinguirse de su remake
// —«The Lion King (1994)», «Aladdin (2019)»—. Donde el año es justo lo que hay
// que adivinar, eso es la respuesta escrita en la carta, así que ahí se quita.
const tituloSinAnio = (t) => t.replace(/\s*\(\d{4}\)\s*$/, '');

const cartaPeli = (m, opts = {}) => ({
  img: posterOf(m),
  titulo: opts.sinAnio ? tituloSinAnio(m.t) : m.t,
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
      // Y sin el año no pueden quedar dos cartas con el mismo título. Hoy no
      // puede pasar —los dos «Rey León» se llevan 25 años y la banda no llega
      // a tanto—, pero es un duelo sin respuesta posible y sale barato cerrarlo.
      if (tituloSinAnio(a.t) === tituloSinAnio(b.t)) return false;
      return d >= minimo && d <= maximo;
    });
    if (rivales.length) {
      const b = pick(rivales);
      const [x, y] = coin() ? [a, b] : [b, a];
      return {
        tipo: 'anio',
        pregunta: `¿Qué se estrenó antes, ${nom(tituloSinAnio(x.t))} o ${nom(tituloSinAnio(y.t))}?`,
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
  // Si la firman dos, se pregunta por uno de ellos y el otro no puede salir de
  // intruso: sería una segunda respuesta correcta.
  const bueno = pick(m.d);
  const fotoBuena = directorPhoto(bueno);
  // La dificultad no está en el número de opciones, está en quiénes son: con
  // cuatro caras de épocas distintas se acierta por descarte. Así que lo que
  // sube con el nivel es cuántos de los tres intrusos son contemporáneos de la
  // película —a menos de seis años—, de uno en el nivel 1 a los tres en el 10.
  const contemporaneos = level >= 10 ? 3 : level >= 4 ? 2 : 1;
  const plausible = (n) => CON_DIRECTOR.some((o) => o.d.includes(n) && Math.abs(o.y - m.y) <= 6);
  const elegibles = (filtra) => DIRECTORES.filter((n) => {
    if (m.d.includes(n)) return false;
    // Tres directores comparten foto con su codirector —los Russo, los Daniels,
    // Boden & Fleck—: dos caras iguales en la mesa serían una ronda absurda.
    if (directorPhoto(n) === fotoBuena) return false;
    return filtra(n);
  });
  const cerca = elegibles(plausible);
  const lejos = elegibles(() => true);
  if (lejos.length < 3) return null;

  const intrusos = [];
  const fotos = new Set([fotoBuena]);
  const mete = (pool) => {
    for (let i = 0; i < 30; i++) {
      const n = pick(pool);
      if (!n || intrusos.includes(n) || fotos.has(directorPhoto(n))) continue;
      intrusos.push(n);
      fotos.add(directorPhoto(n));
      return true;
    }
    return false;
  };
  for (let i = 0; i < contemporaneos && cerca.length; i++) mete(cerca);
  while (intrusos.length < 3) { if (!mete(lejos)) return null; }

  const nombres = [bueno, ...intrusos];
  barajaEnSitio(nombres);
  const real = m.d.length > 1 ? `La dirigieron ${m.d.join(' y ')}` : `La dirigió ${m.d[0]}`;
  return {
    tipo: 'director',
    pregunta: `¿Quién dirigió ${nom(m.t)}?`,
    modo: 'elige',
    // Sin rótulo de oficio en la carta: con cuatro caras y la pregunta delante,
    // poner «Director» cuatro veces es ruido.
    cartas: nombres.map((n) => cartaPersona(n, directorPhoto(n), null)),
    correcta: nombres.indexOf(bueno),
    pelis: [m],
    explica: `${real}.`,
    firma: `dir-${m.r}-${bueno}`,
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

// Una ronda que enfrenta a dos de la misma saga cuenta una vez, no dos: lo que
// cansa es ver la saga, no cuántas cartas suyas haya en la mesa.
function cabeLaSaga(r) {
  return [...sagasDe(r)].every((s) => (juego.sagas.get(s) || 0) < TOPE_SAGA);
}

// `categoria` la impone la burbuja elegida; sin ella se sortea por peso
function nuevaRonda(level, categoria) {
  const disponibles = TIPOS.filter((t) => t.hay());
  const forzado = categoria && TIPOS.find((t) => t.id === categoria && t.hay());
  for (let intento = 0; intento < 30; intento++) {
    const tipo = forzado || porPeso(disponibles);
    const r = tipo.crea(level);
    if (r && r.firma !== juego.ultima && cabeLaSaga(r)) {
      juego.ultima = r.firma;
      (r.pelis || []).forEach((m) => juego.vistas.add(m.r));
      sagasDe(r).forEach((s) => juego.sagas.set(s, (juego.sagas.get(s) || 0) + 1));
      return r;
    }
  }
  // El salvavidas no mira sagas: antes una ronda repetida de saga que ninguna.
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


/* ---------- lo que el motor recuerda de la partida en curso ---------- */

// `vistas` evita repetir película y `ultima` evita repetir ronda. Viven aquí y
// no en el `state` de main.js porque son del motor: fuera del navegador también
// hacen falta para reproducir la partida igual que se jugó.
const juego = {
  vistas: new Set(),   // películas ya preguntadas en esta partida
  ultima: '',          // firma de la ronda anterior
  sagas: new Map(),    // cuántas rondas lleva ya cada saga
  doradas: new Set(),  // qué burbujas puntúan el doble
};

// Empieza una partida: siembra y olvida lo de la anterior. Devuelve la semilla.
function reiniciaMotor(semilla) {
  juego.vistas = new Set();
  juego.ultima = '';
  juego.sagas = new Map();
  juego.doradas = new Set();
  return siembra(semilla);
}


/* ---------- los puntos ---------- */

// El multiplicador se aplica sobre los puntos ya redondeados, para que una
// burbuja dorada valga exactamente el doble de lo que se ve en las demás.
const puntosPor = (ms, multiplicador = 1) =>
  Math.max(0, Math.round(PUNTOS_MAX * (1 - Math.min(ms, TIEMPO) / TIEMPO))) * multiplicador;
const esDorada = (b) => juego.doradas.has(b);
const multiplicadorDe = (b) => (esDorada(b) ? MULTI_DORADA : 1);


/* ---------- el reparto de categorías del campo ---------- */

// Qué categoría lleva cada una de las veinte burbujas. Sale del azar sembrado
// —es parte de la partida—, al revés que la posición o la foto de cada burbuja,
// que son adorno y se deciden en main.js.
//
// Veinte entre nueve categorías no reparten exacto: cada una sale dos veces y
// dos salen una tercera. Las agraciadas se sortean en cada partida, así que no
// son siempre las mismas las que aparecen más. Se reparte a mano en vez de
// quitar sobrantes al azar: quitando al azar podían caer los tres descartes
// sobre la misma categoría y dejarla sin ninguna burbuja en el campo.
//
// Sólo entran las categorías que de verdad pueden plantear pregunta (`hay()`):
// si un archivo de datos no llegara a cargar, su categoría se queda fuera en vez
// de dar una burbuja que al pulsarla suelta la pregunta de otra.
function reparteCategorias() {
  const jugables = CATEGORIAS.filter((c) => {
    const t = TIPOS.find((x) => x.id === c);
    return t && t.hay();
  });
  const usables = jugables.length ? jugables : CATEGORIAS;
  const base = Math.floor(BURBUJAS / usables.length);
  const extra = BURBUJAS % usables.length;
  const cats = [];
  usables.forEach((c) => { for (let i = 0; i < base; i++) cats.push(c); });
  const sobran = [...usables];
  barajaEnSitio(sobran);
  cats.push(...sobran.slice(0, extra));
  barajaEnSitio(cats);
  // Las doradas se sortean aquí y no en una función aparte a propósito: quien
  // rehace la partida —el servidor— llama a `reparteCategorias()` y a
  // `nuevaRonda()`, y nada más. Si esto consumiera azar en otro sitio, la
  // secuencia sembrada dejaría de cuadrar entre el navegador y el servidor.
  juego.doradas = new Set();
  const indices = cats.map((_, i) => i);
  barajaEnSitio(indices);
  indices.slice(0, DORADAS).forEach((i) => juego.doradas.add(i));
  return cats;
}

function barajaEnSitio(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
}
