# BioBytes · Backlog de construcción (definitivo)
**Reto 1 EIRA · Vibeathon Nerdearla México 2026 · Equipo de 1 persona**

Este documento es para **construir**. Cada ticket se puede ejecutar de arriba abajo: dice qué hacer, trae el SQL, el prompt de Lovable o el código que hace falta, y cómo saber que quedó. El *qué* y el *por qué* (PRD, pitch, landing, modelo de negocio) viven en `BioBytes.md`.

---

## 0. Cómo usar este backlog

### Tablero
`Backlog` → `Por hacer` → `En curso` (máximo 1, porque eres una persona) → `Probando` → `Hecho`

Para el tablero puedes usar GitHub Projects: crea un *issue* por ticket copiando el bloque del ticket.

### Etiquetas
| Etiqueta | Significado |
|---|---|
| `P0` | Sin esto no hay demo |
| `P1` | Suma puntos; se corta si vas tarde (✂️) |
| `P2` | Después del hackatón |
| `db` · `front` · `offline` · `seguridad` · `deploy` · `docs` | Área |

### Plantilla de ticket
```
### BB-XX · Título
Épica · Prioridad · Estimación · Hora objetivo · Depende de
Contexto: por qué existe
Tareas: [ ] …
Aceptación: Dado / Cuando / Entonces
Material: SQL, prompt de Lovable o código
```

### Definición de hecho (aplica a todo ticket)
- [ ] Cumple todos sus criterios de aceptación, probados a mano.
- [ ] No usa datos reales: solo la semilla ficticia.
- [ ] Los permisos se revisan en el servidor, no solo ocultando botones.
- [ ] Hay un commit en GitHub con el mensaje `BB-XX: …`.

### Decisiones fijas (no se discuten durante el hackatón)
1. Toda escritura de identidad pasa por **una función del servidor**: `registrar_captura`.
2. La idempotencia vive en **Postgres** (`captura_sync`). **Valkey es una capa rápida opcional**: si falla, todo sigue funcionando.
3. Lo que la laptop encuentra sin red es una **coincidencia preliminar**. La palabra final la tienen el servidor y una persona.
4. Fechas de día en `America/Mexico_City`.
5. El *service worker* se registra **solo en producción**. Lo offline se prueba en la URL de Cloudflare, no en la vista previa de Lovable.

---

## 1. Cronograma del hackatón

| Hora | Ticket | Qué queda listo |
|---|---|---|
| 13:15 | BB-00 | Repo, Devpost en borrador, cuentas listas |
| 13:20 | BB-01 | Esquema de base de datos |
| 13:35 | BB-02 | Funciones del servidor (el corazón) |
| 14:05 | BB-03 | Semilla y usuarios; pruebas SQL en verde |
| 14:15 | BB-04 | Lovable: login, layout y barra de conexión |
| 14:30 | BB-05 | Padrón y expediente |
| 14:45 | BB-06 | Alta + «¿Es la misma persona?» |
| 15:00 | BB-07 | Cola offline + sincronización |
| 15:15 | BB-08 | PWA + deploy en Cloudflare |
| 15:20 | BB-09 | Vista médica (prueba de roles) |
| 15:22 | BB-15 | Ensayo de la demo |
| **15:30** | — | **Demo** |
| 15:35–15:55 | BB-14 | README y envío a Devpost **antes de las 16:00** |

Los tickets ✂️ **BB-10 a BB-13** (incluido BB-12b, imprimir/PDF) solo se hacen si llevas más de 10 minutos de ventaja. Si solo te alcanza para uno, haz **BB-12b**: es el más rápido y se ve muy bien en la demo.

> ✅ **El SQL de BB-01, BB-02, BB-03 y el script de reinicio ya se probaron** en Postgres 16 simulando `auth` y `vault` de Supabase: las coincidencias, la idempotencia, el conflicto de versión y los permisos por rol dan los resultados esperados.

---

## 2. Épicas

| Épica | Tickets | Objetivo |
|---|---|---|
| **E0 · Arranque** | BB-00 | Que nada administrativo te frene después |
| **E1 · Datos y servidor** | BB-01, BB-02, BB-03 | Reglas de identidad correctas y seguras en Postgres |
| **E2 · Flujo de captura** | BB-04, BB-05, BB-06 | Reconocer a María en línea |
| **E3 · Sin conexión** | BB-07, BB-08, ✂️ BB-11 | Abrir, buscar y capturar sin red |
| **E4 · Roles y privacidad** | BB-09, ✂️ BB-10, ✂️ BB-12 | Demostrar que cada perfil ve solo lo suyo |
| **E5 · Valkey** | ✂️ BB-13 | Idempotencia rápida y límite de intentos |
| **E6 · Entrega** | BB-14, BB-15 | Devpost, README y demo |
| **E7+ · Piloto** | BB-16… | Después del hackatón |

---

## 3. Tickets del hackatón

### BB-00 · Arranque
`E0` · `P0` · 5 min · 13:15 · —
**Tareas**
- [ ] Crear el repo público `biobytes` en GitHub con licencia MIT y subir `BioBytes.md` y este archivo a `/docs`.
- [ ] Crear el borrador del proyecto en Devpost (nombre, frase, enlace al repo) para no correr a las 15:55.
- [ ] Tener abiertas las sesiones de Supabase, Lovable y Cloudflare.
- [ ] Decidir la región del proyecto Supabase (la más cercana disponible, p. ej. `us-east-1` o `us-west-1`).

**Aceptación:** el repo existe, el Devpost está en borrador y las tres cuentas tienen sesión iniciada.

---

### BB-01 · Esquema de base de datos
`E1` · `P0` · `db` · 15 min · 13:20 · BB-00
**Contexto:** la paciente tiene un id estable, las visitas van aparte, lo clínico va en tablas separadas con su propia RLS y nada se borra.

**Tareas**
- [ ] Crear el proyecto en Supabase. En **Auth → Providers → Email**, desactivar *Allow new users to sign up*.
- [ ] Correr el SQL de abajo en **SQL Editor**.
- [ ] Probar: `select norm('María  Ejempló');` → `maria ejemplo`.

**Aceptación:** dado el SQL ejecutado, cuando reviso **Table Editor**, entonces existen las 9 tablas con RLS activado y la prueba de `norm` pasa.

```sql
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
```

---

### BB-02 · Funciones del servidor (el corazón)
`E1` · `P0` · `db` · 30 min · 13:35 · BB-01
**Contexto:** el navegador nunca decide un vínculo. Cada operación ocurre en una transacción y queda en la bitácora.

**Tareas**
- [ ] Guardar el secreto HMAC en **Vault**: `select vault.create_secret('cambia-esto-por-algo-largo', 'hmac_secret');`
- [ ] Correr el SQL de abajo, en orden.
- [ ] Revocar el acceso de `anon` (incluido al final del bloque).

**Aceptación:** las funciones existen y `anon` no puede ejecutarlas. Las pruebas se hacen en BB-03.

