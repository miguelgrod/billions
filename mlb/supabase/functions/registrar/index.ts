// ---------------------------------------------------------------------------
// El verificador: rehace una partida de Perfect Nine con las mismas reglas que
// la jugaron y dice cuánto valió de verdad. Va primero y no toca HTTP ni Deno,
// para poder probarlo fuera de la nube contra partidas reales.
// ---------------------------------------------------------------------------

// El orden importa: el motor necesita los datos ya declarados. La clave es el
// nombre de archivo tal y como lo anota `versionDeDatos()` en el navegador,
// que lo saca del <script src> sin la ruta.
const ARCHIVOS = [
  { clave: 'mlb-data.js', ruta: 'data/mlb-data.js' },
  { clave: 'motor.js', ruta: 'motor.js' },
];

// Reglas del juego que esta función necesita conocer por su cuenta.
const BURBUJAS = 20;
const VIDAS = 3;
const TIEMPO = 12000;
// Por debajo de esto no hay reflejos humanos: leer la pregunta, decidir y
// pulsar no baja de un cuarto de segundo.
const MS_MINIMO = 250;

// La misma huella que pone tools/sella-versiones.py: sha1 del contenido, 8 hex.
async function huella(bytes: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

type Ronda = { correcta: unknown; tipo: string; opciones: { id: unknown }[] };
type Motor = {
  reiniciaMotor: (s: number) => number;
  reparteCategorias: () => string[];
  nuevaRonda: (clave: string, nivel: number) => Ronda | null;
  puntosPor: (ms: number) => number;
};

// Un isolate atiende muchas peticiones seguidas: se guarda el motor ya montado
// y la versión con la que se montó, para no bajar los datos en cada llamada.
let cache: { clave: string; motor: Motor } | null = null;

async function montaMotor(
  declarados: Record<string, string>,
  sitio: string,
): Promise<Motor> {
  const clave = ARCHIVOS.map((a) => `${a.clave}:${declarados[a.clave] ?? ''}`).join('|');
  if (cache && cache.clave === clave) return cache.motor;

  const fuentes: string[] = [];
  for (const { clave: nombre, ruta } of ARCHIVOS) {
    const esperada = declarados[nombre];
    if (!esperada) throw new Error(`la partida no dice con qué ${nombre} se jugó`);
    const res = await fetch(`${sitio}/${ruta}`, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error(`no se pudo leer ${ruta} del sitio`);
    const bytes = await res.arrayBuffer();
    const real = await huella(bytes);
    // Si no coinciden, la partida se jugó con unos datos que ya no están: no se
    // puede rehacer, y dar por buena una puntuación sin comprobarla es
    // justamente lo que esta función existe para no hacer.
    if (real !== esperada) {
      throw new Error(`${nombre} ha cambiado desde que se jugó (${esperada} → ${real})`);
    }
    fuentes.push(new TextDecoder().decode(bytes));
  }

  const codigo = fuentes.join('\n;\n') +
    '\n;\nreturn { reiniciaMotor, reparteCategorias, nuevaRonda, puntosPor };';
  const motor = new Function(codigo)() as Motor;
  cache = { clave, motor };
  return motor;
}

// Rehace la partida y devuelve lo que de verdad valió.
function revalida(motor: Motor, partida: any) {
  const { semilla, campo, jugadas } = partida;

  if (!Number.isInteger(semilla) || semilla < 0 || semilla > 0xFFFFFFFF) {
    return { ok: false, motivo: 'semilla fuera de rango' };
  }
  if (!Array.isArray(campo) || campo.length !== BURBUJAS) {
    return { ok: false, motivo: 'el campo no tiene 20 burbujas' };
  }
  // Cada pulsación gasta una burbuja, se acierte o se falle, así que una
  // partida no puede tener más jugadas que burbujas hay en el campo.
  if (!Array.isArray(jugadas) || jugadas.length > BURBUJAS) {
    return { ok: false, motivo: 'demasiadas jugadas' };
  }

  motor.reiniciaMotor(semilla);
  const reparto = motor.reparteCategorias();
  if (reparto.join(',') !== campo.join(',')) {
    return { ok: false, motivo: 'el campo no sale de esa semilla' };
  }

  let puntos = 0, aciertos = 0, vidas = VIDAS;
  const usadas = new Set<number>();

  for (const j of jugadas) {
    if (!Number.isInteger(j?.b) || j.b < 0 || j.b >= BURBUJAS) {
      return { ok: false, motivo: 'jugada con burbuja inexistente' };
    }
    // Acertada o fallada, la burbuja sale del campo: repetir una ya jugada es
    // imposible jugando, y admitirlo dejaría colar rondas de más —que son
    // puntos de más— a quien tocara el cliente.
    if (usadas.has(j.b)) return { ok: false, motivo: 'burbuja repetida' };
    usadas.add(j.b);
    if (!Number.isInteger(j?.ms) || j.ms < 0 || j.ms > TIEMPO) {
      return { ok: false, motivo: 'tiempo de respuesta imposible' };
    }
    if (vidas <= 0) return { ok: false, motivo: 'la partida ya había terminado' };

    // El nivel es el número de aciertos que llevaba: la misma cuenta que hace
    // el juego, y de ella dependen las bandas de dificultad.
    const ronda = motor.nuevaRonda(campo[j.b], aciertos + 1);
    if (!ronda) return { ok: false, motivo: 'no se pudo rehacer la ronda' };

    const agotado = j.r === null;
    if (!agotado) {
      if (!Number.isInteger(j.r) || j.r < 0 || j.r >= ronda.opciones.length) {
        return { ok: false, motivo: 'respuesta que no existe en esa ronda' };
      }
      if (j.ms < MS_MINIMO) {
        return { ok: false, motivo: 'respuesta más rápida de lo humanamente posible' };
      }
    }

    // La jugada guarda el índice de la opción pulsada, no su identificador: el
    // orden de las opciones lo baraja el azar sembrado, así que al rehacer la
    // ronda vuelve a salir el mismo.
    if (!agotado && ronda.opciones[j.r].id === ronda.correcta) {
      aciertos++;
      puntos += motor.puntosPor(j.ms);
    } else {
      vidas--;
    }
  }

  // La partida sólo se registra acabada: o se quedó sin vidas o vació el campo.
  // Vaciar el campo no significa acertar las veinte, porque la fallada también
  // se gasta: se puede terminar con dieciocho aciertos y dos fallos.
  if (vidas > 0 && jugadas.length < BURBUJAS) {
    return { ok: false, motivo: 'la partida no ha terminado' };
  }
  return { ok: true, puntos, aciertos };
}


// Perfect Nine · registrar una puntuación en la clasificación global
//
// Nadie escribe en la tabla desde el navegador: la clave pública sólo puede
// leer. Esta función es la única vía, y antes de guardar nada REHACE LA PARTIDA
// con las mismas reglas que la jugaron y comprueba que la puntuación es la que
// dice ser. Sin esto, la clasificación duraría lo que tarde alguien en abrir la
// consola del navegador.

const SITIO = globalThis.Deno?.env.get('PN_SITIO') ?? 'https://ganoyo.com/mlb';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const limpiaAlias = (s: unknown) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 20) : '';

async function atiende(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('método no admitido', { status: 405, headers: CORS });
  }

  const responde = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  let cuerpo: any;
  try {
    cuerpo = await req.json();
  } catch {
    return responde({ error: 'el cuerpo no es JSON' }, 400);
  }

  const alias = limpiaAlias(cuerpo?.alias);
  if (!alias) return responde({ error: 'hace falta un alias' }, 400);
  if (!cuerpo?.partida?.datos) return responde({ error: 'falta la partida' }, 400);

  let motor: Motor;
  try {
    motor = await montaMotor(cuerpo.partida.datos, SITIO);
  } catch (e) {
    return responde({ error: String(e instanceof Error ? e.message : e) }, 409);
  }

  const veredicto = revalida(motor, cuerpo.partida);
  if (!veredicto.ok) return responde({ error: veredicto.motivo }, 422);

  // La IP no se guarda: sólo una huella con sal, que sirve para frenar abusos y
  // no para identificar a nadie. Sin la sal —que vive en el servidor— no se
  // puede volver atrás desde el hash a la dirección.
  const sal = globalThis.Deno?.env.get('PN_SAL') ?? '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const marca = ip ? await huella(new TextEncoder().encode(sal + ip)) : null;

  const res = await fetch(`${globalThis.Deno?.env.get('SUPABASE_URL')}/rest/v1/puntuaciones`, {
    method: 'POST',
    headers: {
      apikey: globalThis.Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      Authorization: `Bearer ${globalThis.Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      alias,
      puntos: veredicto.puntos,
      aciertos: veredicto.aciertos,
      partida: cuerpo.partida,
      huella: marca,
    }),
  });

  if (!res.ok) {
    return responde({ error: 'no se pudo guardar', detalle: await res.text() }, 500);
  }
  const [fila] = await res.json();
  return responde({ ok: true, id: fila.id, puntos: fila.puntos, aciertos: fila.aciertos });
}

// En la nube esto levanta el servidor; importado desde Node no hace nada, que
// es lo que permite probar el verificador sin desplegar.
if (typeof (globalThis as any).Deno !== 'undefined') (globalThis as any).Deno.serve(atiende);

export { atiende, montaMotor, revalida, huella };
