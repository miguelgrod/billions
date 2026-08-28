# Perfect Nine — el quiz de la MLB

Quiz web de béisbol al estilo de Billions: **veinte burbujas repartidas por la
pantalla**, cada una de una categoría —World Series, Hall of Fame, anillos,
premios, equipos, números, épocas y sí/no—. El jugador pulsa la que quiere y
esa plantea su pregunta. **Cada pulsación gasta una burbuja, se acierte o se
falle**, y gana quien vacía el campo antes de fallar tres veces. La interfaz
está **en inglés**; el código, los comentarios y los commits, **en español**,
como el resto del repo.

**Proyecto independiente dentro del repo de Billions.** No comparte código,
datos ni estilos con el juego de cine: tiene su propia copia de Tailwind en
`mlb/vendor/`, la suya de Inter en `mlb/fonts/`, su motor y su página de
privacidad. Lo único que comparte es el despliegue: el workflow de Billions
sube el repo entero al bucket `billions-cine`.

> **La dirección es `https://ganoyo.com/mlb/index.html`, con el archivo.**
> CloudFront sirve el bucket con OAC y **no busca `index.html` dentro de una
> carpeta**: `/mlb/` devuelve 403, igual que `/posters/` o `/imgs/`
> (comprobado). Para que la carpeta a secas funcione hace falta una CloudFront
> Function de *viewer request*; está en [INFRAESTRUCTURA.md](../INFRAESTRUCTURA.md).

## Lo esencial en 30 segundos

- **Sin build ni dependencias.** Tailwind es el CDN Play servido desde
  `vendor/tailwind.js` y la tipografía desde `fonts/`. **El sitio no hace
  ninguna petición externa**, y no es una optimización: pedir esos archivos
  fuera —o los retratos a la MLB— entregaría la IP de cada visitante a
  terceros. Alojándolo todo, `privacy.html` dice la verdad en cinco líneas y no
  hace falta banner de cookies. **Si añades una biblioteca, tráetela.**
- **Los datos son de la MLB Stats API** (`statsapi.mlb.com`), pública y sin
  clave. Se bajan a `cache/` una vez y de ahí sale `data/mlb-data.js`.
- **`cache/` no está en git** (son ~220 MB) y `tools/` no se despliega: las dos
  exclusiones están en `.github/workflows/deploy.yml`.
- **Antes de desplegar un cambio de datos, pasa `tools/sella-versiones.py`.**
  El despliegue sirve todo lo que no es HTML con un año de caché y marcado
  `immutable`: sin la huella en la URL, quien ya haya entrado se quedaría con
  los datos viejos durante semanas.

## Mapa de archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura y CSS propio (las animaciones); el resto son clases de Tailwind |
| `motor.js` | **Qué se pregunta y cuánto vale**: azar sembrado, depósitos, los ocho generadores de ronda, el reparto del campo y los puntos. **No toca el DOM** |
| `main.js` | La pantalla: reparte y pinta las burbujas, abre las preguntas, el reloj, las vidas y el récord |
| `data/mlb-data.js` | Generado por `tools/build-data.py`, **no editar a mano** |
| `photos/*.jpg` | 910 retratos de jugadores, 240 px de ancho |
| `imgs/stadium.jpg` | El fondo de todas las pantallas: 480 px, 56 KB |
| `src/stadium.jpg` | El original de esa foto (1920 px, 4,4 MB). **No se despliega** |
| `photos/_report.json` | Quién no tiene retrato, para no volver a pedirlo cada vez |
| `end.html` | Pantalla de fin de partida, página aparte. Lee el resultado de `localStorage` (`pn.lastResult`) y ofrece guardar la marca, apoyar el juego y compartir |
| `leaderboard.html` | Las mejores partidas. Autónoma: lee el servidor con `fetch` y no carga el motor ni los datos |
| `leaderboard-config.js` | Dónde vive la clasificación. **Hoy está vacío a propósito**: no hay servidor todavía |
| `supabase/` | Esquema, función de validación y sus instrucciones. **No se despliega** |
| `privacy.html` | Página de privacidad propia. La de Billions no vale: es otro sitio |
| `tools/fetch-mlb.py` | Descarga la API a `cache/`. Reanudable |
| `tools/fetch-photos.py` | Descarga los retratos. Reanudable |
| `tools/build-data.py` | Convierte la caché en `data/mlb-data.js` |
| `tools/sella-versiones.py` | Pone la huella del contenido en los `<script src>` de todas las páginas |
| `tools/prueba.js` | Carga datos y motor fuera del navegador (`node`) |

