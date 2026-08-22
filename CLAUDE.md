# Billions — juego de taquilla

Quiz web de cine con **tablero tipo trivial**: se tira un dado, se elige casilla
y su color decide el tipo de pregunta —taquilla, estrenos, directores, repartos
u Óscars—. Gana quien completa las 20 casillas antes de fallar tres veces. Se permiten dos fallos;
al tercero se acaba la partida. En producción:
**https://bonitu.es/billions/**

Vive dentro del repo de **Bonitu Plays** y se despliega con él, pero es un
**site independiente**: no comparte código, estilos ni datos con el juego de
niveles ni con el recetario. No lo enlaces desde el sitio padre salvo petición.

## Lo esencial en 30 segundos

- **Sin build ni dependencias.** Tailwind entra por el CDN Play (`cdn.tailwindcss.com`),
  que compila las clases en el navegador. Se abre con doble clic o
  `python3 -m http.server`.
- Cuatro archivos: [index.html](index.html) (estructura y CSS propio),
  [main.js](main.js) (juego), [movies.js](movies.js) (datos),
  [posters.js](posters.js) (índice de carátulas).
- **100 películas** con su recaudación mundial, extraídas de
  `top_100_peliculas_recaudacion_mundial.xlsx` (fuente: The Numbers, agosto 2026).
- Idioma de todo —UI, comentarios de código y mensajes de commit—: **español**.
  Los títulos de las películas van en inglés, como en la fuente.

## Mapa de archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Tablero, pantalla previa, aviso superpuesto, pantalla de fin. CSS propio en un `<style>` (animaciones); el resto son clases de Tailwind |
| `main.js` | Estado, rondas, revelado, récord. Sin módulos: variables globales y `defer` |
| `movies.js` | `const MOVIES` — generado por `tools/build-data.py`, **no editar a mano**. Campos: `r` puesto, `t` título, `g` recaudación, `y` año, `o` Óscars, `d` director(es), `a` reparto |
| `posters.js` | `const POSTERS` — puesto → nombre de archivo en `posters/` |
| `posters/*.jpg` | 100 carátulas, 300 px de ancho |
| `posters/_report.json` | Caché de resolución del descargador (qué página y qué archivo de Wikipedia usó cada película) |
| `directors/*.jpg` | 118 fotos de directores, 400 px de ancho |
| `actors/*.jpg` | 624 fotos de actores (de 641 personas), 300 px de ancho |
| `directors.js` / `actors.js` | `DIRECTORS`/`ACTORS` (puesto de película → nombres) y `DIRECTOR_PHOTOS`/`ACTOR_PHOTOS` (nombre → archivo). **Todavía no los carga `index.html`**: los datos están listos, el juego no los usa |
| `*/\_report.json` | Qué foto se asignó a cada persona, cuáles fueron por vía indirecta y cuáles quedaron en duda |
| `tools/build-data.py` | Regenera `movies.js` cruzando los dos Excel |
| `tools/fetch-posters.py` | Descarga las carátulas. Dos fuentes: Wikipedia (sin clave) o TMDB (con clave) |
| `tools/fetch-people.py` | Saca del Excel los directores o los actores y descarga sus fotos (`--role`) |
| `tools/build-artifact.py` | Empaqueta todo en un HTML autocontenido en `build/` |
| `top_100_...xlsx` | Datos de origen del juego (100 películas, sólo taquilla) |
| `top_peliculas_taquilla_y_critica.xlsx` | Datos ampliados: 189 películas con director, nota de FilmAffinity, Óscars y 5 actores. **`movies.js` no sale de aquí todavía** |

## Invariantes que no hay que romper

1. **Ninguna recaudación se repite en `MOVIES`.** De eso depende que ninguna
   ronda pueda quedar en empate: `choose()` decide con `a.g > b.g` sin caso de
   empate. Si regeneras los datos, vuelve a comprobarlo.
2. **`movies.js` y `posters.js` son generados.** Los datos se regeneran desde el
   Excel; el índice de carátulas, con el script. Editarlos a mano se pierde.
3. **`POSTERS` va por puesto (`r`), no por índice del array.** Si cambia el orden
   de `MOVIES`, las carátulas siguen cuadrando; si cambian los puestos, no.
4. **El juego funciona sin carátulas.** Si una imagen falta o falla, la tarjeta se
   queda con fondo liso y el título. No introduzcas dependencias de la imagen.

## El tablero

