# Billions — juego de taquilla

Quiz web de cine: veinte **burbujas** repartidas por la pantalla, cada una de un
tipo de pregunta —taquilla, estrenos, directores, repartos, crítica, filmografía,
banda sonora u Óscars—. Un sorteo
las enciende al azar hasta pararse en una, que plantea su pregunta. Gana quien
revienta las veinte antes de fallar tres veces. Interfaz al estilo de Apple TV. Se permiten dos fallos;
al tercero se acaba la partida. En producción:
**https://ganoyo.com**

**Proyecto independiente.** Nació dentro del repo de Bonitu Plays y se
publicaba con él; **el 2026-08-24 salió a repositorio, bucket y distribución
propios**. No comparte código, estilos ni datos con el juego de niveles ni con
el recetario.

> **No lo acoples a la infraestructura de Bonitu.** Si hace falta un servicio
> nuevo —base de datos, analítica, dominio—, se le monta el suyo. Lo único que
> sigue heredado son las páginas de privacidad, cookies y aviso legal, que son
> las de bonitu.es y hay que escribirle las propias: ver
> [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md).

## Lo esencial en 30 segundos

- **Sin build ni dependencias.** Tailwind es el CDN Play, que compila las clases
  en el navegador, pero **servido desde `vendor/tailwind.js`**, no desde
  `cdn.tailwindcss.com`. Igual la tipografía Inter, en `fonts/`.
  **El sitio no hace NINGUNA petición externa**, y eso no es una optimización:
  pedir esos archivos fuera entregaba la IP de cada visitante a Google y a
  Tailwind, lo que obliga a declararlo y discutiblemente a pedir consentimiento.
  Alojándolos, la política de privacidad puede decir la verdad en dos párrafos y
  no hace falta banner de cookies. **Si añades una biblioteca, tráetela.**
- **Páginas legales propias**: `privacidad.html` y `aviso-legal.html`, enlazadas
  al pie de la portada junto a la atribución de fuentes. Si alguna vez se guarda
  algo en un servidor —una clasificación, por ejemplo—, hay que actualizarlas
  **antes** de ponerlo en marcha.
- **Antes de desplegar un cambio de datos, pasa `tools/sella-versiones.py`.**
  Pone la huella del contenido en cada `<script src>` (`actores.js?v=3d235854`).
  Sin eso, un navegador que ya se había guardado `actores.js` seguía usándolo:
  los archivos se sirven **sin `Cache-Control`** y las etiquetas no llevaban
  versión, así que actualizar el Excel no se notaba en quien ya hubiera entrado.
  Es idempotente y sólo toca lo que haya cambiado.
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
| `clasificacion.html` | Tabla de las 100 mejores partidas. Autónoma: lee Supabase con `fetch` y no carga `main.js` ni los datos |
| `404.html` / `500.html` | Páginas de error, autónomas y con **rutas absolutas**: se sirven para cualquier URL, también `/lo/que/sea/` |
| `fin.html` | Pantalla de fin de partida, página aparte. Lee el resultado de `localStorage` (`billions.lastResult`) y ofrece apoyo, compartir y volver a jugar |
| `index.html` | Tablero, pantalla previa, aviso superpuesto. CSS propio en un `<style>` (animaciones); el resto son clases de Tailwind |
| `motor.js` | **El motor de la partida**: azar sembrado, depósitos de datos, generadores de ronda y fórmula de puntos. No toca el DOM, para que pueda correr también fuera del navegador |
| `main.js` | Estado, pintado, revelado, récord. Sin módulos: variables globales y `defer` |
| `movies.js` | `const MOVIES` — generado por `tools/build-data.py`, **no editar a mano**. Campos: `r` identificador, `t` título, `g` recaudación (puede faltar), `y` año, `o` Óscars, `fa` nota FA, `d` director(es), `a` reparto, `oc` categorías |
| `posters.js` | `const POSTERS` — puesto → nombre de archivo en `posters/` |
| `posters/*.jpg` | 100 carátulas, 300 px de ancho |
| `posters/_report.json` | Caché de resolución del descargador (qué página y qué archivo de Wikipedia usó cada película) |
| `directors/*.jpg` | 118 fotos de directores, 400 px de ancho |
| `actors/*.jpg` | 624 fotos de actores (de 641 personas), 300 px de ancho |
| `composers/*.jpg` | 77 fotos de compositores (de 96 personas), 300 px de ancho |
| `composers.js` | `COMPOSERS` (puesto de película → compositores) y `COMPOSER_PHOTOS` (nombre → archivo). Generado por `fetch-people.py --role composers` |
| `directors.js` / `actors.js` | `DIRECTORS`/`ACTORS` (puesto de película → nombres) y `DIRECTOR_PHOTOS`/`ACTOR_PHOTOS` (nombre → archivo). **Todavía no los carga `index.html`**: los datos están listos, el juego no los usa |
| `*/\_report.json` | Qué foto se asignó a cada persona, cuáles fueron por vía indirecta y cuáles quedaron en duda |
| `tools/build-data.py` | Regenera `movies.js` cruzando los dos Excel |
| `tools/fetch-posters.py` | Descarga las carátulas. Dos fuentes: Wikipedia (sin clave) o TMDB (con clave) |
| `tools/repara-caratulas.py` | Rehace las carátulas que no son carátulas: vuelve a resolverlas en la Wikipedia inglesa y rechaza lo que no tenga forma de cartel |
| `tools/fetch-people.py` | Saca del Excel los directores o los actores y descarga sus fotos (`--role`) |
| `tools/build-artifact.py` | Empaqueta todo en un HTML autocontenido en `build/` |
| `tools/sella-versiones.py` | Pone la huella del contenido en los `<script src>` para que el navegador no sirva datos viejos de su caché |
| `top_100_...xlsx` | Datos de origen del juego (100 películas, sólo taquilla) |
| `top_peliculas_taquilla_y_critica.xlsx` | Datos ampliados: 189 películas con director, nota de FilmAffinity, Óscars y 5 actores. **`movies.js` no sale de aquí todavía** |
| `top_50_actores_numero_peliculas.xlsx` | Los actores con más largometrajes rodados, con su fiabilidad. Origen de `actores.js`. **La hoja ya ha cambiado de nombre una vez**: el script la localiza por la fila de cabecera, no por el nombre |
| `actores.js` | `const ACTORES_TOP` — generado por `tools/build-actores.py`, **no editar a mano**. Campos: `n` nombre, `p` nº de películas, `tol` margen de error, `f` archivo en `actors/` |
| `tools/repara-personas.py` | Rehace las fotos de personas que apuntaban a otro con nombre parecido |
| `tools/build-actores.py` | Regenera `actores.js` y descarga las fotos que falten |
| `nacimientos.js` | `const NACIMIENTOS` — nombre → año de nacimiento, de los 635 actores en juego. Generado, **no editar a mano** |
| `tools/fetch-nacimientos.py` | Descarga los años de nacimiento de Wikidata (P569) |

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

## El campo de burbujas

**Veinte burbujas repartidas por la pantalla**, cuatro por categoría, sin
recorrido ni ficha ni dado. **El jugador pulsa la que quiere** y esa plantea la
pregunta de su categoría. Acertar la revienta y la saca del campo. Se gana al
vaciarlo y se pierde al tercer fallo.

- **Las posiciones son una rejilla con desorden**: cada burbuja nace en su celda
  y se desplaza un poco al azar (`reparteBurbujas()`). Parece repartido a mano y,
  a diferencia de sortear posiciones libres, no se amontonan.
