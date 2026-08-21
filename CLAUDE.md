# Billions — juego de taquilla

Quiz web: se enfrentan dos películas y hay que acertar cuál recaudó más en todo
el mundo. Se encadenan niveles hasta el primer fallo. En producción:
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
| `movies.js` | `const MOVIES` — generado desde el Excel, **no editar a mano** |
| `posters.js` | `const POSTERS` — puesto → nombre de archivo en `posters/` |
| `posters/*.jpg` | 100 carátulas, 300 px de ancho |
| `posters/_report.json` | Caché de resolución del descargador (qué página y qué archivo de Wikipedia usó cada película) |
| `tools/fetch-posters.py` | Descarga las carátulas. Dos fuentes: Wikipedia (sin clave) o TMDB (con clave) |
| `tools/build-artifact.py` | Empaqueta todo en un HTML autocontenido en `build/` |
| `top_100_...xlsx` | Datos de origen |

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

## Detalles del juego

- **Contrato de película:** `{ r: puesto, t: título, g: recaudación mundial, y: año }`.
- **Ritmo:** `REVEAL_MS` (2800 ms tras acertar) y `GAMEOVER_MS` (3200 ms tras
  fallar) al principio de `main.js`. Son el tiempo para leer las cifras; se
  tocan a menudo, están como constantes con nombre por eso.
- **Parejas:** aleatorias, nunca la misma dos rondas seguidas (`state.lastPairKey`).
  La pareja siguiente se sortea y se precarga durante la ronda actual
  (`state.next`), para que no parpadee al pasar de nivel.
- **Avisos:** un único elemento `#toast` superpuesto al tablero, con estilo por
  tipo en `TOAST_STYLES` (`ok` / `fail`). Se oculta solo con la animación CSS;
  no hay temporizador. Para añadir un tipo basta una entrada más en la tabla.
- **Teclado:** `←`/`1` y `→`/`2` eligen; `Enter` o espacio arranca y reinicia.
- **Récord:** `localStorage`, clave `billions.best`, siempre entre `try/catch`
  (modo privado del navegador).
- Los bordes de las tarjetas son de 4 px **siempre**, y solo cambia el color
  entre reposo, hover, acierto y fallo. Si cambias el grosor por estado, el
  contenido se desplaza.

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
