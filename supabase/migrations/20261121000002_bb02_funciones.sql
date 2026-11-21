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

-- Endurecimiento: Supabase concede EXECUTE a authenticated por omisión en funciones nuevas.
-- log_bitacora solo se invoca desde otras funciones security definer.
revoke execute on function log_bitacora(text, text, uuid, jsonb) from authenticated, anon, public;