- **20 burbujas.** Entre nueve categorías no reparten exacto: cada una sale dos
  veces y dos salen una tercera. **Las agraciadas se sortean en cada partida**,
  para que no sean siempre las mismas las que aparecen más.
  - **El reparto se hace a mano, no quitando sobrantes al azar**: quitando al
    azar podían caer las tres quitadas sobre la misma categoría y dejarla sin
    ninguna burbuja en el campo.
  - **Sólo entran las categorías que de verdad pueden preguntar** (`hay()`). Si
    un archivo de datos no llegara a cargar, su categoría se queda fuera en vez
    de dar una burbuja que al pulsarla suelta la pregunta de otra.
- **La rejilla se pone de pie en pantalla estrecha**: 4×5 por debajo de 640 px y
  5×4 por encima. Un móvil vertical no tiene sitio para cinco columnas de
  burbujas grandes.
- **En móvil el campo ocupa todo el ancho del dispositivo** (`-mx-4 sm:mx-0`):
  se sale del padding de `#app`, que le robaba 32 px.
- **La posición se corrige al pintar para que ninguna burbuja asome fuera**:
  el centro se limita a `radio + deriva + 2` de cada borde. Sin esa corrección,
  las columnas de los extremos se salían hasta 51 px en un móvil.
- **El recorrido de la deriva va en fracción del diámetro**, no en píxeles fijos:
  38 px de deriva sacaban la burbuja del campo en una pantalla pequeña.
- **El diámetro se calcula midiendo el contenedor** (`diametroBase()`): celda =
  mín(ancho/columnas, alto/filas), por 0,78. Sacarlo del ancho de la ventana
  ignoraba el alto, y con siete filas en un móvil corto las burbujas se solapaban
  verticalmente. Por eso el campo se repinta al cambiar el tamaño de la ventana.
- **El desorden de las posiciones va en fracción de celda**, no en porcentaje de
  pantalla: con rejillas distintas, un valor fijo se come filas enteras.
- **En móvil la deriva va un 22 % más rápida** (media query sobre
  `animation-duration`): el campo es más pequeño y el mismo recorrido se percibe
  más lento.
- **El reparto de categorías se baraja en cada partida**, así que dos partidas
  no se ven iguales.
- **Una película no se pregunta dos veces en la misma partida** (`state.vistas` y
  `frescas()`): cada generador trabaja sobre el depósito ya filtrado y la ronda
  declara sus películas en `r.pelis`. Sin esto, en una partida de 20 rondas se
  repetía alguna el 99 % de las veces, con 3,8 repeticiones de media. Si quedasen
  menos de diez sin usar, se vuelve al depósito entero: antes repetir que
  quedarse sin preguntas.
- **Los depósitos de imagen de fondo son amplios a propósito** (45 de taquilla,
  32 de estrenos, 27 premiadas). Con dos o tres burbujas de cada categoría por
  partida, un depósito de quince hacía que se repitieran las mismas carátulas
  partida tras partida.
- **Cada burbuja lleva de fondo una foto de su temática al ~50 %**, sacada de los
  archivos del propio juego: un director para dirección, un actor para reparto,
  una carátula del top de taquilla, una película antigua para estrenos y una
  premiada para Óscars (`imagenPara()`). Las veinte salen distintas.
- **La foto va debajo y el color encima con alfa**, no al revés: así la esfera
  conserva la identidad de color de su categoría y la foto se lee a media
  intensidad. Poner la foto encima con `opacity` apagaría también el degradado.
- **Elegida y bloqueo**: pulsar una burbuja fija `state.actual`; mientras haya
  una elegida, las demás no responden.
- **La burbuja acertada desaparece del campo**, no se queda apagada. Antes se
  quedaba a opacidad 0,3 con una marca de visto, y al final de la partida el
  campo era un cementerio de restos entre los que costaba distinguir lo que
  quedaba por jugar. Ahora `pintaBurbujas()` sencillamente no las dibuja.
- **La que acaba de caer se pinta una última vez para que se la vea reventar**
  (`state.reciente` y la animación `.revienta`, `REVIENTA_MS` = 620 ms): crece,
  se difumina y se va, como una pompa. Al acabar, el campo se repinta ya sin
  ella.
  - **El repintado va por temporizador y no por `animationend`**: un cambio de
    tamaño de ventana rehace el marcado entero y el evento se perdería con el
    nodo, dejando la burbuja congelada en el campo para siempre.
  - **La animación gana a la escala en línea del botón** sin necesidad de
    `!important`: las animaciones pesan más que el atributo `style`.
  - Con `prefers-reduced-motion` la regla la deja en `opacity: 0`. Sin eso, sin
    animación no habría nada que la hiciera desaparecer y se quedaría a la vista
    hasta el repintado.
- **La vigésima también revienta antes de la enhorabuena.** `responde()` ya no
  se salta el tablero al completar la última: vuelve al campo, la revienta, deja
  ver el campo vacío `VACIO_MS` (450 ms) y entonces celebra. Es el remate de la
  partida y hay que verlo.
- `ELEGIDA_MS` (1,1 s) es lo que la elegida se luce con su rótulo antes de que se
  abra la pregunta.
- **La burbuja elegida sube de capa** (`z-index`): al crecer invade a sus
  vecinas y tiene que quedar por encima.
- **Al elegir sale un rótulo** con la temática (`muestraRotulo()`), visible
  durante `ELEGIDA_MS`, y se retira al abrir la pregunta.
- **Las burbujas fluyen a la deriva, con un nivel del DOM por propiedad**:
  centrado (`transform`), eje X (`translate`), eje Y (`translate`) y escala
  (`scale`). Compartir `transform` haría que cada uno anulase a los demás.
- **Los dos ejes van por separado y con periodos distintos** (26–44 s y 31–52 s),
  cada uno de ida y vuelta con una curva casi sinusoidal. Así el movimiento sólo
  se detiene en los extremos de cada eje, como un péndulo, y la trayectoria
  compuesta no se repite a la vista. **Un solo fotograma con varios puntos y
  `ease-in-out` frenaba en cada punto intermedio**: era lo que hacía que no
  fluyera.
- El campo se deja **sin más texto que el estado**: los créditos de fuentes e
  imágenes (`#creditos`) sólo aparecen en la pantalla de pregunta, que es donde
  se ven las cifras y las fotografías que acreditan.

### Aspecto: lenguaje de Apple TV

- **Tipografía del sistema**: `-apple-system, BlinkMacSystemFont, 'SF Pro Display'`
  con Inter de reserva. En dispositivos Apple resuelve a San Francisco de verdad;
  en el resto, Inter es la sustituta más cercana. No hay fuente de titulares
  aparte: `.display` es la misma familia con más peso y tracking negativo.
- **Las burbujas son esferas de degradado**, sin borde: tres paradas de color
  (`ESFERA`: luz, medio y sombra) desde un foco arriba a la izquierda, más una
  sombra difusa del propio color.
- **No hay leyenda.** El nombre de la categoría aparece **dentro** de la burbuja
  al señalarla, en negrita y versales, con sombra para que se lea sobre la foto.
  El tamaño de letra escala con el de la burbuja (9–14 px). En táctil, donde no
  hay hover, ese papel lo cumple el rótulo al elegir.
- **Los iconos de categoría** (`ICONOS`) viven ya sólo en el rótulo. En el fondo
  de las burbujas van fotos, no iconos.
- **La paleta de las burbujas son pasteles del rosa al turquesa**, la gama de
  la referencia que pasó Miguel. Los nueve tonos están repartidos por igual
  (178°–343°, en pasos de 20,7°): ese paso regular es lo que los mantiene
  distinguibles siendo todos de la misma familia. Las tres paradas de cada esfera
  salen siempre de la misma fórmula sobre ese tono: luz al 100/92,9 de saturación
  y luminosidad, medio al 80,4/78 y hondo al 44,9/58. **Si se añade una categoría
  hay que volver a repartir la rampa entera, no encajarla en un hueco.** Al
  entrar Filmografía se hizo así: meterla en el hueco más ancho la habría dejado
  a 18° de sus dos vecinas, menos separación de la que ya había entre las demás.
  Al entrar Banda sonora se repartió otra vez, y por eso cambiaron de tono los
  ocho colores anteriores.
