```sql
delete from visitas where fecha > '2026-02-10';
delete from paciente_cambios; delete from captura_sync;
delete from paciente_clinico where paciente_id not in (select id from pacientes where folio like 'EIRA-9001%');
delete from pacientes where folio not in ('EIRA-900101','EIRA-900102','EIRA-900103');
update pacientes set telefono = '3410000001', version = 1 where folio = 'EIRA-900101';
-- La bitácora NO se borra (es la prueba de integridad).