```sql
-- ===== Bitácora encadenada (HMAC) =====
create or replace function public.log_bitacora(p_accion text, p_entidad text, p_id uuid, p_detalle jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_prev text; v_secret text; v_en timestamptz := clock_timestamp(); v_rol rol := rol_actual();
begin
  perform pg_advisory_xact_lock(4242);                       -- serializa la cadena
  select hash into v_prev from bitacora order by id desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'hmac_secret';
  insert into bitacora(usuario, rol, accion, entidad, entidad_id, detalle, en, hash_prev, hash)
  values (auth.uid(), v_rol, p_accion, p_entidad, p_id, p_detalle, v_en, v_prev,
          encode(hmac(concat_ws('|', coalesce(v_prev,''), auth.uid(), v_rol, p_accion, p_entidad, p_id,
                                p_detalle::text, v_en::text),
                      coalesce(v_secret,'demo'), 'sha256'), 'hex'));
end $$;

create or replace function public.verificar_bitacora()
returns table(ok boolean, primera_fila_rota bigint, filas bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_prev text; v_secret text; v_calc text; v_n bigint := 0;
begin
  if rol_actual() not in ('admin','auditor') then raise exception 'forbidden' using errcode = '42501'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'hmac_secret';
  for r in select * from bitacora order by id loop
    v_n := v_n + 1;
    v_calc := encode(hmac(concat_ws('|', coalesce(v_prev,''), r.usuario, r.rol, r.accion, r.entidad, r.entidad_id,
                                    r.detalle::text, r.en::text), coalesce(v_secret,'demo'), 'sha256'), 'hex');
    if v_calc <> r.hash or coalesce(r.hash_prev,'') <> coalesce(v_prev,'') then
      return query select false, r.id, v_n; return;
    end if;
    v_prev := r.hash;
  end loop;
  return query select true, null::bigint, v_n;
end $$;

-- ===== Coincidencias =====
create or replace function public.buscar_coincidencias(
  p_nombre text, p_ap1 text, p_ap2 text, p_fecha date, p_curp text, p_tel text)
returns table(paciente_id uuid, folio text, nombre_completo text, fecha_nacimiento date,
              municipio text, telefono_mask text, nivel text, razones text[])
language sql stable security definer set search_path = public, extensions as $$
with q as (
  select norm(p_nombre||' '||p_ap1) corto,
         norm(p_nombre||' '||p_ap1||' '||coalesce(p_ap2,'')) completo
), pre as (
  select p.* from pacientes p, q
  where (p_curp is not null and p.curp = upper(p_curp))
     or p.fecha_nacimiento = p_fecha
     or (p_tel is not null and p.telefono = p_tel)
     or similarity(p.nombre_corto_norm, q.corto) > 0.35
  limit 50
), sc as (
  select pre.*,
    greatest(
      1 - levenshtein(pre.nombre_corto_norm, q.corto)::numeric / greatest(length(pre.nombre_corto_norm), length(q.corto), 1),
      1 - levenshtein(pre.nombre_completo_norm, q.completo)::numeric / greatest(length(pre.nombre_completo_norm), length(q.completo), 1)
    ) sim,
    (p_curp is not null and pre.curp = upper(p_curp)) m_curp,
    (pre.fecha_nacimiento = p_fecha) m_fecha,
    (p_tel is not null and pre.telefono = p_tel) m_tel
  from pre, q
), r as (
  select sc.*,
    case when m_curp or (m_fecha and sim >= 0.8) or (m_tel and sim >= 0.8) then 'alta' else 'posible' end nivel,
    array_remove(array[
      case when m_curp then 'Misma CURP' end,
      case when m_fecha then 'Misma fecha de nacimiento' end,
      case when m_tel then 'Mismo teléfono' end,
      case when sim = 1 then 'Mismo nombre (sin acentos)' when sim >= 0.8 then 'Nombre parecido' end,
      case when sim >= 0.8 and not m_fecha then 'Fecha de nacimiento distinta' end
    ], null) razones
  from sc
  where m_curp or m_fecha or m_tel or sim >= 0.8
)
select id, folio, nombre||' '||apellido_paterno||coalesce(' '||apellido_materno,''),
       fecha_nacimiento, municipio,
       case when telefono is null then null else left(telefono,2)||'****'||right(telefono,4) end,
       nivel, razones
from r
where rol_actual() in ('captura','coordinacion')
order by (nivel = 'alta') desc, cardinality(razones) desc;
$$;

-- ===== Captura única (alta | visita | cambio) =====
create or replace function public.registrar_captura(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_rol rol := rol_actual();
  v_cid uuid := (p->>'client_id')::uuid;
  v_tipo text := p->>'tipo';
  v_dec text := p->>'decision';
  d jsonb := coalesce(p->'paciente', '{}'::jsonb);
  v jsonb := p->'visita';
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_prev jsonb; v_cands jsonb; v_res jsonb;
  v_pid uuid; v_pac pacientes%rowtype;
  k text; v_old text; v_new text; v_n int := 0; v_folio text;
begin
  if v_rol is null or v_rol not in ('captura','coordinacion') then
    raise exception 'No tienes permiso para registrar.' using errcode = '42501';
  end if;
  if v_cid is null then raise exception 'Falta client_id.'; end if;

  -- Idempotencia: misma captura, misma respuesta
  select respuesta into v_prev from captura_sync where client_id = v_cid;
  if found then return v_prev; end if;

  ---------------------------------------------------------------- ALTA
  if v_tipo = 'alta' then
    if coalesce(trim(d->>'nombre'),'') = '' then raise exception 'Escribe el nombre.'; end if;
    if coalesce(trim(d->>'apellido_paterno'),'') = '' then raise exception 'Escribe el primer apellido.'; end if;
    if (d->>'fecha_nacimiento') is null or (d->>'fecha_nacimiento')::date < '1900-01-01'
       or (d->>'fecha_nacimiento')::date > v_hoy then raise exception 'Fecha de nacimiento fuera de rango.'; end if;
    if nullif(d->>'curp','') is not null and upper(d->>'curp') !~ '^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$'
       then raise exception 'CURP inválida (18 caracteres).'; end if;
    if nullif(d->>'telefono','') is not null and (d->>'telefono') !~ '^\d{10}$'
       then raise exception 'El teléfono debe tener 10 dígitos.'; end if;

    if v_dec is null then
      select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_cands
      from buscar_coincidencias(trim(d->>'nombre'), trim(d->>'apellido_paterno'),
                                nullif(trim(d->>'apellido_materno'),''), (d->>'fecha_nacimiento')::date,
                                nullif(upper(d->>'curp'),''), nullif(d->>'telefono','')) c;
      if jsonb_array_length(v_cands) > 0 then
        perform log_bitacora('coincidencias_detectadas', 'captura', v_cid,
          jsonb_build_object('candidatas', (select jsonb_agg(x->'paciente_id') from jsonb_array_elements(v_cands) x)));
        -- No se guarda en captura_sync: la misma captura vuelve con su decisión
        return jsonb_build_object('client_id', v_cid, 'estado', 'coincidencias', 'candidatas', v_cands);
      end if;
      v_dec := 'nueva';
    end if;

    if v_dec = 'vincular' then
      v_pid := (p->>'paciente_id')::uuid;
      select * into v_pac from pacientes where id = v_pid for update;
      if not found then raise exception 'Expediente no encontrado.'; end if;
      -- Los datos de contacto nuevos del alta NO se pierden
      foreach k in array array['telefono','correo'] loop
        v_new := nullif(d->>k, '');
        if v_new is not null then
          execute format('select %I from pacientes where id = $1', k) into v_old using v_pid;
          if v_old is distinct from v_new then
            execute format('update pacientes set %I = $1 where id = $2', k) using v_new, v_pid;
            insert into paciente_cambios(paciente_id, campo, valor_anterior, valor_nuevo, por)
            values (v_pid, k, v_old, v_new, auth.uid());
            v_n := v_n + 1;
          end if;
        end if;
      end loop;
      if v_n > 0 then update pacientes set version = version + 1, actualizado_en = now() where id = v_pid; end if;
      perform log_bitacora('vinculo_confirmado', 'paciente', v_pid,
        jsonb_build_object('client_id', v_cid, 'cambios', v_n));

    elsif v_dec = 'nueva' then
      if nullif(d->>'curp','') is not null then
        select folio into v_folio from pacientes where curp = upper(d->>'curp');
        if found then
          raise exception 'La CURP ya pertenece al expediente %. Si es ella, vincula; si no, corrige la CURP.', v_folio;
        end if;
      end if;
      insert into pacientes(nombre, apellido_paterno, apellido_materno, fecha_nacimiento, curp, telefono,
                            correo, municipio, localidad, client_id, creado_por)
      values (trim(d->>'nombre'), trim(d->>'apellido_paterno'), nullif(trim(d->>'apellido_materno'),''),
              (d->>'fecha_nacimiento')::date, nullif(upper(d->>'curp'),''), nullif(d->>'telefono',''),
              nullif(d->>'correo',''), nullif(d->>'municipio',''), nullif(d->>'localidad',''), v_cid, auth.uid())
      returning id into v_pid;
      -- Captura escribe antecedentes SOLO aquí (en el alta); después solo el médico
      if nullif(trim(d->>'antecedentes'),'') is not null then
        insert into paciente_clinico(paciente_id, antecedentes, actualizado_por)
        values (v_pid, d->>'antecedentes', auth.uid());
      end if;
      perform log_bitacora('alta', 'paciente', v_pid,
        jsonb_build_object('client_id', v_cid, 'descartadas', coalesce(p->'descartadas','[]'::jsonb)));
    else
      raise exception 'Decisión inválida.';
    end if;

  ---------------------------------------------------------------- VISITA
  elsif v_tipo = 'visita' then
    v_pid := (p->>'paciente_id')::uuid;
    if not exists (select 1 from pacientes where id = v_pid) then raise exception 'Expediente no encontrado.'; end if;

  ---------------------------------------------------------------- CAMBIO
  elsif v_tipo = 'cambio' then
    v_pid := (p->>'paciente_id')::uuid;
    select * into v_pac from pacientes where id = v_pid for update;
    if not found then raise exception 'Expediente no encontrado.'; end if;
    if v_pac.version <> (p->>'version_base')::int then
      return jsonb_build_object('client_id', v_cid, 'estado', 'conflicto',
        'servidor', jsonb_build_object('version', v_pac.version, 'telefono', v_pac.telefono,
                    'correo', v_pac.correo, 'municipio', v_pac.municipio, 'localidad', v_pac.localidad));
    end if;
    if nullif(d->>'telefono','') is not null and (d->>'telefono') !~ '^\d{10}$'
       then raise exception 'El teléfono debe tener 10 dígitos.'; end if;
    foreach k in array array['telefono','correo','municipio','localidad'] loop
      if d ? k then
        v_new := nullif(trim(d->>k), '');               -- vacío = «sin dato»
        execute format('select %I from pacientes where id = $1', k) into v_old using v_pid;
        if v_old is distinct from v_new then
          execute format('update pacientes set %I = $1 where id = $2', k) using v_new, v_pid;
          insert into paciente_cambios(paciente_id, campo, valor_anterior, valor_nuevo, por)
          values (v_pid, k, v_old, v_new, auth.uid());
          v_n := v_n + 1;
        end if;
      end if;
    end loop;
    if v_n = 0 then raise exception 'No cambiaste ningún dato.'; end if;
    update pacientes set version = version + 1, actualizado_en = now() where id = v_pid;
    perform log_bitacora('cambio_contacto', 'paciente', v_pid, jsonb_build_object('client_id', v_cid, 'campos', v_n));
  else
    raise exception 'Tipo de captura inválido.';
  end if;

  ---------------------------------------------------------------- VISITA (alta o visita)
  if v_tipo in ('alta','visita') and v is not null and jsonb_typeof(v) = 'object' then
    if coalesce((v->>'fecha')::date, v_hoy) > v_hoy then raise exception 'La fecha de la visita no puede ser futura.'; end if;
    if (v->>'sede_id') is null then raise exception 'Elige la sede.'; end if;
    if (v->>'servicio') is null then raise exception 'Elige el servicio.'; end if;
    insert into visitas(paciente_id, fecha, sede_id, servicio, origen, client_id, capturado_por)
    values (v_pid, coalesce((v->>'fecha')::date, v_hoy), (v->>'sede_id')::int, (v->>'servicio')::servicio,
            coalesce((p->>'origen')::origen, 'en_linea'), v_cid, auth.uid());
    perform log_bitacora('visita', 'paciente', v_pid,
      jsonb_build_object('client_id', v_cid, 'servicio', v->>'servicio', 'origen', coalesce(p->>'origen','en_linea')));
  end if;

  select folio into v_folio from pacientes where id = v_pid;
  v_res := jsonb_build_object('client_id', v_cid, 'estado', 'ok', 'paciente_id', v_pid, 'folio', v_folio);
  insert into captura_sync(client_id, tipo, paciente_id, respuesta) values (v_cid, v_tipo, v_pid, v_res);
  return v_res;
end $$;

-- ===== Padrón paginado en servidor =====
create or replace function public.buscar_padron(p_q text default null, p_limit int default 25, p_offset int default 0)
returns table(id uuid, folio text, nombre_completo text, fecha_nacimiento date, municipio text,
              num_visitas bigint, ultima_visita date, version int)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.folio, p.nombre||' '||p.apellido_paterno||coalesce(' '||p.apellido_materno,''),
         p.fecha_nacimiento, p.municipio,
         (select count(*) from visitas v where v.paciente_id = p.id),
         (select max(fecha) from visitas v where v.paciente_id = p.id),
         p.version
  from pacientes p
  where rol_actual() in ('captura','medico','coordinacion','admin')
    and (coalesce(p_q,'') = ''
         or p.folio ilike '%'||p_q||'%'
         or p.curp = upper(p_q)
         or p.telefono = regexp_replace(p_q, '\D', '', 'g')
         or p.nombre_completo_norm like '%'||norm(p_q)||'%'
         or similarity(p.nombre_corto_norm, norm(p_q)) > 0.35)
  order by p.actualizado_en desc
  limit least(p_limit, 100) offset p_offset
$$;

-- ===== Padrón para uso sin conexión (por municipio; sin datos clínicos) =====
create or replace function public.padron_offline(p_municipio text default null)
returns table(id uuid, folio text, nombre text, apellido_paterno text, apellido_materno text,
              fecha_nacimiento date, curp text, telefono text, municipio text, version int)
language sql stable security definer set search_path = public as $$
  select id, folio, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, curp, telefono, municipio, version
  from pacientes
  where rol_actual() in ('captura','coordinacion','medico')
    and (p_municipio is null or municipio = p_municipio)
$$;

-- ===== Abrir expediente (queda en bitácora; lo clínico solo para médico) =====
create or replace function public.abrir_expediente(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rol := rol_actual(); v jsonb;
begin
  if r is null or r not in ('captura','medico','coordinacion','admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'rol', r,
    'paciente', to_jsonb(p) - 'nombre_corto_norm' - 'nombre_completo_norm' - 'client_id' - 'creado_por',
    'visitas', coalesce((
       select jsonb_agg(jsonb_build_object(
                'id', vi.id, 'fecha', vi.fecha, 'servicio', vi.servicio, 'sede', s.nombre, 'origen', vi.origen,
                'nota', case when r = 'medico' then (select observaciones from visita_nota n where n.visita_id = vi.id) end)
              order by vi.fecha desc, vi.creado_en desc)
       from visitas vi join sedes s on s.id = vi.sede_id where vi.paciente_id = p.id), '[]'::jsonb),
    'cambios', coalesce((
       select jsonb_agg(jsonb_build_object('campo', c.campo, 'antes', c.valor_anterior, 'despues', c.valor_nuevo, 'en', c.en)
              order by c.en desc)
       from paciente_cambios c where c.paciente_id = p.id), '[]'::jsonb),
    'antecedentes', case when r = 'medico'
                         then (select antecedentes from paciente_clinico where paciente_id = p.id) end
  ) into v
  from pacientes p where p.id = p_id;
  if v is null then raise exception 'Expediente no encontrado.'; end if;
  perform log_bitacora('consulta_expediente', 'paciente', p_id, '{}'::jsonb);
  return v;
end $$;

-- ===== Permisos de ejecución =====
revoke execute on all functions in schema public from anon, public;
grant execute on function rol_actual, buscar_coincidencias, registrar_captura, buscar_padron,
  padron_offline, abrir_expediente, verificar_bitacora to authenticated;
-- log_bitacora y norm no se exponen a la API.
grant execute on function norm to authenticated;   -- lo usan índices y funciones; inofensivo
```