- **Los números van en blanco, no en un color de acento.** El color vive en las
  burbujas; un acento naranja al lado de estos pasteles desentonaba. El verde,
  el naranja y el rojo se reservan para lo semántico: acierto, fallo y tiempo. Las pequeñas llevan un desenfoque leve que da
  profundidad de campo; la destacada siempre entra a foco.
- **Superficies de cristal** (`.glass`, `.glass-fuerte`): fondo translúcido con
  `backdrop-filter: blur() saturate()` y borde blanco muy tenue.
- **Foco al modo tvOS** (`.foco`): al señalar, la pieza crece un 5,5 %, se aclara
  y proyecta sombra, con la curva `cubic-bezier(.2,.8,.2,1)` del sistema.
- **Paleta**: colores de sistema de Apple en modo oscuro — naranja `#FF9F0A`
  taquilla, azul `#0A84FF` estrenos, morado `#BF5AF2` dirección, verde `#30D158`
  reparto y rosa `#FF375F` Óscars. El verde y el rosa hacen además de acierto y
  fallo.
- **El acierto y el fallo se marcan con estilo en línea**, no con clases: la
  superficie de cristal define su propio borde en el CSS y una clase de Tailwind
  podría quedar por debajo en la cascada.
- **El fondo es `imgs/bg_game.webp` al 25 % sobre negro** (un bokeh nocturno que
  rima con las burbujas), y encima tres luces difusas de color. Va en un `div`
  fijo y no con `background-attachment: fixed`, que en iOS da problemas. Las
  luces se bajaron al 9–10 % al añadir la foto para que no la enturbiaran.

## Pantallas de inicio y de victoria

- **La portada es una vista completa, no un aviso superpuesto.** Ocupa la
  pantalla entera, con doce esferas flotando de fondo y el texto encima. Antes
  era una tarjeta de cristal centrada; se cambió a petición de Miguel el
  2026-08-24, con textos mucho mayores.
  - **Tapa el tablero pero conserva el fondo bokeh**, poniéndoselo ella misma.
    Dejar pasar el del documento enseñaba por debajo la cabecera del juego y sus
    veinte burbujas: dos campos de esferas superpuestos.
  - **Las esferas y el velo van `fixed`, no `absolute`**: en un contenedor con
    desplazamiento, lo absoluto se va con el contenido y en un móvil alto el
    fondo se despegaba al bajar.
  - **El diámetro se mide del contenedor**, como en el campo. Con píxeles fijos,
    unas esferas de 70 px se perdían en una pantalla entera. Por eso la portada
    también se repinta al cambiar el tamaño de la ventana.
- **La portada se dibuja con las piezas del juego**: doce esferas flotando y las
  nueve temáticas como fichas con su esfera, su icono y su color —el código de
  color se aprende ahí y no a base de fallar partidas—. Sale de la misma tabla
  `COLORES`/`ICONOS`/`ETIQUETAS`, así que añadir una categoría actualiza la
  portada sola. **La rejilla sí hay que tocarla**: son `grid-cols-3
  sm:grid-cols-9` en `index.html`, y con nueve fichas en cuatro columnas la
  última fila se quedaba con una suelta.
- **En móvil la portada se queda en título, fichas y botón.** Los tres pasos
  (`<ol>`) van `hidden sm:grid`: se comían 194 px de los 667 de un iPhone SE y
  empujaban el botón fuera de la pantalla. Medido, la portada pasaba de 1005 px
  de alto a los 667 disponibles; ahora entra justa en ambos. El juego se explica
  solo en la primera ronda.
  - **Las nueve fichas van en dos filas de cinco y cuatro**, con la foto, el
    icono y el rótulo más pequeños. Ahí estaban 441 de los 1005 px.
  - **El contenedor es flex en móvil y grid de tablet en adelante.** Con nueve
    fichas en cinco columnas, la segunda fila se queda con cuatro y una rejilla
    las alinea a la izquierda dejando un hueco; el flex las centra. Por eso la
    ficha lleva `w-[calc(20%-0.3rem)] sm:w-auto`.
- **`justify-content: safe center` y no `center` a secas.** Centrando sin más, si
  el contenido no cabe se desborda por arriba y **no hay manera de llegar a él**:
  en un portátil bajo el título quedaba fuera de la pantalla. `safe` deja de
  centrar en cuanto hay desbordamiento.
- **El icono de reinicio de la cabecera vuelve a la portada llamando a
  `startGame()`**, no repitiendo su reinicio a mano. Lo repetía, y se le había
  quedado fuera `muestraTablero()`: el campo se ocultaba y ya no lo volvía a
  enseñar nadie, así que al pulsar «Jugar» la portada se desvanecía y detrás no
  había nada. **`closeIntro()` sólo quita la portada**, porque da por hecho que
  el tablero lleva pintado desde que cargó la página; quien devuelva a la
  portada tiene que dejarlo así. Reproducido y verificado con Chrome headless.
- **De la portada al juego se pasa con un fundido de `SALIDA_INTRO_MS` (1,5 s).**
  La portada se desvanece y se acerca un punto, como si se entrara en el
  tablero. **El cruce sale gratis**: el campo ya está pintado por detrás desde
  que carga la página, así que basta con desvanecer lo de delante.
  - **La portada sigue capturando pulsaciones mientras se va** (nada de
    `pointer-events: none`): si no, se podría elegir una burbuja a través de ella
    y abrir una pregunta con la portada todavía a medio desaparecer.
  - **`state.saliendoIntro` evita encadenar dos fundidos**: al botón y a la tecla
    se puede llamar dos veces seguidas.
  - Aquí no hay reloj que arrancar —sólo corre durante una pregunta—, así que el
    fundido no le quita tiempo a nadie.
- **El botón se enfoca con `preventScroll`.** Sin eso, el navegador lo llevaba a
  la vista al cargar y empujaba el título fuera de la pantalla — 57 px de
  desplazamiento que parecían un fallo de maquetación y no lo eran.
- **Las esferas de la portada son las mismas pompas del campo**, no una versión
  simplificada: la misma receta de foto debajo y velo de color encima
  (`imagenPara()`, encuadre al 28 % en los retratos), la misma sombra, el mismo
  desenfoque de profundidad de campo en las pequeñas y la misma deriva de dos
  ejes (`.deriva-x`/`.deriva-y`). Lo primero que se ve es la pieza de verdad. El
  cabeceo propio que tenían antes (`flotaIntro`) se retiró: además de no
  parecerse al juego, se quedaba fuera de la regla de `prefers-reduced-motion`,
  que sólo nombra las clases de deriva.
