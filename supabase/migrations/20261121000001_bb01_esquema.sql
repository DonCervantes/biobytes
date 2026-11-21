-- ===== Extensiones =====
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ===== Normalización (inmutable para poder indexar) =====
create or replace function public.norm(t text) returns text
language sql immutable set search_path = public, extensions as $$
  select trim(regexp_replace(
           regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t,''))),
                          '[^a-z0-9 ]', '', 'g'),
           '\s+', ' ', 'g'))
$$;

-- ===== Tipos =====
create type rol as enum ('captura','medico','coordinacion','admin','auditor');
create type servicio as enum ('papanicolaou','ultrasonido_mama','exploracion_mama','valoracion_nutricional','mastografia');
create type origen as enum ('en_linea','sin_conexion');

-- ===== Tablas =====
create table perfiles (
  user_id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  rol rol not null,
  activo boolean not null default true
);

create table sedes (
  id serial primary key,
  nombre text not null,
  municipio text not null,
  localidad text,
  estado text not null default 'Jalisco'
);

create sequence folio_seq start 900104;

create table pacientes (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null default 'EIRA-' || lpad(nextval('folio_seq')::text, 6, '0'),
  nombre text not null check (char_length(nombre) between 1 and 100),
  apellido_paterno text not null check (char_length(apellido_paterno) between 1 and 100),
  apellido_materno text check (apellido_materno is null or char_length(apellido_materno) <= 100),
  fecha_nacimiento date not null check (fecha_nacimiento >= '1900-01-01'),
  curp text unique check (curp ~ '^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$'),
  telefono text check (telefono ~ '^\d{10}$'),
  correo text,
  municipio text,
  localidad text,
  nombre_corto_norm text generated always as (norm(nombre || ' ' || apellido_paterno)) stored,
  nombre_completo_norm text generated always as (norm(nombre || ' ' || apellido_paterno || ' ' || coalesce(apellido_materno,''))) stored,
  version int not null default 1,
  client_id uuid unique,
  creado_por uuid references auth.users,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index pacientes_trgm on pacientes using gin (nombre_corto_norm extensions.gin_trgm_ops);
create index pacientes_fn on pacientes (fecha_nacimiento);
create index pacientes_tel on pacientes (telefono);

create table paciente_clinico (
  paciente_id uuid primary key references pacientes on delete cascade,
  antecedentes text,
  actualizado_por uuid references auth.users,
  actualizado_en timestamptz not null default now()
);

create table visitas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes,
  fecha date not null,
  sede_id int not null references sedes,
  servicio servicio not null,
  origen origen not null default 'en_linea',
  client_id uuid unique,
  capturado_por uuid references auth.users,
  creado_en timestamptz not null default now()
);
create index visitas_paciente on visitas (paciente_id, fecha desc);

create table visita_nota (
  visita_id uuid primary key references visitas on delete cascade,
  observaciones text,
  autor uuid references auth.users,
  creado_en timestamptz not null default now()
);

create table paciente_cambios (
  id bigserial primary key,
  paciente_id uuid not null references pacientes,
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  por uuid references auth.users,
  en timestamptz not null default now()
);

create table captura_sync (
  client_id uuid primary key,
  tipo text not null,
  paciente_id uuid,
  respuesta jsonb not null,
  en timestamptz not null default now()
);

create table bitacora (
  id bigserial primary key,
  usuario uuid,
  rol rol,
  accion text not null,
  entidad text,
  entidad_id uuid,
  detalle jsonb,
  en timestamptz not null default now(),
  hash_prev text,
  hash text not null
);

-- ===== Rol actual =====
create or replace function public.rol_actual() returns rol
language sql stable security definer set search_path = public as $$
  select rol from perfiles where user_id = auth.uid() and activo
$$;

-- ===== RLS: lectura directa mínima; toda escritura de identidad va por RPC =====
alter table perfiles enable row level security;
alter table sedes enable row level security;
alter table pacientes enable row level security;
alter table paciente_clinico enable row level security;
alter table visitas enable row level security;
alter table visita_nota enable row level security;
alter table paciente_cambios enable row level security;
alter table captura_sync enable row level security;
alter table bitacora enable row level security;

create policy perfil_propio on perfiles for select using (user_id = auth.uid() or rol_actual() = 'admin');
create policy sedes_lectura on sedes for select using (auth.uid() is not null);
create policy clinico_medico on paciente_clinico for all
  using (rol_actual() = 'medico') with check (rol_actual() = 'medico');
create policy nota_medico on visita_nota for all
  using (rol_actual() = 'medico') with check (rol_actual() = 'medico');
create policy bitacora_lectura on bitacora for select using (rol_actual() in ('admin','auditor'));
-- pacientes, visitas, paciente_cambios y captura_sync: sin políticas = sin acceso directo.
-- Se leen y escriben solo con las funciones de BB-02.
