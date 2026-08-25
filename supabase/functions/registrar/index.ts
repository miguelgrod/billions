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

import { huella, montaMotor, revalida, type Motor } from './verificador.ts';

const SITIO = Deno.env.get('BILLIONS_SITIO') ?? 'https://ganoyo.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const limpiaAlias = (s: unknown) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 20) : '';

Deno.serve(async (req) => {
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
  const sal = Deno.env.get('BILLIONS_SAL') ?? '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const marca = ip ? await huella(new TextEncoder().encode(sal + ip)) : null;

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/puntuaciones`, {
    method: 'POST',
    headers: {
      apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
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
});