## Cómo se regeneran los datos

```bash
python3 tools/fetch-mlb.py        # ~20 min la primera vez, después sólo lo nuevo
python3 tools/build-data.py       # 2 s
python3 tools/fetch-photos.py     # los retratos que falten
python3 tools/build-data.py       # otra vez: ahora sabe quién tiene retrato
python3 tools/sella-versiones.py
```

**`build-data.py` va dos veces a propósito.** La primera produce la lista de
jugadores, que es lo que `fetch-photos.py` necesita saber para descargar; la
segunda marca cuáles tienen ya el retrato en disco. Es el mismo orden que en
Billions con las carátulas.

`fetch-mlb.py` baja seis cosas y las guarda tal cual: equipos por temporada,
plantillas completas, premios, estadísticas de cada temporada, la postemporada
y las fichas personales. **Separar la descarga de la interpretación es lo que
permite cambiar las reglas del juego sin volver a bajarse ciento cincuenta
temporadas** — y es exactamente lo que pasó: el juego empezó siendo una rejilla
3×3 y se rehizo entero como quiz sin tocar una sola petición.

- **`--que personas` va el último**: necesita los identificadores que salen de
  las plantillas. Las fichas se piden de cien en cien (`personIds`).
- **Seis hilos, no más**: por encima, la API empieza a devolver 429.

## Los datos

- **Sólo entran los jugadores conocidos** (`FAMA_MINIMA`): 1.343 de los 22.001
  que aparecen en las plantillas. Un quiz no puede preguntar por alguien de
  quien nadie ha oído hablar, **ni ofrecerlo como respuesta falsa**: la
  pregunta se resolvería por descarte.
- **La notoriedad se calcula con el protagonismo real** —apariciones al plato,
  más entradas lanzadas por dos, más los premios—. «Temporadas jugadas» no
  vale: Danny Darwin duró veintiún años sin ser conocido y Jackie Robinson diez
  siéndolo. **Una entrada lanzada vale dos apariciones al plato**: con cuatro
  —lo primero que probé— los lanzadores salían más famosos que Willie Mays.
- **El identificador de equipo es de la franquicia, no de la ciudad.** 119 son
  los Dodgers, estén en Brooklyn o en Los Ángeles.
- **En el grupo `pitching`, `homeRuns` son los jonrones PERMITIDOS.** Por eso
  los logros de bateo y los de pitcheo leen campos distintos: mezclarlos daría
  a Nolan Ryan 300 jonrones y 3.000 hits. Comprobado contra los registros
  reales: salen 33 jugadores con 3.000 hits, 28 con 500 jonrones, 24 con 300
  victorias y 20 con 3.000 ponches, que son las cifras históricas exactas.
- **El campeón de las World Series no viene dicho**: se cuenta quién ganó más
  partidos de la serie. Salen 121 campeones; **1904 y 1994 no están porque no
  se jugaron**, y eso es correcto.
- **Los anillos se cuentan por plantilla de temporada completa**, así que a
  quien llegó traspasado en agosto se le cuenta igual. Es como lo cuenta
  cualquier aficionado, aunque el anillo de verdad tenga sus reglas.
- **Un traspaso parte la temporada en dos filas** de estadísticas, así que las
  de un mismo año se suman antes de juzgar un logro de temporada.
- **El nombre es el oficial de la API**, con sus sufijos: «Nolan Ryan Jr.»,
  «Ken Griffey Jr.». Es lo que distingue al padre del hijo.
- **El orden de `LOGROS` en `build-data.py` decide el bit** de cada logro.
  Añadir uno va **al final**; reordenar la lista invalida en silencio todos los
  datos generados.

## Los ocho tipos de pregunta

| Categoría | Pregunta | Opciones |
|---|---|---|
| `series` | Which team won the 2004 World Series? | 3 equipos |
| `hof` | Which of these players is in the Hall of Fame? | 3 jugadores |
| `rings` | How many World Series did Derek Jeter win? | 3–4 números |
| `awards` | Who won the 2012 AL MVP? | 3 jugadores |
| `teams` | Which of these teams did X play for? | 3 equipos |
| `numbers` | Who had more career home runs? | 2 jugadores |
| `eras` | Who played in the majors first? | 2 jugadores |
| `yesno` | Did X ever win a Cy Young award? | Yes / No |