Un anillo de **20 casillas** que es el perímetro de una rejilla 6×6 (6+5+5+4).
Ese número no es casual: **20 es múltiplo de 5**, así que las cinco categorías
caen exactamente cuatro veces cada una y el ciclo cierra sin dejar dos iguales
seguidas. Si cambias `LADO`, comprueba que el perímetro siga siendo múltiplo de 5.

**El objetivo es completar las 20 casillas.** Acertar la pregunta de una casilla
la marca como resuelta y ya no se vuelve a ella. Se gana al completarlas todas y
se pierde al tercer fallo; fallar deja la casilla pendiente para más adelante.

Turno: se tira el dado (1–6) y se iluminan **las dos casillas alcanzables**, una
en cada sentido del anillo. El jugador pulsa la que quiere y la ficha salta
casilla a casilla hasta ella; la categoría de la casilla decide la pregunta.

- **Las casillas resueltas son transparentes al movimiento**: `avanza()` cuenta
  sólo las pendientes. Es lo que garantiza que siempre haya jugada — si contaran
  como casillas normales, una tirada podría dejarte apuntando a dos casillas ya
  resueltas y la partida se bloquearía. Verificado con 3.000 partidas completas:
  ni un bloqueo, ni una casilla resuelta ofrecida, y 20 turnos exactos cuando se
  acierta siempre.
- Con una sola casilla pendiente, cualquier tirada lleva a ella.

- **Las dos preguntas se preparan al tirar el dado**, una por destino, y se
  precargan sus imágenes (`state.pendientes`). Así al elegir no hay espera.
- **Son siempre dos destinos distintos** con un dado de seis caras: coincidirían
  sólo con una tirada de 10 en un anillo de 20.
- **Los clics del tablero van por delegación** en `#ring`, tanto los de casilla
  como el del botón de tirar. El tablero se repinta entero en cada paso de la
  ficha, así que un manejador puesto sobre el botón se perdería en el primer
  repintado.
- **El estado del botón sale de `state.destinos`**, no de una llamada suelta: con
  una elección pendiente se pinta ya deshabilitado.
- Fases: `#trivial` (tablero) y `#board` (pregunta) se alternan. El cronómetro
  sólo corre en la fase de pregunta.

### Aspecto del tablero

- **Cada casilla se rellena entera** con un degradado del color de su categoría
  (`COLORES`, dos tonos por categoría). Las que no están en juego bajan de
  intensidad —el color va con alfa— para que las dos elegibles destaquen sin
  necesidad de otro recurso visual.
- Los colores van en **estilos en línea, no en clases de Tailwind**, porque hacen
  falta con alfa variable y compuestos en degradados; con clases habría que
  declarar una variante por estado y categoría.
- **El dado pinta puntos de verdad**, no un número: `PUNTOS` mapea cada cara a
  las casillas de una rejilla 3×3 y `caraHTML()` la dibuja. Sin tirar, muestra
  una interrogación.
- **El valor del dado sale de `state.dado`**, nunca de una escritura suelta: el
  tablero se repinta en cada salto de la ficha y cualquier valor escrito a mano
  se perdería (fue un fallo real).
- La leyenda vive **fuera del anillo**, bajo el tablero, y resalta las categorías
  de las dos casillas elegibles. El centro sólo lleva dado, botón y mensaje.

## Los cinco tipos de ronda

| Tipo | Pregunta | Respuesta |
|---|---|---|
| `taquilla` | ¿Cuál recaudó más? | Elegir tarjeta |
| `anio` | ¿Cuál se estrenó antes? | Elegir tarjeta |
| `director` | ¿Dirigió *X* esta película? | Sí / No |
| `actores` | ¿Coincidieron estos dos actores en esta película? | Sí / No |
| `oscar` | ¿Ganó esta película algún Óscar? | Sí / No |

Cada tipo es una función `ronda*(level)` que devuelve un objeto con `pregunta`,
`modo` (`elige` o `sino`), `cartas`, `correcta` y `firma` (para no repetir ronda).
Añadir un tipo nuevo es escribir esa función y meterla en `TIPOS` con su peso.

**Reglas que no hay que romper:**

1. **Nada entra en juego sin fotografía.** Los fondos `PELIS`, `CON_DIRECTOR`,
   `CON_REPARTO` y `CON_OSCAR` se filtran al arrancar comprobando que existe la
   imagen. Es un requisito del diseño, no una optimización.
2. **En las rondas de estreno el año va oculto** (`sinAnio`), porque es
   justo lo que hay que adivinar. En las de taquilla sí se ve.