---

### BB-03 · Semilla, usuarios y pruebas SQL
`E1` · `P0` · `db` · 10 min · 14:05 · BB-02

**Tareas**
- [ ] En **Auth → Users → Add user**, crear 3 usuarios con contraseña: `captura@biobytes.demo`, `medico@biobytes.demo`, `auditor@biobytes.demo` (marcar *Auto confirm*).
- [ ] Correr la semilla.
- [ ] Correr las pruebas (simulan al usuario de captura).

```sql
-- Perfiles
insert into perfiles(user_id, nombre, rol)
select id, 'Ana (Captura)', 'captura'::rol from auth.users where email = 'captura@biobytes.demo'
union all select id, 'Dra. Luz (Médica)', 'medico'::rol from auth.users where email = 'medico@biobytes.demo'
union all select id, 'Raúl (Auditor)', 'auditor'::rol from auth.users where email = 'auditor@biobytes.demo';

-- Sedes
insert into sedes(nombre, municipio, localidad) values
 ('Consultorio EIRA Ciudad Guzmán', 'Zapotlán el Grande', 'Ciudad Guzmán'),
 ('Jornada Plaza Principal Tamazula', 'Tamazula de Gordiano', 'Tamazula');

-- Pacientes ficticias del reto
insert into pacientes(folio, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, telefono, municipio) values
 ('EIRA-900101', 'María',   'Ejemplo', 'López', '1980-03-14', '3410000001', 'Zapotlán el Grande'),
 ('EIRA-900102', 'Mariana', 'Ejemplo', 'López', '1986-07-02', null,         'Zapotlán el Grande'),
 ('EIRA-900103', 'María',   'Ejempló', 'Ruiz',  '1972-11-30', null,         'Tamazula de Gordiano');

insert into visitas(paciente_id, fecha, sede_id, servicio)
select id, '2026-02-10', 1, 'papanicolaou' from pacientes where folio = 'EIRA-900101';

insert into paciente_clinico(paciente_id, antecedentes)
select id, 'Antecedente ficticio: madre con diagnóstico de cáncer de mama.' from pacientes where folio = 'EIRA-900101';
```