Cada tipo es una función `ronda*(level)` que devuelve `{ pregunta, opciones,
correcta, pista, firma }` o `null` si esta vez no ha encontrado una pregunta que
cumpla las condiciones. Añadir un tipo es escribir esa función y meterla en
`TIPOS`.

**Reglas que no hay que romper:**

1. **Dos de cada tres preguntas van de los últimos treinta años**
   (`PESO_MODERNO`). Más de la mitad de las carreras del catálogo acabaron
   antes de 1970 y sortear plano llenaba el juego de Rube Marquard y Edd Roush.
   Los clásicos siguen saliendo: el tercio restante es de cualquier época.
2. **Lo que sube con el nivel no es el número de opciones: es lo parecidas que
   son.** En los duelos de números, la horquilla pasa del triple al 35 % de
   diferencia; en las de época, de 25 años a 3; en el Salón de la Fama, lo
   conocidos que son los señuelos; en las World Series, lo cerca que están los
   años de los otros campeones.
3. **Las cartas de jugador sólo usan a quien tiene retrato** (`RETRATADOS`).
   Una carta con foto al lado de otra sin ella se lee como un fallo, no como
   una opción. Quien no tiene retrato sigue jugando: se le puede nombrar en el
   enunciado —«¿cuántos anillos ganó X?»— porque ahí no hay tarjeta.
4. **Los señuelos de una pregunta de premio tienen que estar en activo ese
   año.** Si no, la respuesta se cae sola.
5. **El sí/no sortea primero la respuesta y después busca a quién nombrar.**
   Hay muchos más jugadores sin Cy Young que con él: al revés, responder
   siempre que no acertaría de sobra.
6. **Un duelo empatado no tiene respuesta**, así que se descarta explícitamente
   —tanto en números como en años de debut—.
7. **Sólo se pregunta por finales cuyo campeón siga existiendo con ese nombre.**
   No se puede ofrecer «Brooklyn Robins» entre tres opciones de hoy.

Medido con 60.000 rondas repartidas en 3.000 partidas completas: **0 preguntas
imposibles, 0 de otra categoría que la de su burbuja y 0 repetidas dentro de la
misma partida.** Es el riesgo de apretar las bandas de dificultad; si las
estrechas más, vuelve a medirlo.

## El campo de burbujas

- **Veinte burbujas y ocho categorías no reparten exacto.** El reparto se hace
  **dando vueltas a la lista barajada**, no repitiendo cada categoría un número
  fijo de veces: con seis categorías vivas —pasa una vez de cada quinientas,
  cuando dos generadores fallan la prueba de arranque— «dos cada una más una
  vuelta» dejaba el campo en dieciocho burbujas.
- **Sólo entran las categorías que de verdad pueden preguntar**, y se prueban
  cuatro veces antes de descartarlas: un generador puede fallar un intento por
  azar y dejarlo fuera por eso perdería una categoría que funciona.
- **Las posiciones son una rejilla con desorden**: 4×5 por debajo de 640 px y
  5×4 por encima. El desorden va **en fracción de celda** (0,36), no en píxeles:
  con 0,55 las burbujas se solapaban de dos en dos.
- **El diámetro se mide del contenedor** —celda = mín(ancho/columnas,
  alto/filas)—: sacarlo del ancho de la ventana ignora el alto y en un móvil
  corto se solapaban verticalmente. Por eso el campo se repinta al cambiar el
  tamaño de la ventana.
- **La posición se corrige al pintar para que ninguna burbuja asome fuera**: el
  centro se limita a radio + deriva + 2 de cada borde. Comprobado en un móvil
  de 390 px: 0 de 20 burbujas se salen y no hay desplazamiento horizontal.