3. **Los sí/no se equilibran a propósito.** Sólo 27 de 98 películas tienen Óscar,
   así que `rondaOscar()` sortea primero la respuesta y luego busca película. Sin
   eso, responder "no" siempre acertaría tres de cada cuatro veces.
4. **El "no" de los repartos es una heurística, no un dato.** Sólo tenemos cinco
   actores por película, así que "no coincidieron" se afirma cogiendo un intruso
   de una película separada por `HUECO_SEGURO` años o más. Reduce mucho el riesgo
   de afirmar en falso, pero no lo elimina: si bajas ese hueco, aumenta.
5. **Las dos películas de 2026 sin datos ampliados** (*Michael*, *The Super Mario
   Galaxy Movie*) sólo aparecen en rondas de taquilla y estreno.

## Detalles del juego

- **Contrato de película:** `{ r: puesto, t: título, g: recaudación mundial, y: año }`.
- **Ritmo:** `REVEAL_MS` (2800 ms tras acertar) y `GAMEOVER_MS` (3200 ms tras
  fallar) al principio de `main.js`. Son el tiempo para leer las cifras; se
  tocan a menudo, están como constantes con nombre por eso.
- **Dificultad progresiva (sólo en los duelos):** en taquilla la marca lo
  parecidas que son las dos recaudaciones; en estrenos, los años de diferencia
  (`huecoAnios()`, de 18 años a 2). En las de sí/no lo que sube con el nivel es
  lo plausible que es el intruso. Sobre la taquilla:
  medido como ratio entre ellas (2.0 = la ganadora dobla a la otra; 1.05 = moneda
  al aire). `banda(level)` devuelve la horquilla admisible del nivel, que parte de
  `RATIO_INICIAL` (2.0) y cae hacia `RATIO_SUELO` (1.12) con `RATIO_CAIDA`. La
  horquilla tiene tope (`BANDA`) para que en niveles altos no cuele un duelo
  fácil de más. Mediana real: 2.2 en el nivel 1, 1.6 en el 8, 1.3 en el 20.
  **El suelo es deliberado:** sin él aparecerían rondas decididas al azar, que es
  lo que hacía injusto el juego cuando las parejas eran aleatorias (27,5 % de las
  rondas tenían ratio <1.1).
- **Parejas:** `randomPair(level)` sortea hasta encontrar una que entre en la
  horquilla, aflojándola cada 8 intentos, con un salvavidas final. Nunca repite la
  del turno anterior (`state.lastPairKey`). La pareja siguiente se sortea y se
  precarga durante la ronda actual (`state.next`), para que no parpadee al pasar
  de nivel; por eso existe `state.round`, que es `state.score + 1`.
- **Avisos:** un único elemento `#toast` superpuesto al tablero, con estilo por
  tipo en `TOAST_STYLES` (`ok` / `fail`). Se oculta solo con la animación CSS;
  no hay temporizador. Para añadir un tipo basta una entrada más en la tabla.
  Lleva tres líneas: el mensaje, el contador de puntos y la explicación.
- **El aviso dura `TOAST_MS` (3 s).** La duración se le pone al elemento desde
  JS, no en el CSS, porque tiene que ir acompasada con `REVEAL_MS` y
  `GAMEOVER_MS`: si el aviso durase más que la pausa, se cortaría al cambiar la
  ronda. Los porcentajes de `@keyframes toastPop` reparten esa duración.
- **El contador de puntos del aviso** (`cuentaPuntos()`) sube de 0 a lo ganado en
  700 ms, dentro de los 3 s que dura el aviso. Sólo se pinta cuando a
  `showToast()` se le pasa un número; en los fallos queda oculto.
- **Teclado:** `←`/`1` y `→`/`2` eligen; `Enter` o espacio arranca y reinicia.
- **Cuenta atrás y puntos:** `TIEMPO = 10000` ms por ronda y `PUNTOS_MAX = 100`.
  Los puntos bajan linealmente con lo que se tarda: instantáneo 100, a los 5 s
  50, agotado 0. Quedarse sin tiempo cuenta como fallo y descuenta vida.
- **La barra se pinta a mano en cada fotograma**, no con una transición CSS,
  porque el mismo reloj decide los puntos: así lo que se ve y lo que se cobra
  salen del mismo sitio. Cambia de ámbar a naranja y a rojo por debajo del 50 %
  y del 25 %.
