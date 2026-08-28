# La clasificación de Perfect Nine

**Encendida el 2026-08-29.** Proyecto `umuzzbcmcwhcdbbfobms`, en **Irlanda**
(el mismo `eu-west-1` que el bucket). Si alguna vez se vacía la `url` de
`leaderboard-config.js`, las dos páginas se apagan solas con un mensaje en vez
de soltar un error de red.

Probado contra el servidor real el día que se encendió: partida legítima
aceptada con los puntos exactos (1.271, los mismos que calculó el motor), y
rechazadas la del campo manipulado (422), la de burbuja repetida (422), la de
respuestas de 100 ms (422), la partida a medias (422), la de datos falseados
(409), la de jugadas de más (422) y la que va sin alias (400). Comprobado
también que con la clave pública **no** se puede insertar en la tabla ni leer
las columnas `partida` y `huella` (401 en los tres casos).

**Es un proyecto aparte del de Billions.** Los dos juegos no comparten
infraestructura: si este necesita base de datos, se le monta la suya.

## Cómo se montó, por si hay que rehacerlo

1. Crear un proyecto de Supabase **en Irlanda (eu-west-1)**, el mismo sitio que
   el bucket, y ejecutar `schema.sql` en su SQL Editor.
2. Desplegar la función `registrar` desde el panel (Edge Functions → Deploy),
   pegando `functions/registrar/index.ts`. **Se despliega a mano**, como la de
   Billions: el workflow de GitHub sólo sube el sitio y `supabase/` está
   excluido del sync.
3. Ponerle dos secretos a la función:
   - `PN_SITIO` = `https://ganoyo.com/mlb` (de dónde se descarga el motor).
   - `PN_SAL` = una cadena larga al azar, la sal de la huella de IP.
4. Rellenar `leaderboard-config.js` con la URL del proyecto y su clave
   **publicable** (la que sólo puede leer).
5. **Actualizar `privacy.html` ANTES de desplegar nada de esto**: hoy dice que
   el juego no envía nada a ningún sitio, y con la clasificación encendida eso
   deja de ser cierto para quien pulse Guardar.

## Por qué el marcador no se envía

El cliente manda la semilla y lo que hizo el jugador; **los puntos los calcula
el servidor rehaciendo la partida**. No hay ningún número que falsear.

- La función **descarga el motor y los datos del propio sitio** y comprueba su
  huella sha1 contra la que declara la partida. Si se regeneran los datos y se
  despliegan, las partidas empezadas antes se rechazan con un 409 hasta que se
  juegue una nueva: no se puede rehacer una partida con unos datos que ya no
  están. Es a propósito.
- Llevar una copia del motor dentro de la función obligaría a redesplegarla
  cada vez que se regenera `mlb-data.js`, y el día que se olvidara, la
  clasificación empezaría a rechazar todas las partidas sin que nadie supiera
  por qué.
- **Cada pulsación gasta una burbuja**, así que una partida no puede tener más
  de 20 jugadas ni repetir burbuja. Sin lo segundo, un cliente manipulado podría
  repetir burbujas y colar rondas de más, que son puntos de más.
- **Los tiempos los declara el cliente y no se pueden reconstruir.** Contra eso
  sólo hay reglas de plausibilidad: por debajo de `MS_MINIMO` (250 ms) no hay
  reflejos humanos.