**Pruebas (en SQL Editor, haciéndote pasar por Captura):**
```sql
begin;
-- Leer el id ANTES de cambiar de rol (como Captura, la RLS oculta la tabla pacientes)
select set_config('test.maria', (select id::text from pacientes where folio = 'EIRA-900101'), true);
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email='captura@biobytes.demo'), 'role','authenticated')::text, true);
set local role authenticated;

-- T1: debe devolver 900101 'alta' y 900102/900103 'posible'
select folio, nivel, razones from buscar_coincidencias('Maria','Ejemplo',null,'1980-03-14',null,null);

-- T2: alta sin decisión → estado 'coincidencias' y NO crea nada
select registrar_captura('{"client_id":"00000000-0000-0000-0000-000000000001","tipo":"alta",
  "paciente":{"nombre":"Maria","apellido_paterno":"Ejemplo","fecha_nacimiento":"1980-03-14","telefono":"3419998877"},
  "visita":{"sede_id":1,"servicio":"ultrasonido_mama"}}'::jsonb)->>'estado';

-- T3: misma captura con decisión 'vincular' → ok; teléfono actualizado; visita agregada
select registrar_captura(('{"client_id":"00000000-0000-0000-0000-000000000001","tipo":"alta","decision":"vincular",
  "paciente_id":"' || current_setting('test.maria') || '",
  "paciente":{"nombre":"Maria","apellido_paterno":"Ejemplo","fecha_nacimiento":"1980-03-14","telefono":"3419998877"},
  "visita":{"sede_id":1,"servicio":"ultrasonido_mama"}}')::jsonb)->>'estado';

-- T4: reenviar T3 → misma respuesta (idempotente). abrir_expediente debe mostrar 2 visitas y 1 cambio
select registrar_captura(('{"client_id":"00000000-0000-0000-0000-000000000001","tipo":"alta","decision":"vincular",
  "paciente_id":"' || current_setting('test.maria') || '","paciente":{},"visita":null}')::jsonb)->>'estado';
select jsonb_array_length(e->'visitas') visitas, jsonb_array_length(e->'cambios') cambios, e->'antecedentes' antecedentes
from abrir_expediente(current_setting('test.maria')::uuid) e;      -- 2 · 1 · null (Captura no los ve)

-- T5: cambio con versión vieja (la versión ya es 2) → 'conflicto'
select registrar_captura(('{"client_id":"00000000-0000-0000-0000-000000000002","tipo":"cambio","version_base":1,
  "paciente_id":"' || current_setting('test.maria') || '","paciente":{"correo":"maria@ejemplo.mx"}}')::jsonb)->>'estado';
rollback;   -- deja la base limpia para la demo
```

**Aceptación:** T1 da 1 alta y 2 posibles · T2 da `coincidencias` · T3 da `ok` · T4 da `ok` y `2 · 1 · null` · T5 da `conflicto`.

---

### BB-04 · Lovable: login, layout y barra de conexión
`E2` · `P0` · `front` · 15 min · 14:15 · BB-01

**Tareas**
- [ ] Crear el proyecto en Lovable y conectar Supabase (integración nativa; usar la *anon key*).
- [ ] Sincronizar con GitHub (repo de BB-00).
- [ ] Pegar el prompt.

**Prompt de Lovable**
```
Crea "BioBytes", una app web en español de México para brigadas de salud de EIRA Movimiento Rosa.
Stack: React + Vite + TypeScript + Tailwind + shadcn/ui + Supabase (ya conectado).

DISEÑO: cálido y accesible. Fondo #FAF6F1, texto #2B2230, texto secundario #6B6470,
primario #A8245A (botones), secundario #1F7A6B, acento #E0457B, fondo de tarjetas #FCE8EF,
pendiente #B26A00, error #B42318, info #2F5FA8. Títulos en Nunito, interfaz en Inter, folios en
JetBrains Mono. Botones de 44px de alto como mínimo, radio 14px, foco visible, contraste AA.
Lenguaje simple: "Sin internet" (no "offline"), "Pendiente de enviar" (no "en cola").

1) /login: correo y contraseña con supabase.auth.signInWithPassword. Sin botón de registro.
   Al entrar, llamar supabase.rpc('rol_actual') y guardar el rol en un contexto (AuthContext).
   Si el rol es null, mostrar "Tu cuenta no tiene un perfil asignado. Pide acceso a coordinación."
2) Layout autenticado con barra superior fija:
   - Logo "BioBytes", el nombre del rol ("Captura", "Personal médico", "Auditoría") y "Cerrar sesión".
   - Indicador de conexión: "● En línea" (verde #1F7A6B) o "● Sin internet" (ámbar #B26A00), dentro de
     un elemento con aria-live="polite". El estado se calcula con un hook useConexion() que, además de
     los eventos online/offline, cada 20 segundos hace un fetch HEAD a `${SUPABASE_URL}/auth/v1/health`
     con un timeout de 4 s; si falla, está "Sin internet".
   - Contadores: "N pendientes de enviar" y "N por decidir → Abrir" (por ahora en 0; luego vendrán de la cola).
3) Rutas protegidas: /padron, /alta (solo rol captura o coordinacion), /expediente/:id, /bitacora (solo auditor o admin).
   Si el rol no tiene acceso, mostrar "No tienes acceso a esta sección".
```