- **El reloj no corre con la pantalla previa abierta**: `mountRound()` lo arranca
  sólo si la intro está cerrada, y `closeIntro()` lo arranca al descubrir el
  tablero. Sin eso, la primera ronda se agotaría mientras se lee la explicación.
- **`state.corriendo` es una bandera aparte y no un `if (state.t0)`**: `t0` puede
  valer 0 legítimamente y entonces el cronómetro se daría por parado, cobrando 0
  puntos en cada respuesta.
- **El récord pasó a medirse en puntos** y usa una clave nueva
  (`billions.best.points`), porque los valores guardados con el sistema anterior
  eran niveles y no son comparables.
- **Vidas:** `VIDAS = 3` en `main.js`. Fallar descuenta una y la ronda sigue; sólo
  el fallo que deja `state.vidas` a cero abre la pantalla de fin. Los tres puntos
  de la cabecera los pinta `pintaVidas()`, que recibe si se acaba de perder una
  para hacerla latir al apagarse.
- **Un fallo no sube de nivel pero tampoco lo baja:** `state.round` se deriva de
  `state.score`, así que tras fallar se repite la dificultad del mismo nivel.
- **Récord:** `localStorage`, clave `billions.best`, siempre entre `try/catch`
  (modo privado del navegador).
- **Las tarjetas las genera el JS** (`cartaHTML()` en `#cards`), porque una ronda
  tiene una, dos o tres según el tipo. El HTML ya no lleva tarjetas fijas.
- **Tamaño de las tarjetas:** en móvil ocupan el ancho y se estiran; de tablet
  hacia arriba van a tamaño fijo con proporción 2:3 (186×280 en `sm`, 350×525 en
  `lg`) y la rejilla se ajusta al contenido con `sm:w-fit sm:mx-auto`. Sin el
  `w-fit`, las columnas seguirían ocupando media pantalla cada una y las tarjetas
  se irían a los extremos.
- **El límite de tamaño lo pone la ronda de reparto**, que alinea una carátula y
  dos retratos. Los topes reales, con sus separaciones: 190 px por tarjeta en
  tablet y 358 px en escritorio. Los valores actuales dejan un margen pequeño a
  propósito; subirlos desborda el ancho.
- El alto en `lg` va con `min(px, vh)` para que en pantallas bajas la tarjeta no
  empuje el tablero fuera de la ventana. El recorte lo absorbe `object-cover`.
- **Cambio de nivel:** `newRound()` saca las tarjetas (`card-out`, `OUT_MS`) y
  `mountRound()` monta la ronda nueva cuando ya no se ven, con entrada
  escalonada (`entradaTarjetas()`, `STAGGER_MS`). `state.ronda` vacío significa
  "no hay ronda anterior que sacar" (primera ronda y reinicio).
- Los bordes de las tarjetas son de 4 px **siempre**, y solo cambia el color
  entre reposo, hover, acierto y fallo. Si cambias el grosor por estado, el
  contenido se desplaza.
- **El hover NO usa la variante `hover:` de Tailwind**, sino una regla propia
  dentro de `@media (hover: hover)` con `:not(:disabled)`. Motivo: la variante de
  Tailwind v3 no distingue ratón de dedo, así que en táctil el `:hover` se queda
  pegado a la última tarjeta tocada y en escritorio sobrevive sobre la tarjeta
  recién pulsada — se veía como si el borde de la selección anterior no se
  limpiara. No vuelvas a poner `hover:border-...` en el HTML.

## Carátulas

Vienen del campo `image` del infobox de los artículos de la Wikipedia en inglés.

```bash
python3 tools/fetch-posters.py                    # Wikipedia, sin clave
python3 tools/fetch-posters.py --source tmdb --key CLAVE --refresh
```

Sin `--refresh` reutiliza `posters/_report.json` y solo descarga lo que falte.

**Limitación conocida:** Wikipedia aloja los pósters bajo "uso legítimo" y por
política **exige baja resolución** — los originales miden entre 218 y 368 px de
ancho (mediana 258). No hay forma de sacar más de esa fuente. Para alta
resolución hay que usar TMDB (`w500`, `w780`, `original`), que da unos 2000 px y
necesita una clave gratuita de la API v3. El backend ya está escrito.

Siete carátulas son apaisadas (los "quad" británicos de Harry Potter, Skyfall y
Spectre): son las auténticas de Wikipedia, y la tarjeta las recorta. TMDB usa
siempre el formato vertical.

Las imágenes tienen copyright de sus estudios y están a título ilustrativo, con
la atribución en el pie de página.

