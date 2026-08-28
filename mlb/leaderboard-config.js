// Dónde vive la clasificación. Está aparte a propósito: las dos páginas que la
// usan —end.html y leaderboard.html— tienen que apuntar al mismo sitio, y con
// la dirección repetida en cada una se acaba cambiando sólo una.
//
// **Perfect Nine todavía no tiene servidor.** Con `url` vacía, la página de fin
// apaga el botón de guardar y la clasificación explica que aún no está abierta,
// en vez de soltar un error de red. Para encenderla hay que crear el proyecto
// de Supabase y rellenar estas dos líneas: los pasos están en
// supabase/README.md.
//
// La clave que va aquí es pública por diseño y sólo puede LEER: escribir exige
// pasar por la función, que rehace la partida antes de aceptarla.
const LEADERBOARD = {
  url: '',
  key: '',
};