**Aceptación:** dado `captura@`, cuando inicio sesión, entonces veo la barra con «Captura» y «En línea». Al apagar el Wi-Fi, en menos de 20 s cambia a «Sin internet».

---

### BB-05 · Padrón y expediente con cronología
`E2` · `P0` · `front` · 15 min · 14:30 · BB-02, BB-04

**Prompt de Lovable**
```
Implementa dos pantallas:

/padron
- Título "Padrón". Una caja de búsqueda grande con el texto de ayuda: "Busca a la paciente antes de
  registrarla: por nombre (con o sin acentos), folio, CURP o teléfono."
- Con debounce de 300 ms llama supabase.rpc('buscar_padron', { p_q, p_limit: 25, p_offset }).
- Tabla: Folio (mono), Nombre, Nacimiento (DD/MM/AAAA), Municipio, Visitas, Última visita. Clic en la fila
  lleva a /expediente/:id. Paginación "Anterior / Siguiente".
- Si el rol es captura o coordinacion, botón primario "Registrar paciente" que lleva a /alta.

/expediente/:id
- Llama supabase.rpc('abrir_expediente', { p_id }). Devuelve { rol, paciente, visitas, cambios, antecedentes }.
- Encabezado: nombre completo, folio grande en mono, nacimiento, teléfono, correo, municipio.
- Si rol = 'medico': tarjeta "Antecedentes" con el texto y un botón "Editar" que hace upsert en la tabla
  paciente_clinico (paciente_id, antecedentes, actualizado_por = user.id). Además, en cada visita, un campo
  "Observaciones clínicas" que hace upsert en visita_nota (visita_id, observaciones, autor).
- Si rol = 'captura': botón "Actualizar contacto" (abre un formulario con teléfono, correo, municipio y localidad)
  y botón "Registrar visita de hoy" (formulario: sede de la lista de la tabla sedes y servicio de la lista:
  Papanicolaou, Ultrasonido de mama, Exploración clínica de mama, Valoración nutricional, Mastografía).
  Ambos envían a través de la función enviarCaptura() que crearemos en el ticket de la cola; por ahora,
  llama supabase.rpc('registrar_captura', { p }) con:
    contacto → { client_id: crypto.randomUUID(), tipo:'cambio', paciente_id, version_base: paciente.version, paciente:{...solo campos cambiados} }
    visita   → { client_id: crypto.randomUUID(), tipo:'visita', paciente_id, visita:{ fecha: hoyCDMX(), sede_id, servicio } }
- Cronología (lo más reciente arriba), mezclando visitas y cambios:
    Visita: ícono, "Ultrasonido de mama · Consultorio EIRA · 21/11/2026"; si origen = 'sin_conexion',
    insignia ámbar "Capturada sin conexión".
    Cambio: "Teléfono: ~~3410000001~~ → 3419998877 · fecha" (el valor anterior tachado).
- Helper hoyCDMX(): new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()).
- Mensajes de error: mostrar error.message tal cual viene del servidor (ya está en español).
```

**Aceptación:** buscar «maria» sin acento encuentra a las 3. Al abrir 900101 como Captura veo la visita de febrero y no veo antecedentes; como Médico sí los veo.

---

### BB-06 · Alta + «¿Es la misma persona?»
`E2` · `P0` · `front` · 15 min · 14:45 · BB-05

**Prompt de Lovable**
```
Implementa /alta (solo rol captura o coordinacion).

Formulario en dos tarjetas:
A) "Datos de la paciente": Nombre*, Primer apellido*, Segundo apellido, Fecha de nacimiento*,
   CURP, Teléfono, Correo, Municipio, Antecedentes (textarea).
   Nota bajo el título: "Con CURP o teléfono la búsqueda de coincidencias es más confiable."
B) "Servicio de hoy": casilla "Registrar también la visita de hoy" (marcada por omisión), Fecha (por omisión
   hoyCDMX(), máximo hoyCDMX()), Sede (select de la tabla sedes), Servicio (select de la lista).

Validación con zod (mensajes exactos):
- nombre: requerido, máximo 100 → "Escribe el nombre."
- apellido_paterno: requerido → "Escribe el primer apellido."
- fecha_nacimiento: entre 1900-01-01 y hoy → "Fecha de nacimiento fuera de rango."
- curp: opcional; se convierte a mayúsculas; regex ^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$ → "CURP inválida (18 caracteres)."
- telefono: opcional; quitar todo lo que no sea dígito; deben quedar 10 → "El teléfono debe tener 10 dígitos."
- correo: opcional, email → "Correo inválido."
- visita: sede requerida → "Elige la sede."; servicio requerido → "Elige el servicio."; fecha no futura →
  "La fecha de la visita no puede ser futura."
Campos vacíos se mandan como null.

Botón primario: "Buscar coincidencias y registrar". Al enviar, crear UNA vez
client_id = crypto.randomUUID() y construir
p = { client_id, tipo:'alta', origen: 'en_linea', paciente:{...}, visita: marcada ? {...} : null }
y mandarlo con enviarCaptura(p) (por ahora supabase.rpc('registrar_captura', { p })).

Respuestas:
- estado 'ok': toast "Expediente {folio} listo" e ir a /expediente/{paciente_id}.
- estado 'coincidencias': NO navegar. Mostrar un panel grande con el título "¿Es la misma persona?" y el aviso:
  "Encontramos expedientes parecidos. El nombre no basta para identificar: compara fecha de nacimiento,
  CURP y teléfono, y pregúntale a la paciente. Nada se fusiona sin tu confirmación."
  Una tarjeta por candidata: nombre, folio, nacimiento, municipio, teléfono enmascarado; una etiqueta de nivel
  ("Muy probable" en rosa #A8245A si nivel = 'alta'; "Revisar" en azul #2F5FA8 si es 'posible'); y las razones
  como chips. En cada tarjeta, el botón "Sí, es ella: usar este expediente" → reenviar el MISMO p con
  decision:'vincular', paciente_id. Abajo, botón secundario "Ninguna es ella: crear expediente nuevo" →
  reenviar el MISMO p con decision:'nueva', descartadas: [ids de todas las candidatas].
  Antes de "Ninguna es ella", pedir confirmación: "¿Confirmas que ninguna de estas {n} pacientes es ella?"
- error: mostrar error.message arriba del formulario, en rojo, con role="alert".
```

**Aceptación (recorrido del reto, pasos 1 a 6):** escribir «Maria · Ejemplo · 14/03/1980 · tel. 3419998877 · Ultrasonido» → aparecen 3 tarjetas (900101 «Muy probable») → «Sí, es ella» → el expediente 900101 muestra 2 visitas y el cambio de teléfono tachado. En el padrón **no** aparece una cuarta María.

---

### BB-07 · Cola offline + sincronización
`E3` · `P0` · `offline` · 15 min · 15:00 · BB-06
**Contexto:** ninguna captura se pierde. La cola se envía en orden y el servidor decide.

**Tareas**
- [ ] `npm i dexie` (pídeselo a Lovable).
- [ ] Crear `src/lib/cola.ts` con el código de abajo y reemplazar las llamadas directas por `enviarCaptura`.
- [ ] Al iniciar sesión con red: descargar `padron_offline` a Dexie.
- [ ] La barra muestra los contadores reales y la lista de tarjetas por decidir.

