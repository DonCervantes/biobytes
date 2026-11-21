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