## Directores y actores

Los nombres salen de la hoja "Listado completo" de
`top_peliculas_taquilla_y_critica.xlsx` (columna D los directores, H–L los cinco
actores); las fotos, de la Wikipedia en inglés. Un solo script para ambos:

```bash
python3 tools/fetch-people.py --role directors --width 400
python3 tools/fetch-people.py --role actors --width 300
python3 tools/fetch-people.py --role actors --names     # sólo nombres
```

Es reanudable: da por buenas las fotos que ya estén en disco y sólo trabaja
sobre los huecos, que siempre quedan algunos porque Wikipedia devuelve 429 si se
le pide demasiado seguido. Con `--refresh` lo rehace todo.
**Ojo con `--names`**: regenera el índice sin fotos, así que después hay que
volver a lanzarlo sin esa opción para restaurarlo.

- **El cruce con el juego se hace por recaudación, no por título.** El Excel nuevo
  abrevia los títulos ("Harry Potter: Deathly Hallows P2"), así que sólo 70 de 100
  coinciden literalmente; la recaudación es un número exacto y único y cruza 98.
  Si tocas ese cruce, no lo pases a comparar títulos.
- **Dos películas se quedan sin director:** *Michael* y *The Super Mario Galaxy
  Movie*, ambas de 2026, que no están en el Excel nuevo.
- **Los codirectores que comparten apellido** vienen en una sola casilla
  ("Anthony & Joe Russo"), y hay que copiar el apellido a la primera mitad o
  Wikipedia no encuentra a nadie. Lo hace `split_directors()`.
- **Tres fotos son de dúo y las comparten seis personas** (Russo, Daniels, y
  Boden & Fleck): Wikipedia sólo tiene artículo conjunto para ellos.
- **Irvin Kershner es la única foto no libre**, sacada de la imagen de su
  artículo porque `pageimages` omite ese tipo de archivos — el mismo motivo que
  limita las carátulas.
- **La identidad se valida siempre, no sólo cuando falta la foto.** Es la razón
  de ser de `INTERPRETE` y `CINE`: hay artículos de otra persona con el mismo
  nombre y con imagen, que se colarían sin decir nada. El caso de manual es
  `Chris Evans`, que en la Wikipedia inglesa es un presentador británico. Si el
  extracto no habla de cine, se reintenta con `(actor)`, `(director)` y búsqueda.
- Los actores están a 300 px y no a 400 como los directores: son 641 personas, y
  a 400 px pasaban de 38 MB.
- **17 actores no tienen foto y no la van a tener por esta vía**: 4 no tienen
  artículo en la Wikipedia inglesa (Liu Tongzi, Lü Yanting, Hualālai Chung,
  Takashi Naitô) y 13 lo tienen sin ninguna imagen — sobre todo voces de anime,
  el reparto de *Cidade de Deus* y actores infantiles. No es un fallo del
  script: está comprobado artículo por artículo.
- Reparto del juego: 93 de las 98 películas cruzadas tienen los cinco actores
  con foto; 4 tienen cuatro y 1 tiene tres o menos.
- Al contrario que los pósters, las fotos de personas sí suelen ser libres
  (Commons), así que aquí no hay techo de resolución: se piden y normalizan al
  ancho que diga `--width`.

## Publicar

**"Publicar" aquí significa desplegar a bonitu.es, no crear un Artifact.**

- Raíz del repo: `/Users/miguelgarciarodriguez/Dropbox/Claude/Bonitu` (rama `main`).
- Push a `main` → GitHub Actions → `aws s3 sync --delete` al bucket `bonituplay`
  + invalidación de CloudFront `E3LRZQIIEJH24`. **Cada push a main publica.**
- El sync excluye `.git/`, `.github/` y `*.md` (también los anidados), así que
  este archivo no se sirve.
- `billions/build/` está en `.gitignore`: es el paquete de un solo archivo que
  genera `build-artifact.py`, no tiene sentido en el servidor.
- Commits en español con prefijo `Billions:`.
- Todo lo que quede en `billions/` se sirve públicamente. Antes de subir nada,
  revisa que no lleve datos personales: el correo de contacto en los scripts es
  el público del proyecto (`bonitu@garciarodriguez.net`), no el personal.

## Pendiente

- Carátulas en alta resolución vía TMDB (bloqueado: hace falta la clave).
- No hay forma de saltarse la pausa del revelado; si se hace lenta, un clic o
  tecla que adelante la ronda lo resuelve.