- **Las animaciones son las de Billions, replicadas de su CSS.** Merece la pena
  saber en qué se diferencian de una versión ingenua, porque lo primero que
  escribí aquí las tenía todas mal:
  - **La deriva va en la propiedad `translate`, no en `transform`.** El
    centrado de la burbuja vive en `transform` y la escala del resalte en la
    esfera interior: si compartieran propiedad, cada uno anularía a los demás.
  - **Cada burbuja lleva un `animation-delay` negativo distinto** (0 a −30 s en
    un eje, 0 a −35 s en el otro). **Es lo que más se nota**: sin él las veinte
    empiezan a la vez y el campo entero respira al unísono, que es lo que
    delataba que era una animación en vez de un flotar.
  - **Dos ejes con periodos largos y distintos** (26–44 s y 31–52 s) y curva
    `cubic-bezier(.45,0,.55,1)`, casi sinusoidal: así el movimiento sólo se
    detiene en los extremos de cada eje, como un péndulo. Un solo fotograma con
    varios puntos y `ease-in-out` frenaba en cada punto intermedio.
  - **En móvil la deriva va un 22 % más rápida** (media query sobre
    `animation-duration`): el campo es más pequeño y el mismo recorrido se
    percibe más lento. Comprobado: 38,2 s pasan a 29,8 s por debajo de 640 px.
  - **Profundidad de campo**: las pequeñas llevan un desenfoque de hasta 1,6 px
    —`(1.06 − escala) × 5`— y la elegida siempre entra a foco.
  - **La elegida late**: un halo de su color que se expande y se apaga, dos
    veces (`latido`), mientras se lee su etiqueta, que entra con `rotuloIn`.
  - **`revienta` tiene tres pasos**, no dos: crece a 1,22 sin desenfoque, y de
    ahí a 1,55 difuminándose a 7 px. Con dos pasos parecía que se encogía.
  - **`will-change` y `backface-visibility`** en las capas animadas: es lo que
    evita los tirones al mover veinte burbujas a la vez en un móvil.
  - Las cartas usan **el foco de tvOS** (crecen un 5,5 % con la curva del
    sistema) y entran escalonadas 60 ms (`card-in`); el marcador da un salto al
    sumar y la vida perdida late al apagarse.
- **Cada burbuja lleva de fondo el retrato de un jugador** al ~62 %, con la foto
  debajo y el color encima: así la esfera conserva la identidad de color de su
  categoría. Poner la foto encima con `opacity` apagaría también el degradado.
  Son decorativas y por eso se sortean con `Math.random` y no con el azar
  sembrado. **Sólo se usan jugadores con retrato**, y seis de cada diez son
  modernos: si no, el campo entero salía en blanco y negro.
- **La burbuja jugada desaparece del campo, se acierte o se falle.** Si la
  fallada se quedara, la partida podría tener más jugadas que burbujas y el
  jugador se reencontraría la misma burbuja con otra pregunta detrás.
- **La que acaba de caer se pinta una última vez para verla reventar**
  (`REVIENTA_MS`). El repintado va por temporizador y no por `animationend`: un
  cambio de tamaño rehace el marcado y el evento se perdería con el nodo,
  dejando la burbuja congelada en el campo para siempre.
- **La partida terminada no admite más jugadas** (`state.terminada`). Que el
  aviso de fin tape el campo no basta: sería la capa de la pantalla la que lo
  impide, y con una llamada directa las vidas bajaban a −6. Aquí manda el
  estado.

## Aspecto

- **El fondo es una foto de estadio de noche, difuminada y apagada**
  (`imgs/stadium.jpg`), con una costura de pelota (`.seam`) como marca gráfica.
  Va en un `div` fijo y no con `background-attachment: fixed`, que en iOS da
  problemas.
  - **El desenfoque va en dos partes**: la foto se sirve a 480 px y el navegador
    la estira a pantalla completa —eso ya suaviza— más un `blur(6px)` corto.
    Pre-difuminarla en el archivo habría necesitado una herramienta de imagen
    que aquí no hay (ni Pillow, ni ImageMagick, ni cwebp), y de paso pesa 56 KB
    en lugar de los 4,4 MB del original.
  - **El `scale(1.08)` no es decorativo**: sin él, el desenfoque arrastra el
    borde de la imagen hacia dentro y se ve una franja clara en los cuatro lados.
  - **Los valores están medidos, no ajustados a ojo.** Sobre las capturas se
    calcula la luminancia del fondo detrás de cada texto: cabecera 15:1, campo
    15,4:1, pie 8:1 y la pista de la pregunta 10,5:1, todos muy por encima del
    4,5:1 que pide WCAG AA. El primer intento se pasó de oscuro —11 a 18:1, pero
    el estadio no se veía— y hubo que subirlo.
  - **La pregunta lleva su propia viñeta.** El enunciado y la pista caen sobre
    la parte más clara de la foto, el césped iluminado, y ahí el texto pequeño
    se quedaba en 6,6:1. Oscurecer el fondo entero para arreglar un bloque
    habría apagado el estadio en toda la pantalla.
  - **Los textos secundarios subieron de opacidad** (del 25–40 % al 45–60 %):
    sobre negro liso el 40 % se leía; sobre una foto con textura, aunque esté
    muy apagada, no llega.
  - **`imgs/stadium.jpg` se sirve con un año de caché y no lleva huella** —no es
    un `<script src>`, así que `sella-versiones.py` no la toca—. **Si cambias la
    foto, cámbiale el nombre**, o quien ya haya entrado seguirá viendo la vieja.
  - Para rehacerla desde otro original:
    `sips -Z 480 -s format jpeg -s formatOptions 68 src/stadium.jpg --out imgs/stadium.jpg`