- **La partida acaba en una página aparte, `fin.html`**, no en un aviso
  superpuesto: se cambió el 2026-08-25. Tanto `victoria()` como `gameOver()`
  arman el texto y llaman a `guardaResultadoFinal()`, que deja el resultado en
  `localStorage` bajo `billions.lastResult` y hace `location.href = 'fin.html'`.
  - **El traspaso va por `localStorage` y no por la URL**: el detalle es HTML
    con marcado, y meterlo en la barra de direcciones sería feo y frágil.
  - **No repite la solución de la última pregunta.** `gameOver()` ya no recibe
    el `detalle` del aviso: ésa se ha visto en el toast, que es donde toca, y en
    el resumen sólo van los puntos y el récord.
  - Lleva el pie legal (privacidad y aviso legal), como la portada. Enlace de
    cookies no: el banner y sus preferencias viven en `index.html`, que es donde
    se carga `main.js`.
  - **`fin.html` se apaña con lo que reciba.** Si el almacenamiento no está
    disponible —modo privado— el `try/catch` traga y la página se pinta con sus
    valores por defecto, en vez de quedarse en blanco.
  - **Es una página autónoma**: no carga `main.js` ni los datos del juego, sólo
    Tailwind y un `<script>` en línea. Por eso no la toca `sella-versiones.py`.
  - Lleva el bloque de apoyo (**PayPal**, desde el 2026-08-26; antes Buy Me a
    Coffee) y los tres enlaces de compartir.
  - **Los tres logos de compartir son SVG en línea** (simple-icons, CC0), no
    archivos ni iconos de un CDN: la regla de cero peticiones externas vale
    también para esto, y así heredan el color del botón.
  - **Del de Facebook sólo se usa la «f», recortada del glifo original.** El de
    simple-icons es el disco azul entero con la letra calada: pintado en blanco
    sobre el botón azul salía un círculo blanco con la «f» azul, el negativo de
    la marca. Se le quitó el arco del círculo —que aquí ya lo pone el botón— y
    **lleva un `translate` porque su caja no está centrada en el viewBox**: en
    el logotipo la letra se apoya en el borde de abajo del disco.
  - **El donativo es un `<form>` a `paypal.com/donate` con botón propio.** Ni la
    imagen `btn_donate_LG.gif` de `paypalobjects.com` ni el pixel de seguimiento
    que trae el fragmento oficial: cargarlos entregaría la IP de cada visitante
    a PayPal sin que nadie haya pedido donar, que es justo lo que la regla de
    «ninguna petición externa» evita. Con el botón propio, la petición sólo sale
    al pulsar —el consentimiento es el propio botón, como en la clasificación—.
    Los campos ocultos (`business`, `no_recurring`, `item_name`,
    `currency_code`) son los del fragmento de PayPal. `privacidad.html` lo
    recoge.
    De ahí se vuelve al juego con un enlace normal a `index.html`.
  - **«Grabar puntuación» está puesto pero no hace nada todavía.** Cuando lo
    haga, si guarda algo en un servidor hay que actualizar `privacidad.html`
    **antes** de ponerlo en marcha.
  - **El overlay `#gameover` que había en `index.html` ya no existe**, ni la
    celebración de esferas (`pintaFiesta()`, las animaciones `.sube` y
    `.destello`): se borraron al quedar sin uso. `fin.html` no las tiene.

## El catálogo

**191 películas**: las 189 de la hoja «Listado completo» más dos estrenos de 2026
que sólo están en la lista de taquilla. Hasta agosto de 2026 el catálogo eran
sólo las 100 más taquilleras y las 91 de crítica se descartaban en el cruce; por
eso *El Padrino* y compañía no aparecían nunca.

- **Los identificadores 1–100 son los de la antigua lista de taquilla y no deben
  cambiar**: con ellos se nombran las carátulas (`posters/007.jpg`). Las nuevas
  se numeran desde 101.
- **Una película entra en cada temática para la que tenga datos**, no hacen falta
  todos: hay clásicas sin recaudación que sí juegan en estrenos, dirección,
  reparto y premios. `CON_TAQUILLA`, `CON_OSCAR`, `CON_NOTA`… son depósitos
  independientes.
- **Varias películas antiguas comparten recaudación** (cifras redondeadas: cuatro
  con 5 M y dos con 25 M). `rondaTaquilla()` descarta explícitamente los pares
  con la misma cifra: un duelo empatado no tendría respuesta correcta, y la
  horquilla de dificultad se afloja lo suficiente como para admitirlos.
- Las carátulas se buscan **primero en la Wikipedia en inglés**, que es la que
  guarda el cartel de estreno en la ficha. Se valida que el año aparezca en el
  artículo y se descartan las páginas de saga, que si no *El Padrino* y su
  segunda parte acababan las dos en «Trilogía de El padrino».
- **Buscar primero en español fue un error caro y no hay que repetirlo.** Se
  hizo al ampliar el catálogo, pensando que las clásicas vienen con el título
  traducido, y estropeó 61 de las 91 nuevas:
  - **La ficha española lleva muchas veces el logotipo, no el cartel**: salieron
    33 rótulos apaisados (*Blade Runner* a 300×29, *Whiplash*, *Moonlight*,
    *El Padrino*…). El juego los pintaba como una franja en medio de la tarjeta.
  - **Su buscador se va a otra película de nombre parecido**: *La La Land* acabó
    con el cartel de *Passengers*, *Nomadland* con el de *One Night in Miami*,
    *American Beauty* con el logo de *La Bella y la Bestia* y *Hasta que llegó
    su hora* con el de *Érase una vez en América*. Ninguna de esas la cazaba la
    validación del año.
  - La inglesa encuentra igual de bien las clásicas aunque el título del
    catálogo venga traducido: resolvió las 61 sin fallar una.
  - `tools/repara-caratulas.py` es lo que las rehízo, y **sólo acepta la imagen
    si es más alta que ancha** (`MAX_RATIO`). Es la comprobación que faltaba: un
    logotipo va de 2:1 a 10:1 y se cae solo.

## Los ocho tipos de ronda

| Tipo | Pregunta | Respuesta | Depósito |
|---|---|---|---|
| `taquilla` | ¿Cuál recaudó más? | Elegir tarjeta | 100 |
| `anio` | ¿Cuál se estrenó antes? | Elegir tarjeta | 100 |
| `critica` | ¿Cuál tiene mejor nota en FilmAffinity? | Elegir tarjeta | 89 |
| `director` | ¿Dirigió *X* la película *Y*? | Sí / No | 98 |
| `actores` | ¿Coincidieron *X* e *Y* en *Z*? | Sí / No | 98 |
| `oscar` | ¿Ganó *X* algún Óscar? | Sí / No | 98 |
| `oscarcat` | ¿Ganó *X* el Óscar a *Mejor Y*? | Sí / No | 27 |
| `filmografia` | ¿Quién ha rodado más películas, *X* o *Y*? | Elegir tarjeta | 50 actores |
| `bso` | ¿Compuso *X* la banda sonora de *Y*? | Sí / No | 157 |

- **`filmografia` no juega con películas, sino con personas.** Su depósito es
  `actores.js` (los 50 con más largometrajes rodados, de Samuel L. Jackson con
  152 a Timothée Chalamet con 20), y por eso su ronda **no declara `pelis`**:
  `state.vistas` guarda identificadores de película y ahí no encajan.
- **El hueco exigido sale de la fiabilidad de cada cifra, no es fijo.** El Excel
  marca cada recuento como verificado (TMDB o filmografía de Wikipedia),
  estimado (±5) o provisional (TV Guide, AceShowbiz: **pueden mezclar créditos
  de cine y televisión**). `build-actores.py` traduce eso a un margen por actor
  —3, 8 y 15 películas— y la ronda exige que la diferencia supere la **suma de
  los dos márgenes**, con `FILMO_MINIMO` (10) como suelo. Un provisional contra
  un verificado necesita 18 de hueco; dos verificados se apañan con 10.
  De paso descarta los empates, que los hay. No es dificultad: es que el duelo
  no lo decida el criterio de quien contó.
