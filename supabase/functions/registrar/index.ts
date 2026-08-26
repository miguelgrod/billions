// ---------------------------------------------------------------------------
// El verificador: rehace una partida con las mismas reglas que la jugaron y dice
// cuánto valió de verdad. Va primero y no toca HTTP ni Deno, para poder probarlo
// fuera de la nube contra partidas reales.
// ---------------------------------------------------------------------------

// El orden importa: el motor necesita los datos ya declarados.
const ARCHIVOS = [
  'movies.js', 'posters.js', 'directors.js', 'actors.js',
  'composers.js', 'actores.js', 'nacimientos.js', 'motor.js',
];

// Reglas del juego que esta función necesita conocer por su cuenta.
const BURBUJAS = 20;
const VIDAS = 3;
const TIEMPO = 10000;
// Por debajo de esto no hay reflejos humanos: leer la pregunta, decidir y pulsar
// no baja de un cuarto de segundo. Las pruebas automatizadas del proyecto
// responden en 115-120 ms, que es justo lo que este límite descarta.
const MS_MINIMO = 250;

// La misma huella que pone tools/sella-versiones.py: sha1 del contenido, 8 hex.
async function huella(bytes: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

type Motor = {
  reiniciaMotor: (s: number) => number;
  reparteCategorias: () => string[];
  nuevaRonda: (nivel: number, cat: string) => { correcta: unknown; tipo: string } | null;
  puntosPor: (ms: number, multiplicador?: number) => number;
  // Dos burbujas de las veinte puntúan el doble, y cuáles son sale de la misma
  // semilla. Va opcional a propósito: así esta función sigue valiendo para un
  // motor anterior a las doradas, que simplemente no las tiene.
  multiplicadorDe?: (b: number) => number;
};

// Un isolate atiende muchas peticiones seguidas: se guarda el motor ya montado y
// la versión con la que se montó, para no bajar 158 KB en cada llamada.
let cache: { clave: string; motor: Motor } | null = null;

async function montaMotor(
  declarados: Record<string, string>,
  sitio: string,
): Promise<Motor> {
  const clave = ARCHIVOS.map((f) => `${f}:${declarados[f] ?? ''}`).join('|');
  if (cache && cache.clave === clave) return cache.motor;

  const fuentes: string[] = [];
  for (const archivo of ARCHIVOS) {
    const esperada = declarados[archivo];
    if (!esperada) throw new Error(`la partida no dice con qué ${archivo} se jugó`);
    const res = await fetch(`${sitio}/${archivo}`, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error(`no se pudo leer ${archivo} del sitio`);
    const bytes = await res.arrayBuffer();
    const real = await huella(bytes);
    // Si no coinciden, la partida se jugó con unos datos que ya no están: no se
    // puede rehacer, y dar por buena una puntuación sin comprobarla es
    // justamente lo que esta función existe para no hacer.
    if (real !== esperada) {
      throw new Error(`${archivo} ha cambiado desde que se jugó (${esperada} → ${real})`);
    }
    fuentes.push(new TextDecoder().decode(bytes));
  }

  const codigo = fuentes.join('\n;\n') +
    '\n;\nreturn { reiniciaMotor, reparteCategorias, nuevaRonda, puntosPor,' +
    "\n  multiplicadorDe: typeof multiplicadorDe === 'function' ? multiplicadorDe : undefined };";
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
  // Una burbuja fallada NO sale del campo, así que una partida tiene más
  // jugadas que burbujas: veinte aciertos más los dos fallos que se perdonan,
  // o diecinueve aciertos y los tres que la acaban. El techo real es 22, y con
  // el tope puesto en 20 se rechazaba cualquier victoria con un solo fallo
  // —un tercio largo de las partidas— con un «demasiadas jugadas» que no había
  // manera de entender desde fuera.
  if (!Array.isArray(jugadas) || jugadas.length > BURBUJAS + VIDAS - 1) {
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
    // Una burbuja acertada sale del campo; una fallada sigue ahí. Repetir una ya
    // reventada es imposible jugando.
    if (usadas.has(j.b)) return { ok: false, motivo: 'burbuja repetida' };
    if (!Number.isInteger(j?.ms) || j.ms < 0 || j.ms > TIEMPO) {
      return { ok: false, motivo: 'tiempo de respuesta imposible' };
    }
    if (vidas <= 0) return { ok: false, motivo: 'la partida ya había terminado' };

    const ronda = motor.nuevaRonda(aciertos + 1, campo[j.b]);
    if (!ronda) return { ok: false, motivo: 'no se pudo rehacer la ronda' };

    const agotado = j.r === null;
    if (!agotado && j.ms < MS_MINIMO) {
      return { ok: false, motivo: 'respuesta más rápida de lo humanamente posible' };
    }

    if (!agotado && j.r === ronda.correcta) {
      aciertos++;
      usadas.add(j.b);
      // El multiplicador de la burbuja dorada sale del motor, no de lo que
      // diga el cliente: es la misma semilla y el mismo reparto.
      puntos += motor.puntosPor(j.ms, motor.multiplicadorDe ? motor.multiplicadorDe(j.b) : 1);
    } else {
      vidas--;
    }
  }

  // La partida sólo se registra acabada: o se quedó sin vidas o vació el campo.
  if (vidas > 0 && aciertos < BURBUJAS) {
    return { ok: false, motivo: 'la partida no ha terminado' };
  }
  return { ok: true, puntos, burbujas: aciertos };
}


// Billions · registrar una puntuación en la clasificación global
//
// Nadie escribe en la tabla desde el navegador: la clave pública sólo puede
// leer. Esta función es la única vía, y antes de guardar nada REHACE LA PARTIDA
// con las mismas reglas que la jugaron y comprueba que la puntuación es la que
// dice ser. Sin esto, la clasificación duraría lo que tarde alguien en abrir la
// consola del navegador.
//
// El motor y los datos no van dentro de esta función a propósito: se descargan
// del propio sitio y se comprueba su huella contra la que declara la partida.
// Llevar una copia aquí obligaría a redesplegar la función cada vez que se
// regenera `movies.js`, y el día que a alguien se le olvidara, la clasificación
// empezaría a rechazar todas las partidas sin que nadie supiera por qué.

const SITIO = globalThis.Deno?.env.get('BILLIONS_SITIO') ?? 'https://ganoyo.com';

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
  const sal = globalThis.Deno?.env.get('BILLIONS_SAL') ?? '';
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
      burbujas: veredicto.burbujas,
      partida: cuerpo.partida,
      huella: marca,
    }),
  });

  if (!res.ok) {
    return responde({ error: 'no se pudo guardar', detalle: await res.text() }, 500);
  }
  const [fila] = await res.json();
  return responde({ ok: true, id: fila.id, puntos: fila.puntos, burbujas: fila.burbujas });
}

// En la nube esto levanta el servidor; importado desde Node no hace nada, que es
// lo que permite probar el verificador sin desplegar.
if (typeof (globalThis as any).Deno !== 'undefined') (globalThis as any).Deno.serve(atiende);

export { atiende, montaMotor, revalida, huella };