- **Verde de campo de noche** por debajo de la foto, por si tarda en cargar.
- **El color de cada categoría es la rueda entera repartida por igual**,
  empezando por el verde del campo. **Si se añade una categoría hay que volver
  a repartir la rampa entera, no encajarla en un hueco.** Recortar la rueda a
  dos tercios —lo primero que hice— dejaba el campo en morados y rosas.
- **No se usa ningún logotipo de club.** Los equipos se pintan con su
  abreviatura sobre su color, y los colores son datos públicos. El pie lo dice:
  *not affiliated with MLB*.
- **La portada usa las mismas pompas del campo**, no una versión simplificada:
  lo primero que se ve es la pieza de verdad. Lleva **un velo entre las pompas y
  el texto**; sin él, una burbuja grande cae sobre el título y no hay manera de
  leerlo.

## La partida acaba en otra página

Como en Billions: `acaba()` arma el resultado, lo deja en `localStorage` bajo
`pn.lastResult` y hace `location.href = 'end.html'`.

- **El traspaso va por `localStorage` y no por la URL**: el detalle es HTML con
  marcado, y meterlo en la barra de direcciones sería feo y frágil.
- **`end.html` se apaña con lo que reciba.** Si el almacenamiento no está
  disponible —modo privado— el `try/catch` traga y la página se pinta con sus
  valores por defecto en vez de quedarse en blanco.
- **Es una página autónoma**: no carga el motor ni los datos, sólo Tailwind y
  un `<script>` en línea.
- Lleva el bloque de apoyo (PayPal) y los tres enlaces de compartir. **El
  donativo es un `<form>` a `paypal.com/donate` con botón propio**: ni la imagen
  de `paypalobjects.com` ni el pixel de seguimiento del fragmento oficial, que
  darían la IP de cada visitante a PayPal sin que nadie haya pedido donar. Los
  logos de compartir son **SVG en línea** (simple-icons, CC0) por lo mismo.
- **Del logo de Facebook sólo se usa la «f»**, recortada del glifo original: el
  de simple-icons es el disco entero con la letra calada, y en blanco sobre el
  botón azul salía el negativo de la marca. Lleva un `translate` porque su caja
  no está centrada en el viewBox.
- **El aviso de por qué no se puede guardar va DEBAJO de la fila de botones**,
  no dentro: metido en el flex se colaba entre «Save score» y «Leaderboard» y
  partía los rótulos en dos líneas.

## La bitácora de la partida

Cada jugada resuelta se anota en `state.bitacora`, y al acabar viaja dentro de
`pn.lastResult` bajo la clave `partida`:

```js
partida: {
  semilla: 31337,
  campo: ['eras', 'rings', 'teams', …],       // la categoría de cada burbuja
  jugadas: [{ b: 0, r: 1, ms: 2480 }, …],     // burbuja, opción pulsada, tiempo
  datos: { 'mlb-data.js': '2af028cd', … },    // con qué versión se jugó
}
```

- **`r` es el índice de la opción pulsada, y a `null` es que se agotó el
  tiempo**, que no es lo mismo que fallar. El índice vale porque el orden de las
  opciones lo baraja el azar sembrado: al rehacer la ronda vuelve a salir igual.
- **`b` es el índice de la burbuja, no la categoría.** La categoría se saca del
  campo, y el campo de la semilla: guardar las dos cosas permite detectar que no
  cuadran.
- **`datos` es imprescindible para reproducir.** Si se regenera `mlb-data.js`,
  las mismas semillas dejan de dar las mismas preguntas. Las huellas ya las pone
  `sella-versiones.py`, así que `versionDeDatos()` se limita a leerlas del DOM.

