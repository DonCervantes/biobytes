-- =====================================================================================
-- BB-16 · Pruebas automáticas de la base de datos (salida TAP)
--
-- Cubren las reglas de identidad (T1–T5 del backlog), validaciones, permisos por rol,
-- bitácora encadenada e impresión.
--
-- NO DEJAN RASTRO: todo corre dentro de un bloque que al final lanza una excepción
-- centinela y se deshace (usuarias de prueba, capturas, cambios y entradas de bitácora).
-- Lo único que no es transaccional en Postgres es la secuencia de folios; se restaura al
-- final. No las corras durante una jornada real (podría chocar un folio recién asignado).
--
-- Cómo correrlas:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/bb16_base.test.sql
-- o pegando el archivo en el SQL Editor de Supabase. La salida es TAP: «ok N - …» o
-- «not ok N - …», y una línea final «1..N».
-- =====================================================================================

-- Una aserción: «ok - descripción» o «not ok - descripción».
create or replace function pg_temp.t(c boolean, d text) returns text
language sql as $$ select case when coalesce(c, false) then 'ok' else 'not ok' end || ' - ' || d $$;

-- Actuar como una usuaria con sesión (simula el JWT que manda Supabase).
create or replace function pg_temp.como(u uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create or replace function pg_temp.bb16() returns setof text
language plpgsql as $fn$
declare
  tap text[] := '{}';
  u_cap uuid := gen_random_uuid();
  u_med uuid := gen_random_uuid();
  u_aud uuid := gen_random_uuid();
  maria uuid;
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_base int; v_cnt int; v_cnt2 int; v_id bigint;
  v_res jsonb; v_res2 jsonb; v_exp jsonb; v_err text; v_err2 text; v_txt text;
  p1 jsonb; p2 jsonb; cid1 uuid := gen_random_uuid();
  r record;
  seq_last bigint; seq_called boolean;
begin
  select last_value, is_called into seq_last, seq_called from folio_seq;

  begin
    ------------------------------------------------------------------ preparación
    insert into auth.users (id, instance_id, aud, role, email) values
      (u_cap, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bb16-captura@prueba.local'),
      (u_med, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bb16-medico@prueba.local'),
      (u_aud, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bb16-auditor@prueba.local');
    insert into perfiles (user_id, nombre, rol) values
      (u_cap, 'BB16 Captura', 'captura'), (u_med, 'BB16 Médica', 'medico'), (u_aud, 'BB16 Auditor', 'auditor');
    insert into sedes (id, nombre, municipio) values (1, 'Sede de prueba', 'Zapotlán el Grande') on conflict (id) do nothing;
    insert into pacientes (folio, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, telefono, municipio) values
      ('EIRA-900101', 'María',   'Ejemplo', 'López', '1980-03-14', '3410000001', 'Zapotlán el Grande'),
      ('EIRA-900102', 'Mariana', 'Ejemplo', 'López', '1986-07-02', null,         'Zapotlán el Grande'),
      ('EIRA-900103', 'María',   'Ejempló', 'Ruiz',  '1972-11-30', null,         'Tamazula de Gordiano')
    on conflict (folio) do nothing;
    select id into maria from pacientes where folio = 'EIRA-900101';
    update pacientes set telefono = '3410000001', correo = null, version = 1 where id = maria; -- estado conocido
    insert into paciente_clinico (paciente_id, antecedentes) values (maria, 'Antecedente de prueba BB16')
      on conflict (paciente_id) do update set antecedentes = excluded.antecedentes;
    select count(*) into v_base from visitas where paciente_id = maria;

    tap := tap || pg_temp.t(norm('María  Ejempló') = 'maria ejemplo', 'norm() quita acentos, signos y espacios dobles');

    ------------------------------------------------------------------ T1 · coincidencias
    perform pg_temp.como(u_cap);
    select coalesce(jsonb_object_agg(folio, jsonb_build_object('nivel', nivel, 'razones', razones)), '{}') into v_res
      from buscar_coincidencias('Maria', 'Ejemplo', null, '1980-03-14', null, null);
    reset role;
    tap := tap || pg_temp.t(v_res->'EIRA-900101'->>'nivel' = 'alta', 'T1 · 900101 sale como coincidencia «alta»');
    tap := tap || pg_temp.t((v_res->'EIRA-900101'->'razones') ? 'Misma fecha de nacimiento'
                            and (v_res->'EIRA-900101'->'razones') ? 'Mismo nombre (sin acentos)',
                            'T1 · razones de 900101: misma fecha y mismo nombre sin acentos');
    tap := tap || pg_temp.t(v_res->'EIRA-900102'->>'nivel' = 'posible', 'T1 · 900102 (Mariana) sale como «posible»');
    tap := tap || pg_temp.t(v_res->'EIRA-900103'->>'nivel' = 'posible', 'T1 · 900103 (otra fecha) sale como «posible»');

    ------------------------------------------------------------------ T2 · alta sin decisión
    p1 := jsonb_build_object('client_id', cid1, 'tipo', 'alta',
      'paciente', jsonb_build_object('nombre', 'Maria', 'apellido_paterno', 'Ejemplo',
                                     'fecha_nacimiento', '1980-03-14', 'telefono', '3419998877'),
      'visita', jsonb_build_object('sede_id', 1, 'servicio', 'ultrasonido_mama'));
    select count(*) into v_cnt from pacientes;
    perform pg_temp.como(u_cap);
    v_res := registrar_captura(p1);
    reset role;
    tap := tap || pg_temp.t(v_res->>'estado' = 'coincidencias', 'T2 · alta sin decisión devuelve «coincidencias»');
    tap := tap || pg_temp.t((select count(*) from pacientes) = v_cnt, 'T2 · y no crea ningún expediente');
    tap := tap || pg_temp.t(not exists (select 1 from captura_sync where client_id = cid1),
                            'T2 · la respuesta no se guarda como definitiva (la misma captura vuelve con su decisión)');

    ------------------------------------------------------------------ T3 · «Sí, es ella»
    perform pg_temp.como(u_cap);
    v_res := registrar_captura(p1 || jsonb_build_object('decision', 'vincular', 'paciente_id', maria));
    reset role;
    tap := tap || pg_temp.t(v_res->>'estado' = 'ok' and v_res->>'folio' = 'EIRA-900101', 'T3 · vincular devuelve ok con el folio 900101');
    tap := tap || pg_temp.t((select telefono from pacientes where id = maria) = '3419998877', 'T3 · el teléfono nuevo se aplica en la misma operación');
    tap := tap || pg_temp.t((select version from pacientes where id = maria) = 2, 'T3 · la versión del expediente sube a 2');
    tap := tap || pg_temp.t(exists (select 1 from paciente_cambios where paciente_id = maria and campo = 'telefono'
                                     and valor_anterior = '3410000001' and valor_nuevo = '3419998877'),
                            'T3 · el valor anterior queda en el historial (nada se borra)');
    tap := tap || pg_temp.t((select count(*) from visitas where paciente_id = maria) = v_base + 1, 'T3 · la visita de hoy se agrega al expediente');

    ------------------------------------------------------------------ T4 · idempotencia
    perform pg_temp.como(u_cap);
    v_res2 := registrar_captura(p1 || jsonb_build_object('decision', 'vincular', 'paciente_id', maria));
    v_exp := abrir_expediente(maria);
    reset role;
    tap := tap || pg_temp.t(v_res2 = v_res, 'T4 · reenviar la misma captura devuelve la misma respuesta');
    tap := tap || pg_temp.t((select count(*) from visitas where paciente_id = maria) = v_base + 1, 'T4 · y no duplica la visita');
    tap := tap || pg_temp.t(v_exp->'antecedentes' = 'null'::jsonb, 'Captura abre el expediente sin antecedentes');
    tap := tap || pg_temp.t(jsonb_array_length(v_exp->'cambios') = 1, 'El expediente muestra el cambio de teléfono');

    ------------------------------------------------------------------ T5 · conflicto de versión
    perform pg_temp.como(u_cap);
    v_res := registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'cambio', 'version_base', 1,
                                                  'paciente_id', maria, 'paciente', jsonb_build_object('correo', 'maria@ejemplo.mx')));
    begin
      perform registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'cambio', 'version_base', 2,
                                                   'paciente_id', maria, 'paciente', jsonb_build_object('telefono', '3419998877')));
      v_err := null;
    exception when others then v_err := sqlerrm; end;
    v_res2 := registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'cambio', 'version_base', 2,
                                                   'paciente_id', maria, 'paciente', jsonb_build_object('correo', 'maria@ejemplo.mx')));
    reset role;
    tap := tap || pg_temp.t(v_res->>'estado' = 'conflicto' and (v_res->'servidor'->>'version')::int = 2,
                            'T5 · un cambio con versión vieja devuelve «conflicto» con la versión actual');
    tap := tap || pg_temp.t(v_err = 'No cambiaste ningún dato.', 'Un cambio sin diferencias se rechaza: «No cambiaste ningún dato.»');
    tap := tap || pg_temp.t(v_res2->>'estado' = 'ok' and (select version from pacientes where id = maria) = 3,
                            'Un cambio con la versión correcta se aplica y la versión sube a 3');

    ------------------------------------------------------------------ alta nueva y validaciones
    p2 := jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'alta',
      'paciente', jsonb_build_object('nombre', 'Prueba', 'apellido_paterno', 'Dieciseis', 'fecha_nacimiento', '1990-01-01',
                                     'curp', 'PUDI900101MJCRRB01', 'antecedentes', 'Antecedente capturado en el alta'),
      'visita', null);
    perform pg_temp.como(u_cap);
    v_res := registrar_captura(p2);
    begin  -- misma CURP, otra persona, decidiendo «nueva»
      perform registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'alta', 'decision', 'nueva',
        'paciente', jsonb_build_object('nombre', 'Otra', 'apellido_paterno', 'Persona', 'fecha_nacimiento', '1991-02-02',
                                       'curp', 'PUDI900101MJCRRB01')));
      v_err := null;
    exception when others then v_err := sqlerrm; end;
    reset role;
    tap := tap || pg_temp.t(v_res->>'estado' = 'ok' and v_res->>'folio' ~ '^EIRA-\d{6}$', 'Alta sin coincidencias crea un folio EIRA-######');
    tap := tap || pg_temp.t((select antecedentes from paciente_clinico where paciente_id = (v_res->>'paciente_id')::uuid)
                            = 'Antecedente capturado en el alta', 'Captura escribe antecedentes solo en el alta (quedan guardados)');
    tap := tap || pg_temp.t(v_err like 'La CURP ya pertenece al expediente EIRA-%', 'Una CURP ya usada se bloquea indicando el folio');

    perform pg_temp.como(u_cap);
    begin perform registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'visita', 'paciente_id', maria,
            'visita', jsonb_build_object('fecha', hoy + 1, 'sede_id', 1, 'servicio', 'papanicolaou'))); v_err := null;
    exception when others then v_err := sqlerrm; end;
    begin perform registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'alta', 'decision', 'nueva',
            'paciente', jsonb_build_object('nombre', 'X', 'apellido_paterno', 'Y', 'fecha_nacimiento', '2999-01-01'))); v_err2 := null;
    exception when others then v_err2 := sqlerrm; end;
    reset role;
    tap := tap || pg_temp.t(v_err = 'La fecha de la visita no puede ser futura.', 'Visita con fecha futura (hora de CDMX) se rechaza');
    tap := tap || pg_temp.t(v_err2 = 'Fecha de nacimiento fuera de rango.', 'Fecha de nacimiento futura se rechaza');

    perform pg_temp.como(u_cap);
    begin perform registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'alta', 'decision', 'nueva',
            'paciente', jsonb_build_object('nombre', 'X', 'apellido_paterno', 'Y', 'fecha_nacimiento', '1990-01-01', 'curp', 'ABC'))); v_err := null;
    exception when others then v_err := sqlerrm; end;
    begin perform registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'alta', 'decision', 'nueva',
            'paciente', jsonb_build_object('nombre', 'X', 'apellido_paterno', 'Y', 'fecha_nacimiento', '1990-01-01', 'telefono', '12345'))); v_err2 := null;
    exception when others then v_err2 := sqlerrm; end;
    begin perform registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'alta', 'decision', 'nueva',
            'paciente', jsonb_build_object('nombre', ' ', 'apellido_paterno', 'Y', 'fecha_nacimiento', '1990-01-01'))); v_txt := null;
    exception when others then v_txt := sqlerrm; end;
    reset role;
    tap := tap || pg_temp.t(v_err = 'CURP inválida (18 caracteres).', 'CURP con formato inválido se rechaza');
    tap := tap || pg_temp.t(v_err2 = 'El teléfono debe tener 10 dígitos.', 'Teléfono que no tiene 10 dígitos se rechaza');
    tap := tap || pg_temp.t(v_txt = 'Escribe el nombre.', 'Nombre vacío se rechaza');

    ------------------------------------------------------------------ padrón
    perform pg_temp.como(u_cap);
    select count(*) into v_cnt from buscar_padron('maria', 100, 0) where folio in ('EIRA-900101', 'EIRA-900102', 'EIRA-900103');
    select count(*) into v_cnt2 from buscar_padron('3419998877', 25, 0) where folio = 'EIRA-900101';
    select string_agg(folio, ',') into v_txt from buscar_padron('EIRA-900102', 25, 0);
    reset role;
    tap := tap || pg_temp.t(v_cnt = 3, 'Padrón: «maria» sin acento encuentra a las 3 pacientes del reto');
    tap := tap || pg_temp.t(v_cnt2 = 1, 'Padrón: busca por teléfono');
    tap := tap || pg_temp.t(v_txt = 'EIRA-900102', 'Padrón: busca por folio');

    ------------------------------------------------------------------ permisos de Captura
    perform pg_temp.como(u_cap);
    select count(*) into v_cnt from pacientes;
    select count(*) into v_cnt2 from paciente_clinico;
    select count(*) into v_id from bitacora;
    begin perform log_bitacora('falsa', 'x', null, '{}'); v_err := null; exception when others then v_err := sqlerrm; end;
    reset role;
    tap := tap || pg_temp.t(v_cnt = 0, 'Captura no puede leer la tabla pacientes directamente (solo vía funciones)');
    tap := tap || pg_temp.t(v_cnt2 = 0, 'Captura no puede leer antecedentes (paciente_clinico)');
    tap := tap || pg_temp.t(v_id = 0, 'Captura no puede leer la bitácora');
    tap := tap || pg_temp.t(v_err like 'permission denied%', 'Nadie con sesión puede escribir en la bitácora directamente (log_bitacora)');

    ------------------------------------------------------------------ permisos del personal médico
    perform pg_temp.como(u_med);
    begin perform registrar_captura(jsonb_build_object('client_id', gen_random_uuid(), 'tipo', 'visita', 'paciente_id', maria,
            'visita', jsonb_build_object('sede_id', 1, 'servicio', 'papanicolaou'))); v_err := null;
    exception when others then v_err := sqlerrm; end;
    v_exp := abrir_expediente(maria);
    select count(*) into v_cnt from paciente_clinico where paciente_id = maria;
    select count(*) into v_cnt2 from buscar_coincidencias('Maria', 'Ejemplo', null, '1980-03-14', null, null);
    reset role;
    tap := tap || pg_temp.t(v_err = 'No tienes permiso para registrar.', 'Médico no puede registrar capturas');
    tap := tap || pg_temp.t(v_exp->>'antecedentes' = 'Antecedente de prueba BB16', 'Médico ve los antecedentes al abrir el expediente');
    tap := tap || pg_temp.t(v_cnt = 1, 'Médico puede leer paciente_clinico');
    tap := tap || pg_temp.t(v_cnt2 = 0, 'Médico no usa la búsqueda de coincidencias (es tarea de identidad)');

    ------------------------------------------------------------------ impresión (BB-12b)
    select count(*) into v_cnt from bitacora where accion = 'impresion' and entidad_id = maria;
    perform pg_temp.como(u_cap);
    perform registrar_impresion(maria, 'comprobante');
    reset role;
    perform pg_temp.como(u_aud);
    begin perform registrar_impresion(maria, 'expediente'); v_err := null; exception when others then v_err := sqlerrm; end;
    reset role;
    tap := tap || pg_temp.t((select count(*) from bitacora where accion = 'impresion' and entidad_id = maria) = v_cnt + 1,
                            'Cada impresión queda en la bitácora');
    tap := tap || pg_temp.t(v_err = 'forbidden', 'Auditoría no puede imprimir expedientes');

    ------------------------------------------------------------------ auditoría y bitácora encadenada
    perform pg_temp.como(u_aud);
    begin perform abrir_expediente(maria); v_err := null; exception when others then v_err := sqlerrm; end;
    select count(*) into v_cnt from bitacora;
    select * into r from verificar_bitacora();
    reset role;
    tap := tap || pg_temp.t(v_err = 'forbidden', 'Auditoría no puede abrir expedientes');
    tap := tap || pg_temp.t(v_cnt > 0, 'Auditoría sí lee la bitácora');
    tap := tap || pg_temp.t(r.ok, 'La cadena HMAC de la bitácora está íntegra');
    tap := tap || pg_temp.t(not exists (select 1 from bitacora where detalle::text ~* 'maria|ejemplo|3419998877'),
                            'La bitácora guarda ids, nunca nombres ni teléfonos');

    select max(id) into v_id from bitacora;
    update bitacora set detalle = '{"alterado": true}' where id = v_id;  -- alteración a mano
    perform pg_temp.como(u_aud);
    select * into r from verificar_bitacora();
    reset role;
    tap := tap || pg_temp.t(not r.ok and r.primera_fila_rota = v_id, 'Si alguien altera una fila, «Verificar integridad» marca esa fila');

    ------------------------------------------------------------------ sin sesión (anon)
    set local role anon;
    begin perform buscar_padron('maria', 25, 0); v_err := null; exception when others then v_err := sqlerrm; end;
    begin perform registrar_captura('{}'::jsonb); v_err2 := null; exception when others then v_err2 := sqlerrm; end;
    reset role;
    tap := tap || pg_temp.t(v_err like 'permission denied%', 'Sin sesión no se puede buscar en el padrón');
    tap := tap || pg_temp.t(v_err2 like 'permission denied%', 'Sin sesión no se puede registrar');

    raise exception 'BB16_DESHACER';  -- centinela: deshace todo lo de arriba
  exception when others then
    if sqlerrm <> 'BB16_DESHACER' then
      tap := tap || ('not ok - la prueba se detuvo por un error inesperado: ' || sqlerrm);
    end if;
  end;

  perform setval('folio_seq', seq_last, seq_called);  -- la secuencia no es transaccional

  return query
    select regexp_replace(t.linea, '^(not ok|ok) ', '\1 ' || t.n || ' ')
    from unnest(tap) with ordinality as t(linea, n);
  return next '1..' || coalesce(array_length(tap, 1), 0);
end $fn$;

select * from pg_temp.bb16();