- **`bso` es la ronda de dirección con otro dato**: mismo modo sí/no, mismas dos
  cartas —carátula y retrato— y el mismo equilibrio, que sortea la respuesta
  antes de buscar a quién nombrar. El intruso se aprieta con el nivel: a partir
  del 6 tiene que haber compuesto algo a menos de seis años de la película, que
  es cuando de verdad hay que saberse quién firmó qué.
  - **De la columna de compositor sólo entra la composición original.** El Excel
    marca también recopilaciones («Varios (supervisión musical)» en *Pulp
    Fiction*), adaptaciones de música ajena (Joplin en *The Sting*, Mozart en
    *Amadeus*), direcciones musicales y aportaciones parciales (*Django
    Unchained*). De ninguna se puede preguntar «¿compuso X la banda sonora de Y?»
    y esperar una respuesta inequívoca, así que esas películas se quedan sin
    ronda de banda sonora. Lo decide `AMBIGUA`, la misma expresión en
    `build-data.py` y en `fetch-people.py`: **si tocas una, toca la otra.**
  - **El paréntesis que sí se conserva es el seudónimo** («Abigail Mead (Vivian
    Kubrick)» en *Full Metal Jacket*): se pregunta por el nombre con el que
    firma la banda sonora.
  - **Un nombre de una sola palabra es legítimo** —Vangelis en *Blade Runner*—.
    Filtrar por «nombre y apellido» para tirar el «Varios» suelto lo dejaba
    fuera; de «Varios» ya se encarga `AMBIGUA` antes.
  - Medido sobre 20.000 rondas: 49,6 % de síes y **ningún "no" falso**, porque
    aquí la negación se comprueba contra el dato y no con una heurística como en
    los repartos.
- **`oscarcat` tira de un depósito pequeño** (27 películas con desglose de
  premios, 18 categorías). Su umbral en `frescas()` está bajado a 6 por eso.
- **Las categorías se limpian de paréntesis** al generar los datos: el Excel trae
  «Mejor Actor de Reparto (Heath Ledger)», y sin limpiarlo no se reconocería que
  dos películas ganaron la misma categoría.
- **Nueve estrenos recientes no tienen nota de FilmAffinity** («N/D» en el Excel)
  y quedan fuera de las rondas de crítica.

Cada tipo es una función `ronda*(level)` que devuelve un objeto con `pregunta`,
`modo` (`elige` o `sino`), `cartas`, `correcta` y `firma` (para no repetir ronda).
Añadir un tipo nuevo es escribir esa función y meterla en `TIPOS` con su peso.

**Reglas que no hay que romper:**

1. **Nada entra en juego sin fotografía.** Los fondos `PELIS`, `CON_DIRECTOR`,
   `CON_REPARTO` y `CON_OSCAR` se filtran al arrancar comprobando que existe la
   imagen. Es un requisito del diseño, no una optimización.
2. **En las rondas de estreno el año va oculto** (`sinAnio`), porque es
   justo lo que hay que adivinar. En las de taquilla sí se ve.
   - **Y se quita también del título** (`tituloSinAnio()`). Siete películas lo
     llevan dentro para distinguirse de su remake —«The Lion King (1994)»,
     «Aladdin (2019)», «Beauty and the Beast (2017)»…— y ahí la respuesta iba
     escrita en la carta y en el propio enunciado. Se quita sólo donde el año
     está oculto: en taquilla y en crítica hace falta para saber de cuál de las
     dos se habla, y allí el año se ve de todos modos.
   - De paso, `rondaAnio()` **descarta la pareja cuyos títulos coincidan sin el
     año**: hoy no puede darse —los dos «Rey León» se llevan 25 años y la banda
     no llega—, pero serían dos cartas idénticas sin respuesta posible.
3. **Los sí/no se equilibran a propósito.** Sólo 27 de 98 películas tienen Óscar,
   así que `rondaOscar()` sortea primero la respuesta y luego busca película. Sin
   eso, responder "no" siempre acertaría tres de cada cuatro veces.
4. **El "no" de los repartos es una heurística, no un dato.** Sólo tenemos cinco
   actores por película, así que "no coincidieron" se afirma cogiendo un intruso
   cuya filmografía conocida esté entera a `HUECO_SEGURO` años o más de la
   película por la que se pregunta. Reduce mucho el riesgo de afirmar en falso,
   pero no lo elimina: si bajas ese hueco, aumenta.
   - **«Entera» es la palabra importante.** Antes se cogía el reparto de las
     películas lejanas, y bastaba con que el actor tuviera *una* lejana para
     entrar: podía tener además otra del mismo año que la preguntada y aun así
     afirmarse que no coincidieron. Pasaba en el 6 % de los "no". Ahora se
     comprueba película por película (`ANIOS_DE_ACTOR`) y son 0 de 7.000.
5. **La diferencia de edad entre los dos intérpretes no pasa de `EDAD_MAX`
   (22 años).** Sin ese tope salían parejas como Zendaya (1996) contra Ben
   Kingsley (1943): la mediana era de 22 años, **un cuarto de las preguntas
   separaba a los dos por más de 45** y la mayor llegaba a 128. Ahora la mediana
   es de 11 y ninguna pasa de 22.
   - **Ojo con el orden de estas dos reglas:** acercar las edades empuja a elegir
     intrusos de la misma generación, que son justo los que más probabilidades
     tienen de haber coincidido. Al aplicarla sola, los "no" arriesgados pasaron
     del 6 % al 12,5 %. Es el filtro de filmografía entera del punto 4 el que lo
     deja en cero. **Si tocas uno, vuelve a medir el otro.**
   - Si de alguno de los dos no hay fecha, se deja pasar en vez de descartar:
     son muy pocos y quedarse sin pareja es peor que no poder juzgar.
   - Si en un reparto no hay ninguna pareja de quinta parecida —un niño y un
     veterano—, vale la que salga: sin ronda, la burbuja acabaría soltando la
     pregunta de otra categoría.
6. **Las dos películas de 2026 sin datos ampliados** (*Michael*, *The Super Mario
   Galaxy Movie*) sólo aparecen en rondas de taquilla y estreno.

### El tope de saga

**Ninguna saga pasa de dos rondas por partida** (`TOPE_SAGA`, `SAGAS` y
`cabeLaSaga()` en el motor). Vino de un aviso de los jugadores —«salen muchas de
superhéroes»— que al medirlo resultó cierto: **3,1 de las 20 rondas** llevaban
una, el 98 % de las partidas tenía al menos una y una de cada cuatro llegaba a
cuatro o más.

- **No era un fallo del sorteo.** La cuota de apariciones de las 22 de Marvel y
  DC (14,4 %) iba con su peso en el catálogo (12,6 %). Lo que lo amplifica es
  que **las bandas de dificultad aprietan todos los duelos contra el grupo más
  denso del catálogo**, que es el bloque moderno: 67 películas de los 2010, 17
  de ellas de superhéroes. Un duelo de estreno de uno a cinco años casi sólo
  puede caer ahí.
- **El peor sitio era la crítica: el 40,5 % de sus rondas.** Sólo 59 películas
  tienen nota de FilmAffinity y **toda la mitad baja de la escala (4,8–7,5) son
  superhéroes y secuelas**, así que cualquier duelo por debajo del 7,5 era
  Marvel contra Marvel. Sigue siendo la más cargada (28,5 %) porque el tope
  limita la partida entera, no la categoría: **si alguna vez se quiere arreglar
  de raíz, es cuestión de conseguir la nota de las 132 películas que no la
  tienen.**
- **Marvel y DC son una sola saga a propósito.** Separadas, con dos rondas cada
  una, una partida podía sacar cuatro de superhéroes y la queja seguiría en pie:
  quien juega no ve dos universos, ve más de lo mismo. Medido: con las dos
  aparte salían 2,5 rondas; juntas, 2,1.
- **Una ronda que enfrenta a dos de la misma saga cuenta una vez, no dos.** Lo
  que cansa es ver la saga, no cuántas cartas suyas haya en la mesa.
- **Se etiqueta por el título, no por identificador**, para que una secuela nueva
  entre sola al regenerar los datos.
- **El salvavidas de `nuevaRonda()` no mira sagas**: antes una ronda repetida de
  saga que ninguna.
- Medido con 3.000 partidas: superhéroes **3,1 → 2,1** rondas por partida, Marvel
  2,4 → 1,5, la saga más repetida de cada partida 2,7 → 1,9, y **la burbuja
  pulsada sigue soltando siempre la pregunta de su categoría** (0 desajustes en
  60.000 rondas), que es el riesgo de apretar cualquier filtro aquí.

## El azar de la partida