**Código base (`src/lib/cola.ts`)**
```ts
import Dexie, { Table } from "dexie";
import { supabase } from "@/integrations/supabase/client";

export type Estado = "pendiente" | "coincidencias" | "conflicto" | "error" | "ok";
export interface Captura { client_id: string; p: any; estado: Estado; respuesta?: any; creada: number; }
export interface PacienteLocal { id: string; folio: string; nombre: string; apellido_paterno: string;
  apellido_materno: string | null; fecha_nacimiento: string; curp: string | null; telefono: string | null;
  municipio: string | null; version: number; }

class DB extends Dexie {
  cola!: Table<Captura, string>;
  padron!: Table<PacienteLocal, string>;
  constructor() { super("biobytes"); this.version(1).stores({ cola: "client_id, estado, creada", padron: "id, folio" }); }
}
export const db = new DB();

export async function enviarCaptura(p: any): Promise<any> {
  p.origen = navigator.onLine ? (p.origen ?? "en_linea") : "sin_conexion";
  await db.cola.put({ client_id: p.client_id, p, estado: "pendiente", creada: Date.now() });
  return sincronizar();                       // si no hay red, queda pendiente
}

let corriendo = false;
export async function sincronizar(): Promise<any> {
  if (corriendo) return; corriendo = true;
  let ultima: any;
  try {
    const pendientes = await db.cola.where("estado").equals("pendiente").sortBy("creada");
    for (const c of pendientes) {
      const { data, error } = await supabase.rpc("registrar_captura", { p: c.p });
      if (error) {
        const red = !error.code || error.message?.includes("Failed to fetch");
        if (red) break;                                              // sin red: se detiene, nada se pierde
        if (error.code === "PGRST301" || error.message?.includes("JWT")) {
          avisar("Tu sesión expiró. Inicia sesión de nuevo; la captura sigue guardada en este dispositivo.");
          break;
        }
        await db.cola.update(c.client_id, { estado: "error", respuesta: { mensaje: error.message } });
        ultima = { estado: "error", mensaje: error.message }; continue;
      }
      if (data.estado === "ok") await db.cola.delete(c.client_id);
      else await db.cola.update(c.client_id, { estado: data.estado, respuesta: data });
      ultima = data;
    }
  } finally { corriendo = false; }
  return ultima;
}

// Reenviar tras una decisión humana (coincidencias o conflicto): MISMO client_id
export async function decidir(client_id: string, cambios: any) {
  const c = await db.cola.get(client_id); if (!c) return;
  await db.cola.update(client_id, { p: { ...c.p, ...cambios }, estado: "pendiente" });
  return sincronizar();
}

export async function descargarPadron(municipio?: string) {
  const { data, error } = await supabase.rpc("padron_offline", { p_municipio: municipio ?? null });
  if (!error && data) { await db.padron.clear(); await db.padron.bulkPut(data); }
}

export function iniciarSincronizacion() {
  window.addEventListener("online", () => sincronizar());
  setInterval(() => sincronizar(), 30_000);
  navigator.storage?.persist?.();            // pedir que el navegador no borre la cola
}
function avisar(m: string) { window.dispatchEvent(new CustomEvent("biobytes:aviso", { detail: m })); }
```

**Coincidencias sin red (`src/lib/match.ts`)**, espejo simplificado de la regla del servidor (resultado **preliminar**):
```ts
export const norm = (t = "") => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
export function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[a.length][b.length];
}
const sim = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
export function coincidenciasLocales(q: any, padron: any[]) {
  const corto = norm(`${q.nombre} ${q.apellido_paterno}`);
  const completo = norm(`${q.nombre} ${q.apellido_paterno} ${q.apellido_materno ?? ""}`);
  return padron.map(p => {
    const s = Math.max(sim(norm(`${p.nombre} ${p.apellido_paterno}`), corto),
                       sim(norm(`${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ""}`), completo));
    const mC = !!q.curp && p.curp === q.curp, mF = p.fecha_nacimiento === q.fecha_nacimiento,
          mT = !!q.telefono && p.telefono === q.telefono;
    if (!(mC || mF || mT || s >= 0.8)) return null;
    const razones = [mC && "Misma CURP", mF && "Misma fecha de nacimiento", mT && "Mismo teléfono",
      s === 1 ? "Mismo nombre (sin acentos)" : s >= 0.8 ? "Nombre parecido" : null,
      s >= 0.8 && !mF && "Fecha de nacimiento distinta"].filter(Boolean);
    const nivel = mC || (mF && s >= 0.8) || (mT && s >= 0.8) ? "alta" : "posible";
    return { ...p, nivel, razones, preliminar: true };
  }).filter(Boolean).sort((a: any, b: any) => (a.nivel === "alta" ? -1 : 1) - (b.nivel === "alta" ? -1 : 1));
}
```

**Prompt de Lovable para conectar todo**
```
Usa src/lib/cola.ts y src/lib/match.ts (ya existen):
- En App, llamar iniciarSincronizacion() al montar. Tras un login exitoso con red, llamar descargarPadron().
- Reemplazar toda llamada directa a rpc('registrar_captura') por enviarCaptura(p).
- Si enviarCaptura devuelve undefined (no hubo red), mostrar el toast "Guardada en este dispositivo. Se
  enviará sola al volver la conexión." y volver al padrón.
- En /alta sin red: antes de guardar, ejecutar coincidenciasLocales(datos, await db.padron.toArray()). Si hay
  resultados, mostrar el mismo panel "¿Es la misma persona?" con la etiqueta adicional "Coincidencia preliminar:
  se confirmará al sincronizar". La decisión se guarda en p (decision, paciente_id/descartadas).
- En /padron sin red: buscar en db.padron con norm() en lugar de rpc('buscar_padron').
- La barra superior usa useLiveQuery de dexie-react-hooks para contar: pendientes (estado 'pendiente') y
  por decidir (estado 'coincidencias' | 'conflicto' | 'error'). "N por decidir → Abrir" abre un panel lateral
  con una tarjeta por captura:
   · coincidencias → el panel "¿Es la misma persona?" usando respuesta.candidatas y decidir(client_id, {...}).
   · conflicto → tabla campo por campo con dos opciones por fila: "Actual" (respuesta.servidor[campo],
     seleccionada por omisión) y "Tu captura" (p.paciente[campo]). Botón "Aplicar" → decidir(client_id,
     { version_base: respuesta.servidor.version, paciente: { solo campos donde eligió "Tu captura" } }).
     Si no eligió ninguno, borrar la captura de la cola.
   · error → mostrar el mensaje y los botones "Corregir" (abre el formulario con p) y "Descartar".
- Cerrar sesión: si hay capturas pendientes, confirmar "Tienes N capturas sin enviar. Si sales, se perderán.
  Conéctate primero o pide a coordinación que las envíe." Si confirma: db.delete() y luego signOut().
```

**Aceptación:** con el Wi-Fi apagado registro una visita para 900101 → «1 pendiente de enviar» → prendo el Wi-Fi → en menos de 30 s el contador vuelve a 0 y la visita aparece con la insignia «Capturada sin conexión».

---

### BB-08 · PWA + deploy en Cloudflare Pages
`E3` · `P0` · `deploy` · 10 min · 15:15 · BB-07

