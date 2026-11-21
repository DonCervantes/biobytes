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