**Hay dos generadores, y no se pueden mezclar.**

- **`azarPartida`** va sembrado (`mulberry32`, semilla de 32 bits) y decide todo
  lo que se pregunta: el reparto de categorías del campo y las veinte rondas con
  sus intrusos y sus respuestas. Lo usan `rnd()`, `pick()`, `coin()`,
  `barajaEnSitio()` y `porPeso()`.
- **`Math.random`** se queda con lo que sólo se ve: dónde cae cada burbuja,
  cuánto deriva, su escala y qué foto lleva de fondo (`pickAdorno()`,
  `imagenPara()`).

**El motivo de la separación es que la partida sea reproducible.** Con la semilla
—y la lista de burbujas que pulsó el jugador, que es su entrada y no azar— se
puede reconstruir la partida entera y comprobar si las respuestas eran las
correctas. Si lo decorativo compartiera el generador sembrado, la secuencia
dependería del tamaño de la pantalla y de qué imágenes hay en disco, y dos
personas con la misma semilla jugarían partidas distintas.

- `siembra(n)` fija la semilla y devuelve la que queda; sin argumento sortea una.
  La llaman `startGame()` —antes de repartir el campo— y `refreshGameToIntro()`.
- `startGame(semilla)` acepta una semilla, que es como se rejuega una partida
  concreta. Sin argumento, partida nueva.
- La semilla en juego vive en `state.semilla`.
- Comprobado: la misma semilla da la misma partida, y **da la misma en un móvil
  de 390 px y en un escritorio de 1280** —donde la rejilla del campo cambia de
  4×5 a 5×4— mientras que las fotos de fondo sí varían.
- **`state.next` no se usa**: no hay generación especulativa de rondas, así que
  el generador sembrado sólo se consume al barajar el campo y al pulsar cada
  burbuja. Si alguna vez se precarga una ronda por adelantado, hay que contar ese
  consumo o la reproducción deja de cuadrar.

## La clasificación global

Al acabar una partida, «Grabar puntuación» pide un nombre y la registra en una
clasificación pública. Vive en Supabase (proyecto `vupsyrunkwsqegdvtcbg`,
**Irlanda**, el mismo `eu-west-1` que el bucket).

- **Es la única excepción a «el sitio no hace ninguna petición externa»**, y sólo
  ocurre **si el jugador pulsa Guardar**. Jugar no habla con ningún servidor. Por
  eso sigue sin hacer falta consentimiento para jugar: el consentimiento es el
  propio botón.
- **El marcador no se envía: se deduce.** El cliente manda la semilla y lo que
  hizo el jugador; los puntos los calcula el servidor rehaciendo la partida. No
  hay ningún número que falsear.
- **La clave que va en el JavaScript es pública por diseño y sólo puede leer.**
  La tabla tiene RLS con una única política de lectura, y los permisos se dan
  columna a columna: `partida` y `huella` no salen de la base de datos. Escribir
  sólo se puede a través de la función.
- **La IP no se guarda**, sólo una huella con la sal `BILLIONS_SAL`, que vive en
  los secretos de la función.
- **La función descarga el motor y los datos del propio sitio** y comprueba su
  huella sha1 contra la que declara la partida (`versionDeDatos()`). Si
  regeneras `movies.js` y despliegas, **las partidas empezadas antes se rechazan
  con un 409** hasta que se juegue una nueva: no se puede rehacer una partida con
  unos datos que ya no están. Es a propósito.
- Probado contra el servidor real: partida legítima aceptada; respuestas de
  100 ms, campo manipulado, partida a medias, datos falseados y falta de alias,
  todas rechazadas con su motivo en castellano.
- **Se consulta en `clasificacion.html`**, a la que se llega desde tres sitios:
  el **icono de podio de la cabecera del juego** (`imgs/podio.svg`, junto al de
  reinicio), el pie de la portada y la pantalla de fin. Es una página autónoma:
  sólo Tailwind y un `fetch`.
  - **Tras guardar se va sola a la clasificación**, con 1,2 s de margen para leer
    la confirmación: es a donde quiere ir quien acaba de registrar su marca.
    Debajo queda un enlace «Ir ahora» por si el salto no llega a producirse.
  - **La tabla es sólo puesto, nombre y puntos.** Las burbujas completadas se
    quitaron: el marcador ya las refleja y en móvil competían por el ancho.
  - **Los nombres se escapan al pintarlos.** Los escribe cualquiera y van a un
    `innerHTML`: sin escapar, el primero que escriba `<img onerror=…>` como alias
    ejecuta código en el navegador de todos los demás.
  - **Al llegar de registrar, la lista no empieza por el número uno: empieza
    donde está el jugador.** Se guarda su identificador (`billions.miPuntuacion`),
    se calcula su **puesto real** y se cargan 60 filas a partir de 20 antes que
    él, con su fila resaltada, un distintivo «Tú» y la caja ya desplazada hasta
    ahí. Desde ese punto puede subir y bajar para ver a los de alrededor.
    - **El puesto se cuenta con los que empatan y llegaron antes**, no sólo con
      los que tienen más puntos: sin esa segunda mitad, dos empatados
      compartirían número y el ancla caería en la fila equivocada.
    - **La tabla tiene su propio desplazamiento vertical** (`max-h-[62vh]`) con
      la cabecera fija. El fondo de esa cabecera va en los `th` y no en el
      `thead`: puesto en el `thead` no lo pintan todos los navegadores y las
      filas se transparentaban al pasar por debajo.
    - **El anclaje se hace sin animación**: la lista tiene que aparecer ya
      colocada, no desplazarse sola delante del jugador.
    - Si la lista no empieza por el primero aparece **«Ver a los primeros»**.
    - Si su entrada ya no existe —borrada— se cae al top sin decir nada.
  - **La tabla se desplaza dentro de su caja** (`overflow-x-auto`): un nombre
    largo no puede empujar la página entera a lo ancho en un móvil.
  - Tres estados probados: con datos, vacía («Sé el primero») y con el servidor
    caído.
- **`privacidad.html` se actualizó antes de encender esto**, como manda la regla
  del proyecto: qué se guarda, base legal, dónde, cuánto y cómo pedir el borrado.

Archivos: [supabase/schema.sql](supabase/schema.sql) (tabla y permisos) y
[supabase/functions/registrar/index.ts](supabase/functions/registrar/index.ts)
(validación). **Se despliegan a mano desde el panel de Supabase**, no con el
workflow: el despliegue de GitHub sólo sube el sitio, y `supabase/` está excluido
del sync.

## El motor, aparte del juego

`motor.js` tiene todo lo que decide **qué se pregunta y cuánto vale**: las reglas
(`VIDAS`, `TIEMPO`, `PUNTOS_MAX`, las bandas de dificultad), el azar sembrado,
los depósitos (`PELIS`, `CON_BSO`…), los generadores de ronda con su tabla
`TIPOS`, `reparteCategorias()` y `puntosPor()`. `main.js` se queda con la
pantalla: pintar, medir, animar, el reloj, el récord y los avisos.

**La regla que sostiene la separación: en `motor.js` no se toca el DOM.** Ni
pintar, ni medir la ventana, ni `localStorage`. Es lo único que permite ejecutar
ese mismo archivo fuera del navegador para rehacer una partida desde su semilla y
comprobar si la puntuación es la que dice ser. Si la validación tuviera su propia
copia de estas reglas, las dos se desincronizarían a la primera y la
clasificación empezaría a rechazar partidas buenas.

- **`juego.vistas`, `juego.ultima` y `juego.sagas` viven en el motor**, no en el
  `state` de main.js: hacen falta para reproducir la partida igual que se jugó.
- **`reiniciaMotor(semilla)`** siembra y olvida lo de la partida anterior.
- **El reparto de categorías es del motor; la posición y la foto de cada burbuja
  no.** `reparteBurbujas()` (main.js) pide las categorías y sólo reparte por la
  pantalla.
