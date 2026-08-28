// Dónde vive la clasificación. Está aparte a propósito: las dos páginas que la
// usan —end.html y leaderboard.html— tienen que apuntar al mismo sitio, y con
// la dirección repetida en cada una se acaba cambiando sólo una.
//
// Encendida el 2026-08-29. Si alguna vez se vacía `url`, las dos páginas se
// apagan solas con un mensaje en vez de soltar un error de red: la página de
// fin desactiva el botón de guardar y la clasificación dice que aún no está
// abierta.
//
// La clave es pública por diseño y sólo puede LEER: la tabla tiene RLS con una
// única política de lectura y los permisos se dan columna a columna, así que
// `partida` y `huella` no salen de la base de datos. Escribir exige pasar por
// la función, que rehace la partida antes de aceptarla.
const LEADERBOARD = {
  url: 'https://umuzzbcmcwhcdbbfobms.supabase.co',
  key: 'sb_publishable_YNDLmL9HHOWuiRKehtI4oA_5D7RRMjD',
};
