-- Billions · clasificación global
--
-- Ejecutar en el SQL Editor del proyecto. Es idempotente: se puede volver a
-- lanzar entero sin romper nada.
--
-- La idea de fondo: la tabla guarda la partida completa además del marcador,
-- para poder rehacerla y comprobar que la puntuación es la que dice ser. Nadie
-- escribe aquí desde el navegador; la única vía será el servidor.

create table if not exists public.puntuaciones (
  id          uuid        primary key default gen_random_uuid(),
  creado_en   timestamptz not null    default now(),
  alias       text        not null,
  puntos      integer     not null,
  burbujas    smallint    not null,
  -- La partida en crudo: semilla, campo, jugadas y versión de los datos. Es lo
  -- que permite revalidar más tarde, incluso una puntuación ya guardada.
  partida     jsonb       not null,
  -- La IP no se guarda: sólo una huella con sal, que sirve para frenar abusos
  -- y no para identificar a nadie.
  huella      text
);

-- Límites en la propia tabla, que es donde no se olvidan. El máximo posible son
-- 20 burbujas a 100 puntos; se deja algo de margen por si cambian las reglas.
alter table public.puntuaciones drop constraint if exists puntuaciones_sensatas;
alter table public.puntuaciones add constraint puntuaciones_sensatas check (
  char_length(alias) between 1 and 20
  and puntos   between 0 and 2500
  and burbujas between 0 and 100
);

-- La clasificación se lee ordenada por puntos dentro de un periodo.
create index if not exists puntuaciones_ranking
  on public.puntuaciones (creado_en desc, puntos desc);

-- ---------------------------------------------------------------------------
-- Permisos
--
-- RLS activo y una sola política, de lectura. No hay política de escritura, así
-- que con la clave pública NO se puede insertar: aunque alguien la saque del
-- JavaScript —y va a poder, es pública por diseño—, no puede meter una
-- puntuación inventada.
-- ---------------------------------------------------------------------------
alter table public.puntuaciones enable row level security;

drop policy if exists "clasificación visible" on public.puntuaciones;
create policy "clasificación visible"
  on public.puntuaciones for select
  to anon, authenticated
  using (true);

-- Y el permiso se da columna a columna: `partida` y `huella` no salen de aquí.
-- RLS filtra filas, no columnas; esto es lo que esconde las columnas.
revoke all on public.puntuaciones from anon, authenticated;
grant select (id, creado_en, alias, puntos, burbujas)
  on public.puntuaciones to anon, authenticated;