- `index.html` carga `motor.js` después de los datos y antes de `main.js`.

Comprobado tras la extracción: la misma semilla da el mismo campo que antes, y
una partida real de cuatro rondas (396 puntos) se revalida fuera del navegador
con el resultado exacto. Manipular el campo se detecta —no sale de esa semilla—;
**los tiempos no**, porque los declara el cliente: falsearlos a 0 ms sube la
puntuación. Contra eso no vale reconstruir, hacen falta reglas de plausibilidad.

## Modo de pruebas

`index.html?debug` enciende un modo para trabajar en la pantalla de fin sin
jugarse veinte rondas cada vez. Aparece un rótulo naranja abajo y se habilitan
dos teclas:

| Tecla | Qué hace |
|---|---|
| `F` | Fin de partida con puntos y burbujas inventados |
| `V` | Victoria, con las 20 burbujas |

- **`?debug=850` fija los puntos** en vez de sortearlos, que es lo cómodo para
  mirar cómo queda una cifra concreta.
- **Lo que produce va marcado como `ficticia`** y **sin `partida`**:
  `fin.html` deshabilita «Grabar puntuación» y lo dice en pantalla. Una partida
  inventada no se puede reproducir y el servidor la rechazaría igualmente, pero
  es mejor decirlo que dejar que alguien se choque con un error que no entiende.
  **Si tocas esto, no dejes que un resultado ficticio llegue a la clasificación.**
- **Los atajos van en `capture` y antes que el resto**: el muro de cookies
  bloquea el teclado del juego, y aquí interesa poder saltar al final aunque no
  se haya decidido todavía. No se roban las teclas si se está escribiendo en un
  campo.
- **Sin `?debug` no existe nada de esto**: ni rótulo, ni teclas, ni oyentes.

## La bitácora de la partida

Cada jugada resuelta se anota en `state.bitacora` (`anota()`), y al acabar la
partida entera viaja dentro de `billions.lastResult` bajo la clave `partida`:

```js
partida: {
  semilla: 2056266588,
  campo: ['actores', 'actores', 'oscarcat', …],   // categoría de cada burbuja
  jugadas: [{ b: 0, r: true, ms: 118 }, …],       // burbuja, respuesta, tiempo
  datos: { 'movies.js': '3f1b4c92', … },          // con qué versión se jugó
}
```

- **`r` a `null` es que se agotó el tiempo**, que no es lo mismo que fallar. En
  las rondas de sí/no es un booleano; en los duelos, el índice de la tarjeta.
- **`b` es el índice de la burbuja, no la categoría.** La categoría se saca del
  campo, y el campo sale de la semilla: guardar las dos cosas permite detectar
  que no cuadran.
- **`datos` es imprescindible para reproducir.** Si se regenera `movies.js`, las
  mismas semillas dejan de dar las mismas rondas. Las huellas ya las pone
  `tools/sella-versiones.py` en cada `<script src>`, así que `versionDeDatos()`
  se limita a leerlas del DOM.
- **El orden de las jugadas es el orden en que se pulsaron las burbujas**, y eso
  no es azar: es lo único que pone el jugador, junto con la respuesta y el
  tiempo. Reproducir la partida es sembrar, repartir el campo y volver a llamar
  a `nuevaRonda()` en ese mismo orden.
- Comprobado con una partida real: sembrando fuera del navegador salen el mismo
  campo, las mismas rondas, las mismas respuestas correctas y **los mismos 396
  puntos** que dio el juego.

## Detalles del juego

- **Contrato de película:** `{ r: puesto, t: título, g: recaudación mundial, y: año }`.
- **La pregunta entra con un fundido de `FADE_MS` (1 s)** y durante ese segundo
  no se puede responder ni corre el reloj: sería injusto descontar tiempo de una
  pregunta que aún no se lee.
- **Los enunciados nombran a las películas y a las personas** (`nom()` los
  resalta), en vez de remitir a las tarjetas con un "esta película".
- **Las burbujas no se recolocan al quedar menos.** El campo se va vaciando y
  los huecos se quedan donde están: recolocar las supervivientes las movería
  bajo el cursor del jugador entre ronda y ronda.
- **Ritmo:** `REVEAL_MS` (2800 ms tras acertar) y `GAMEOVER_MS` (3200 ms tras
  fallar) al principio de `main.js`. Son el tiempo para leer las cifras; se
  tocan a menudo, están como constantes con nombre por eso.
- **Ningún duelo enfrenta cosas muy dispares.** Los tres tipos de duelo tienen
  un tope, y lo que baja con el nivel es ese tope, no un mínimo:
  - **Estrenos: nunca más de `ANIOS_MAX` (5) años de diferencia**, de 5 en el
    nivel 1 a 1 en el 20. Antes iban de 18 a 2 años, con una mediana de 26 y
    máximos de 39: preguntar si se estrenó antes una de 1950 o una de 1995 no
    mide saber de cine. La gracia está en distinguir estrenos próximos.
  - **Crítica: nunca más de `NOTA_MAX` (1,5) puntos**, de 1,5 a 0,2. Antes
    llegaba a 3,6, y el catálogo entero cabe entre el 4,8 y el 9.
  - **Taquilla: como mucho unas 2,9 veces** en el nivel 1 —eso ya lo hacía la
    banda de ratio— bajando a 1,7. Ahí no había nada que arreglar.
  - El mínimo va pegado al máximo (un año menos, o el 55 % de la nota) para que
    un nivel bajo no suelte por sorpresa el duelo más difícil de todos.
  - **El mínimo de años nunca baja de 1**, que es lo que descarta el empate de
    año: un duelo de estreno empatado no tendría respuesta correcta.
  - **La diferencia de notas se redondea a una decimal antes de comparar**: la
    resta de dos notas de una decimal arrastra ruido binario (8,1 − 7,2 da
    0,8999…) y la comparación con la banda fallaba por poco.
  - Comprobado con 100.000 rondas repartidas en 5.000 partidas completas:
    ninguna burbuja se queda sin pregunta de su categoría. **Es el riesgo de
    apretar estas bandas**: si un generador no encuentra pareja, `nuevaRonda()`
    acaba cayendo en `rondaTaquilla()` y el jugador pulsa Estrenos y recibe otra
    cosa. Si estrechas más los márgenes, vuelve a medirlo.
- **Dificultad progresiva (sólo en los duelos, no en los sí/no):** en taquilla la marca lo
  parecidas que son las dos recaudaciones; en estrenos, los años de diferencia
  (`huecoAnios()`, de 5 años a 1). En las de sí/no lo que sube con el nivel es
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
- **Los retratos se encuadran al 25 % de la altura de la foto**, no alineados
  arriba. En un marco ancho y bajo —el de móvil— alinear arriba enseña sólo del
  0 % al 40 % de la foto y corta la cara; al 25 % se ve del 15 % al 55 %, que es
  justo la banda donde cae. En escritorio no cambia nada: ahí no sobra alto.
  Las burbujas de persona van al 28 % por el mismo motivo, agravado por el
  recorte circular.
- **En móvil, las rondas de tres tarjetas** ponen la película sola arriba
  (`col-span-2`) y los dos actores debajo compartiendo fila; de tablet en
  adelante van las tres en línea (`COLS`).
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
- **Cambio de ronda:** `volverAlTablero()` saca las tarjetas (`card-out`,
  `OUT_MS`) y devuelve al campo de burbujas cuando ya no se ven.
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
Spectre): son las auténticas de Wikipedia, y la tarjeta las recorta. **Son las
únicas siete que pueden serlo**: cualquier otra apaisada es un logotipo colado, y
un `sips -g pixelWidth -g pixelHeight posters/*.jpg` lo destapa en un segundo. TMDB usa
siempre el formato vertical.