Comprobado contra el motor fuera del navegador: de una partida jugada de verdad
en el navegador salen **el mismo campo y las mismas cinco rondas con las mismas
respuestas correctas**.

## La clasificación

Vive en `leaderboard.html` y **todavía no está encendida**: falta crear el
proyecto de Supabase. Los pasos, el esquema y la función de validación están en
[supabase/README.md](supabase/README.md).

- **Con `leaderboard-config.js` vacío, nada revienta**: la página de fin apaga
  el botón de guardar diciendo por qué y la clasificación explica que aún no
  está abierta, en vez de soltar un error de red que no significa nada.
- **El marcador no se envía: se deduce.** El cliente manda la semilla y lo que
  hizo el jugador; los puntos los calcula el servidor rehaciendo la partida.
  Probado en Node contra el verificador: partida legítima aceptada con los
  puntos exactos, y rechazadas la del campo manipulado, la de burbuja repetida,
  la de respuestas de 100 ms, la partida a medias, la de semilla falseada, la de
  jugadas de más y la que apunta a una opción inexistente.
- **La clave que irá en el JavaScript es pública por diseño y sólo puede leer.**
  Escribir sólo se puede a través de la función.
- **Los nombres se escapan al pintarlos.** Los escribe cualquiera y van a un
  `innerHTML`: sin escapar, el primero que ponga `<img onerror=…>` de alias
  ejecuta código en el navegador de todos los demás. Probado con ese alias
  exacto: sale como texto.
- **Al llegar de registrar, la lista no empieza por el número uno: empieza donde
  está el jugador.** Se guarda su identificador, se calcula su puesto real —
  contando también a los que empatan y llegaron antes, que si no dos empatados
  compartirían número— y se cargan 60 filas desde 20 antes que él, con su fila
  resaltada y la caja ya desplazada. El anclaje va **sin animación**: la lista
  tiene que aparecer ya colocada.
- **Los tres primeros llevan medalla** de oro, plata y bronce, en SVG en línea y
  con el número dentro: la medalla destaca el puesto, no lo sustituye.
- **El fondo de la cabecera fija va en los `th` y no en el `thead`**: puesto en
  el thead no lo pintan todos los navegadores y las filas se transparentan al
  pasar por debajo.

## Reglas del juego

- `VIDAS` = 3, `TIEMPO` = 12 s por pregunta, `PUNTOS_MAX` = 100, 20 burbujas.
  Todo en `motor.js`.
- **Los puntos bajan linealmente con lo que se tarda**: instantáneo 100, a la
  mitad del tiempo 50, agotado 0. Quedarse sin tiempo cuenta como fallo.
- **La barra se pinta a mano en cada fotograma**, no con una transición CSS,
  porque el mismo reloj decide los puntos: lo que se ve y lo que se cobra salen
  del mismo sitio.
- **Durante la entrada de la pregunta no corre el reloj**: sería injusto
  descontar tiempo de una pregunta que aún no se lee. **Y las cartas van
  deshabilitadas hasta que arranca**: parar sólo el reloj no basta, porque quien
  respondía antes pagaba el tiempo entero —`ms` cae a `TIEMPO`— y se quedaba sin
  puntos habiendo acertado. Salió jugando una partida automática.
- **El azar va sembrado** (`mulberry32`), así que con la semilla y las burbujas
  que pulsó el jugador se reconstruye la partida entera. Es lo que permitiría
  comprobar una puntuación en un servidor, como en Billions. **Lo decorativo
  —posiciones, deriva, fotos— usa `Math.random`**: si compartiera el generador
  sembrado, la partida dependería del tamaño de la pantalla.

## Pendiente

- **Crear el proyecto de Supabase.** Todo lo demás está escrito y probado: el
  esquema, la función que revalida y las dos páginas. Son cinco pasos, en
  [supabase/README.md](supabase/README.md). `privacy.html` ya explica qué se
  enviará y cuándo, y dice que aún no está encendido.
- Categorías que los datos ya permiten y no están: posiciones (receptor,
  cerrador), país de nacimiento como burbuja propia, récords de una temporada
  concreta.
- 433 jugadores del catálogo no tienen retrato —casi todos anteriores a 1950—;
  se les puede nombrar pero no salen en tarjeta.
