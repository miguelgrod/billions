// Billions · el verificador
//
// Rehace una partida con las mismas reglas que la jugaron y dice cuánto valió de
// verdad. Vive aparte de index.ts porque aquí no hay HTTP ni nada de Deno: es
// lógica pura, y eso permite probarla fuera de la nube contra partidas reales.

// El orden importa: el motor necesita los datos ya declarados.
export const ARCHIVOS = [
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
export async function huella(bytes: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

export type Motor = {
  reiniciaMotor: (s: number) => number;
  reparteCategorias: () => string[];
  nuevaRonda: (nivel: number, cat: string) => { correcta: unknown; tipo: string } | null;
  puntosPor: (ms: number) => number;
};

// Un isolate atiende muchas peticiones seguidas: se guarda el motor ya montado y
// la versión con la que se montó, para no bajar 158 KB en cada llamada.
let cache: { clave: string; motor: Motor } | null = null;

export async function montaMotor(
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
    '\n;\nreturn { reiniciaMotor, reparteCategorias, nuevaRonda, puntosPor };';
  const motor = new Function(codigo)() as Motor;
  cache = { clave, motor };
  return motor;
}

// Rehace la partida y devuelve lo que de verdad valió.
export function revalida(motor: Motor, partida: any) {
  const { semilla, campo, jugadas } = partida;

  if (!Number.isInteger(semilla) || semilla < 0 || semilla > 0xFFFFFFFF) {
    return { ok: false, motivo: 'semilla fuera de rango' };
  }
  if (!Array.isArray(campo) || campo.length !== BURBUJAS) {
    return { ok: false, motivo: 'el campo no tiene 20 burbujas' };
  }
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
      puntos += motor.puntosPor(j.ms);
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