Las imágenes tienen copyright de sus estudios y están a título ilustrativo, con
la atribución en el pie de página.

## Compositores

Los nombres salen de la columna O («Compositor BSO») de la hoja «Listado
completo», añadida al Excel el 2026-08-25. Las fotos, del mismo script que las
de directores y actores:

```bash
python3 tools/fetch-people.py --role composers --width 300
```

- **La validación de identidad se hace con vocabulario de música** (`COMPOSITOR`),
  por el mismo motivo que a un director se le exige que su artículo hable de
  dirigir: hay homónimos de sobra. `score` a secas no vale —lo dice cualquier
  artículo con una cifra—, así que va pegado a `film`/`soundtrack`.
- **19 de 96 no tienen foto y no la van a tener por esta vía**: su artículo en la
  Wikipedia inglesa no lleva ninguna imagen. Comprobado uno a uno con la API
  (Carter Burwell, Henry Jackman, Steve Jablonsky, Mark Mancina, Wendy Carlos,
  Pinar Toprak…). Como en las demás categorías, quien no tiene cara se queda
  fuera: son 157 películas jugables de 180 con compositor.
- **`fetch-people.py` ya localiza la hoja por su nombre** y no por `sheet3.xml`.
  Leía el archivo a ciegas, y la hoja de este proyecto ya se ha reordenado una
  vez.

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
- **La búsqueda de reserva se quedaba con otra persona.** `desambigua()` daba por
  bueno el primer resultado que hablara de cine, sin comprobar el nombre:
  **26 de los 40 actores desambiguados tenían la cara de otro** — Daniel Richter
  salía con la de Andy Richter, Jack Benny con la de Jack Nance, Peter Appel con
  la de Andrea Riseborough. Ahora `mismo_nombre()` exige que el título del
  artículo contenga todas las palabras del nombre pedido, con `ALIAS_OK` para las
  siete excepciones comprobadas a mano (los tres dúos y el seudónimo Jiaozi).
- **Y el oficio no puede ser el único filtro, porque deja fuera a los que no son
  «actores» de oficio.** Jack Benny era *entertainer*, Chester Conklin *comedian*
  y John Legend *singer*: `INTERPRETE` no los reconocía y por eso caían en la
  búsqueda de reserva, que es donde se torcían. `repara-personas.py` verifica la
  identidad **con la película en la que sale cada uno**: si el artículo nombra
  una de sus películas del catálogo, no hay duda. Es la prueba fuerte; el oficio
  queda como la débil.
- **El respaldo de «coge la primera imagen del artículo» agarra carteles.** A
  Sebastian Hansen le tocó el de *A Minecraft Movie*. Se exige que el nombre del
  archivo lleve el de la persona.
- **Quien no se pueda identificar con certeza se queda sin foto y fuera del
  juego.** De los 26, se recuperaron 4 con la cara correcta y 22 se quedaron sin
  ella: comprobado artículo por artículo que **no tienen ninguna imagen**, sólo
  iconos. Antes que enseñar a otro, mejor no enseñar a nadie.
- **A un director hay que exigirle que el artículo hable de DIRIGIR.** `CINE`
  admitía antes `films`, `movie`, `cinema` y —lo peor— `actor`, palabras que
  cumple cualquiera del gremio. Por eso **Steve McQueen** se resolvía en el actor
  de *Bullitt* (1930-1980) en vez de en el director británico de *12 Years a
  Slave*: son dos personas distintas, el artículo a secas es el del actor, y como
  decía "actor" la validación lo daba por bueno y nunca llegaba a probar con
  `(director)`. Quien dirige y actúa —Eastwood, Chaplin— sigue pasando, porque su
  artículo dice las dos cosas.
- **La fecha de muerte destapa homónimos, y por eso se descarga.** Si alguien
  figura en una película rodada después de morir, la identidad es de otro. Es lo
  que habría cazado a Steve McQueen sin esperar a que se notara a simple vista.
  El contraste de los 1.149 créditos contra nacimiento y muerte dejó 9 imposibles:
  6 identidades equivocadas y **3 muertes reales durante el rodaje** —Paul Walker
  en *Furious 7*, Carrie Fisher en *The Last Jedi* y Oliver Reed en *Gladiator*—,
  que son ciertas y hay que dejar en paz. Lo mismo con los cuatro actores
  infantiles (Drew Barrymore con 7 años en *E.T.*).
- **Los años de nacimiento salen de Wikidata (P569), no del texto del artículo**:
  vienen como dato y no hay que adivinarlos de una frase. Se entra por el título
  del artículo inglés; ocho nombres no cuadran por acentuación (*Zoe Saldana*
  contra *Zoë Saldaña*, *Charles Chaplin* contra *Charlie Chaplin*) y para ésos
  hay una segunda pasada que le pide a Wikipedia el identificador, porque ella sí
  normaliza acentos y sigue redirecciones. Cobertura: 635 de 635.
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

## Sonido

**El juego no lleva sonido.** Ni música ni efectos: se quitaron a petición de
Miguel (2026-08-22) y sus archivos se borraron. Si vuelve a hacer falta, el
patrón que funcionaba era `<audio preload="auto">` por efecto y un `play()` con
`catch`, porque el navegador lo bloquea hasta que el usuario interactúa.

## Páginas de error

`404.html` y `500.html` se dibujan con el lenguaje de la portada: vista completa,
esferas a la deriva por detrás, el fondo bokeh con sus tres luces y el número del
error en la tipografía de titulares. Cosas que no hay que romper:

- **Sus esferas son de degradado puro, sin fotos.** La portada las pinta con una
  carátula o un retrato debajo, pero eso obliga a cargar `movies.js`,
  `posters.js` y compañía, y una página de error tiene que pintarse sola y
  cuanto antes. La rampa es la misma de las nueve categorías, así que se
  reconocen como piezas del juego aunque no lleven imagen.
- **La deriva es la del campo**: dos ejes con periodos distintos, un nivel del
  DOM por eje, y el diámetro medido del contenedor (por eso repintan al cambiar
  el tamaño de la ventana).
- **Los bloques con `max-w-*` llevan `w-full`**, como en la portada: sin él, un
  `max-w-md` dentro de un flex column toma su ancho de contenido.
- El pie va en un `<footer>` absoluto, fuera del flujo del `<main>`: dentro, su
  `mt-auto` se comía el centrado y empujaba el número contra el borde de arriba.

Y las dos de siempre:

- **Sus rutas son absolutas** (`/vendor/tailwind.js`, `/imgs/bg_game.webp`).
  CloudFront las sirve para cualquier URL que falle, y con rutas relativas el
  navegador buscaría el CSS colgando de la carpeta inventada que se pidió.
- **Se mapean 403 y 404 al mismo `/404.html`.** Con OAC el bucket no da permiso
  de listado, así que un objeto que no existe se responde como **403**, no como
  404: sin el mapeo del 403 la página de error no llegaría a verse nunca.
- **Se configuran a mano en la consola de CloudFront**, no desde el workflow.
  Se intentó automatizarlo y falló: `billions-deploy` sólo tiene
  `cloudfront:CreateInvalidation`, y darle `UpdateDistribution` —que deja
  reescribir la distribución entera— no compensa para algo que se hace una vez.
  Peor aún, el paso iba antes de la invalidación y al fallar la saltaba, así que
  se llevaba por delante el resto del despliegue. Los pasos están en
  INFRAESTRUCTURA.md.

## Publicar

**"Publicar" aquí significa desplegar, no crear un Artifact.**

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) → bucket
`billions-cine` (eu-west-1) + invalidación de CloudFront `EJYIWS894T0ZX`.
En producción: **https://ganoyo.com**

Los detalles de la infraestructura y lo que queda pendiente están en
[INFRAESTRUCTURA.md](INFRAESTRUCTURA.md).

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
