-- BB-12b · Cada impresión (expediente o comprobante) queda en la bitácora.
create or replace function public.registrar_impresion(p_id uuid, p_tipo text default 'expediente')
returns void language plpgsql security definer set search_path = public as $$
declare r rol := rol_actual();
begin
  if r is null or r not in ('captura','medico','coordinacion','admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_tipo not in ('expediente','comprobante') then raise exception 'Tipo de impresión inválido.'; end if;
  if not exists (select 1 from pacientes where id = p_id) then raise exception 'Expediente no encontrado.'; end if;
  perform log_bitacora('impresion', 'paciente', p_id, jsonb_build_object('tipo', p_tipo));
end $$;

revoke execute on function registrar_impresion(uuid, text) from anon, public;
grant execute on function registrar_impresion(uuid, text) to authenticated;