**Tareas**
- [ ] Pedir a Lovable: «Agrega vite-plugin-pwa con registerType 'autoUpdate', manifest (name BioBytes, theme_color #A8245A, background_color #FAF6F1, display standalone, íconos 192 y 512) y Workbox con navigateFallback '/index.html'. Registra el service worker SOLO si import.meta.env.PROD.»
- [ ] En Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → repo `biobytes`. Build: `npm run build`, salida: `dist`. Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (o como las nombre Lovable; revisa `src/integrations/supabase/client.ts`).
- [ ] Agregar `public/_redirects` con la línea `/* /index.html 200` (rutas del SPA).
- [ ] En Supabase → **Auth → URL Configuration**, agregar la URL `*.pages.dev`.

**Aceptación:** abro la URL de Cloudflare, inicio sesión y navego. Apago el Wi-Fi y **recargo**: la app abre, el padrón busca en local y puedo capturar.

---

### BB-09 · Vista médica: prueba de roles
`E4` · `P0` · `seguridad` · 2 min · 15:20 · BB-05

**Tareas**
- [ ] Iniciar sesión como `medico@`, abrir 900101 y verificar los antecedentes y que no hay botones de captura.
- [ ] En la consola del navegador: `await supabase.rpc('registrar_captura', { p: { client_id: crypto.randomUUID(), tipo: 'visita' } })` → debe devolver «No tienes permiso para registrar.»
- [ ] Como `captura@`: `await supabase.from('paciente_clinico').select()` → `[]`.

**Aceptación:** los tres resultados coinciden. Toma capturas de pantalla para el README.

---

### ✂️ BB-10 · Cifrado de la cola y borrado al salir
`E4` · `P1` · `seguridad` · 10 min · BB-07
**Contexto:** las laptops pueden compartirse. Una llave que vive solo en memoria se pierde si la laptop se reinicia, y con ella las capturas pendientes. Por eso se guarda como `CryptoKey` **no exportable** en IndexedDB: sobrevive a una recarga, no se puede copiar y se borra al cerrar sesión.

```ts
// src/lib/cripto.ts
import { db } from "./cola";
const ALG = { name: "AES-GCM", length: 256 } as const;
async function llave(): Promise<CryptoKey> {
  const k = await (db as any).table("meta").get("llave");
  if (k) return k.v;
  const nueva = await crypto.subtle.generateKey(ALG, false, ["encrypt", "decrypt"]); // no exportable
  await (db as any).table("meta").put({ id: "llave", v: nueva });
  return nueva;
}
export async function cifrar(obj: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llave(),
                                         new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: Array.from(iv), ct: new Uint8Array(ct) };
}
export async function descifrar(x: { iv: number[]; ct: Uint8Array }) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(x.iv) }, await llave(), x.ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
// En DB: this.version(2).stores({ cola: "client_id, estado, creada", padron: "id, folio", meta: "id" });
// Guardar en la cola { client_id, estado, creada, pc: await cifrar(p) } y descifrar justo antes de enviar.
// El padrón local se guarda igual: { id, folio, pc: await cifrar(fila) }.
```

**Aceptación:** en DevTools → Application → IndexedDB, la cola muestra bytes, no nombres. Tras cerrar sesión, la base `biobytes` no existe.

---

### ✂️ BB-11 · Persistencia y robustez offline
`E3` · `P1` · `offline` · 5 min · BB-07
- [ ] Mostrar en la barra si `navigator.storage.persisted()` es `false`: «El navegador podría borrar capturas si se llena; envíalas pronto.»
- [ ] Al volver la red, renovar la sesión con `supabase.auth.refreshSession()` antes de `sincronizar()`.
- [ ] Botón «Imprimir formato en blanco» (`/formato.pdf` en `public/`).

**Aceptación:** después de 1 hora sin red, al reconectar la cola se envía sin volver a iniciar sesión, siempre que el *refresh token* siga vigente.

---

### ✂️ BB-12 · Bitácora y página de auditoría
`E4` · `P1` · `seguridad` · 8 min · BB-02, BB-03
**Prompt de Lovable**
```
Página /bitacora (solo auditor o admin): tabla de la tabla bitacora ordenada por id desc (fecha, rol, acción,
entidad, entidad_id truncado, detalle en JSON compacto; nunca nombres). Botón "Verificar integridad" que llama
rpc('verificar_bitacora') y muestra "✓ Cadena íntegra (N registros)" en verde, o
"✗ Registro alterado: #id" en rojo.
```
**Aceptación:** si edito a mano una fila de la bitácora en Supabase, la verificación marca ese id.

---

### ✂️ BB-12b · Imprimir y guardar como PDF (expediente y comprobante de visita)
`E4` · `P1` · `front` · 10 min · BB-05
**Contexto:** EIRA archiva en papel y necesita contingencia. Imprimir con CSS (`window.print()` → «Guardar como PDF») **funciona sin internet**, no agrega librerías y respeta el rol, porque imprime lo que esa persona ya puede ver.

**Prompt de Lovable**
```
En /expediente/:id agrega un botón "Imprimir / PDF" que llama window.print(). Crea estilos @media print:
- Oculta la barra superior, los botones y los paneles; fondo blanco, texto negro, tipografía de 11 pt, tamaño carta.
- Encabezado: "BioBytes · EIRA Movimiento Rosa", folio grande, fecha y hora de impresión (CDMX) y quién imprimió (rol).
- Contenido: datos generales y la cronología de visitas y cambios. Los antecedentes y las notas clínicas
  aparecen SOLO si el rol es medico (ya vienen así de abrir_expediente).
- Pie en cada página: "CONFIDENCIAL · Contiene datos personales de salud · Folio EIRA-XXXXXX · Página N".
- No imprimir CURP completa: mostrar solo los últimos 4 caracteres.
Además, después de registrar una visita, ofrece "Imprimir comprobante": media carta con folio, nombre,
fecha, sede y servicio, sin datos clínicos (para que la paciente conserve su folio).
```
**Servidor:** antes de imprimir, llamar a una RPC `registrar_impresion(p_id)` que solo hace `log_bitacora('impresion','paciente',p_id,'{}')`, para que cada impresión quede registrada.

**Aceptación:** como Captura, el PDF sale sin antecedentes; como Médico, con antecedentes. Funciona con el Wi-Fi apagado. La bitácora registra `impresion`.

---

### ✂️ BB-13 · Edge Function `sync` + Valkey
`E5` · `P1` · `db` · 15 min · BB-07
**Contexto:** Valkey es una capa rápida para idempotencia y límite de intentos. **No** es la fuente de verdad: si falla, la función sigue llamando a Postgres.

**Tareas**
- [ ] Crear un Valkey con endpoint TLS público (Aiven for Valkey u otro). **Prueba la conexión antes de seguir; si en 5 minutos no conecta, abandona este ticket.**
- [ ] `supabase functions new sync` con el código de abajo. Secretos: `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASS`.
- [ ] En `cola.ts`, si `VITE_SYNC_MODE === 'edge'`, enviar lotes a `supabase.functions.invoke('sync', { body: { capturas } })` en lugar del RPC uno por uno.

```ts
// supabase/functions/sync/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
import { connect } from "https://deno.land/x/redis@v0.32.4/mod.ts";

let valkey: any = null;
try {
  valkey = await connect({ hostname: Deno.env.get("VALKEY_HOST")!, port: Number(Deno.env.get("VALKEY_PORT") ?? 6379),
                           password: Deno.env.get("VALKEY_PASS"), tls: true });
} catch { valkey = null; }                         // sin Valkey: modo degradado

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401, headers: cors });

  if (valkey) {
    const k = `rl:${user.id}:${Math.floor(Date.now() / 60000)}`;
    const n = await valkey.incr(k); if (n === 1) await valkey.expire(k, 60);
    if (n > 60) return new Response("Demasiadas capturas por minuto.", { status: 429, headers: cors });
  }

  const { capturas } = await req.json();
  const resultados = [];
  for (const p of capturas) {
    const hit = valkey ? await valkey.get(`idem:${p.client_id}`) : null;
    if (hit) { resultados.push({ ...JSON.parse(hit), cache: "valkey" }); continue; }
    const { data, error } = await sb.rpc("registrar_captura", { p });
    const r = error ? { client_id: p.client_id, estado: "error", mensaje: error.message } : data;
    if (valkey && r.estado === "ok") await valkey.set(`idem:${p.client_id}`, JSON.stringify(r), { ex: 86400 });
    resultados.push(r);
  }
  return Response.json({ resultados, valkey: !!valkey }, { headers: cors });
});
```

**Aceptación:** al reenviar la misma captura, la respuesta trae `cache: "valkey"`. Si apago Valkey, la sincronización sigue funcionando y devuelve `valkey: false`.

---

### BB-14 · README, Devpost y documentación
`E6` · `P0` · `docs` · 20 min · 15:35 · todo

**README mínimo**
```
# BioBytes · Expediente único para brigadas de salud (Reto 1 EIRA)
Qué es (1 párrafo) · Demo en video o enlace · URL de Cloudflare · Usuarios de prueba (datos ficticios)
## Implementado vs. simulado     ← copiar la tabla de la sección 10 de BioBytes.md y marcar lo que sí se terminó
## Cómo correrlo                 ← SQL de BB-01, BB-02 y BB-03, variables de entorno, npm i && npm run dev
## Arquitectura                  ← diagrama de la sección 4.1 de BioBytes.md
## Seguridad y privacidad        ← matriz de roles + RLS + bitácora
## Riesgos, costos y piloto      ← sección 3.8 y sección 10 de BioBytes.md
## Preguntas abiertas para EIRA  ← sección 11
Licencia MIT · Solo datos ficticios · El hackatón no autoriza el uso con pacientes reales.
```
- [ ] Devpost: frase, descripción, enlace al repo, enlace a la demo, stack (Lovable, Supabase, Valkey, Cloudflare). **Enviar antes de las 16:00.**

---

### BB-15 · Ensayo de la demo (2 minutos)
`E6` · `P0` · 8 min · 15:22
- [ ] Preparar dos pestañas con sesión iniciada: `captura@` y `medico@`, ambas en la URL de Cloudflare.
- [ ] Re-sembrar la base si ya hubo pruebas: borrar las visitas y cambios de hoy, o tener listo un script de reinicio.
- [ ] Seguir el guion de la sección 8 de `BioBytes.md`. **Apagar el Wi-Fi de verdad y recargar la página.**
- [ ] Plan B: video de respaldo grabado en el primer ensayo que salga bien.

**Script de reinicio para la demo**
```sql
delete from visitas where fecha > '2026-02-10';
delete from paciente_cambios; delete from captura_sync;
delete from paciente_clinico where paciente_id not in (select id from pacientes where folio like 'EIRA-9001%');
delete from pacientes where folio not in ('EIRA-900101','EIRA-900102','EIRA-900103');
update pacientes set telefono = '3410000001', version = 1 where folio = 'EIRA-900101';
-- La bitácora NO se borra (es la prueba de integridad).
```

---

## 4. Backlog después del hackatón (hacia el piloto)

### E7 · Endurecer (2 semanas)
| ID | Ticket | Aceptación |
|---|---|---|
| BB-16 | Pruebas automatizadas de SQL (pgTAP) para coincidencias, idempotencia y conflictos | CI en verde con los casos T1 a T5 y los casos límite (CURP duplicada, fecha futura) |
| BB-17 | Pruebas E2E con Playwright del recorrido de María, incluido el modo sin red (`context.setOffline`) | El recorrido completo pasa en CI |
| BB-18 | Catálogos INEGI de estados, municipios y localidades; sede ligada a una jornada | Ya no hay texto libre en municipio ni localidad |
| BB-19 | Exportación CSV operativa segura (sin datos personales; neutraliza `= + - @`) | Una celda `=HYPERLINK()` se exporta como texto |
| BB-20 | Accesibilidad: auditoría con axe y lector de pantalla (NVDA) | 0 errores críticos; el cambio de conexión se anuncia |
| BB-21 | Padrón offline por jornada (no por municipio completo) y caducidad de 72 h | El padrón local se borra solo al vencer |
| BB-21b | PDF con formato oficial de EIRA (plantilla con logotipo, generado en el servidor, firmado con hash y folio de impresión verificable) | El PDF trae un código que permite comprobar en BioBytes que es auténtico |
| BB-22 | Antecedentes offline para el rol médico (cifrados, solo pacientes de la jornada), **si EIRA lo aprueba** | Decisión documentada y prueba de cifrado |

### E8 · Coordinación y administración (2 semanas)
| ID | Ticket | Aceptación |
|---|---|---|
| BB-23 | Rol Coordinación: tablero de la jornada (capturas por sincronizar por dispositivo, por decidir, altas del día) | Vista filtrada por sede y fecha |
| BB-24 | Corrección de identidad (nombre, fecha de nacimiento, CURP) con motivo obligatorio | Queda en `paciente_cambios` y en la bitácora |
| BB-25 | **Fusionar** dos expedientes: vista lado a lado, elegir valores, doble confirmación; el expediente absorbido queda como alias | Las visitas se mueven; nada se borra; es reversible con BB-26 |
| BB-26 | **Separar** un vínculo erróneo: mover visitas a un expediente nuevo o existente | La cronología muestra la separación |
| BB-27 | Admin: alta de usuarios, asignación y desactivación de roles (nadie se asigna el suyo) | Una política impide que alguien edite su propio perfil |
| BB-28 | Respaldo: `pg_dump` cifrado semanal a Cloudflare R2 + **prueba de restauración** documentada | Restauración probada en un proyecto vacío |

### E9 · Paciente (2–3 semanas)
| ID | Ticket | Aceptación |
|---|---|---|
| BB-29 | Tarjeta imprimible con folio y QR (sin datos clínicos) | El QR abre la búsqueda por folio en la app |
| BB-30 | Portal de paciente: folio + fecha de nacimiento + código por SMS; solo visitas (fecha, sede, servicio) | Sin acceso a notas ni antecedentes; límite de intentos (Valkey) |
| BB-31 | Consulta asistida en la jornada para pacientes sin celular | Captura muestra el historial sin datos clínicos |
| BB-32 | Aviso de privacidad y registro de consentimiento por paciente | El consentimiento queda ligado a la visita |
| BB-33 | Integración con el Reto 4 (resultados de Papanicolaou ligados al folio) | Diseño de API acordado |

### E10 · Piloto con EIRA
| ID | Ticket | Aceptación |
|---|---|---|
| BB-34 | Análisis jurídico (LFPDPPP, NOM-004-SSA3-2012) y contrato de hospedaje | Dictamen por escrito |
| BB-35 | Pentest y revisión de RLS por un tercero | Hallazgos críticos cerrados |
| BB-36 | Manual de una página + capacitación (30 min Captura, 15 min Médico) | Personal capacitado y prueba práctica aprobada |
| BB-37 | Jornada piloto en paralelo con el papel | Comparación de duplicados y tiempos (métricas de la sección 2.9) |
| BB-38 | Retrospectiva y ajustes | Lista priorizada para la versión 1.0 |

### E11 · Escalar
BB-39 Multi-organización (`org_id` en todas las tablas + RLS) · BB-40 Export FHIR (`Patient`, `Encounter`) · BB-41 Plan Gestionado (facturación) · BB-42 Guía de autohospedaje para otras OSC.

---

## 5. Riesgos del hackatón y plan B

| Riesgo | Señal | Plan B |
|---|---|---|
| El SQL de BB-02 falla | Error al crear funciones | Corregir la línea del error; si `unaccent` da problemas, `norm` usa `translate()` con las vocales acentuadas |
| Lovable rompe algo al iterar | La vista previa falla | Revertir a la edición anterior en el historial de Lovable; prompts pequeños |
| El *service worker* no carga offline | Al recargar sin red aparece «sin conexión» | Verificar `navigateFallback` y que la prueba sea en Cloudflare; si no, demostrar con la página abierta y explicarlo en «simulado» |
| Valkey no conecta | Timeout en la Edge Function | Abandonar BB-13; Valkey pasa a «diseñado» |
| Te quedas sin tiempo | 15:10 y BB-07 no está | Saltar a BB-08 con lo que haya, y presentar el offline como «implementado parcialmente» |
| La demo en vivo falla | — | Video de respaldo de BB-15 |
