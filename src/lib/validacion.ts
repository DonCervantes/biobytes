// Mismas reglas y mensajes que registrar_captura en el servidor (§2.7 de BioBytes.md).
import type { CapturaP, DatosPaciente } from './tipos'
import { hoyCDMX, soloDigitos } from './utils'

export const RE_CURP = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface FormAlta {
  nombre: string
  apellido_paterno: string
  apellido_materno: string
  fecha_nacimiento: string
  curp: string
  telefono: string
  correo: string
  municipio: string
  antecedentes: string
  con_visita: boolean
  fecha_visita: string
  sede_id: string
  servicio: string
}

const nulo = (s: string) => (s.trim() === '' ? null : s.trim())

export function validarTelefono(t: string): string | undefined {
  const d = soloDigitos(t)
  if (t.trim() !== '' && d.length !== 10) return 'El teléfono debe tener 10 dígitos.'
}

export function validarCorreo(c: string): string | undefined {
  if (c.trim() !== '' && !RE_CORREO.test(c.trim())) return 'Correo inválido.'
}

export function validarAlta(f: FormAlta) {
  const e: Partial<Record<keyof FormAlta, string>> = {}
  const hoy = hoyCDMX()
  if (!f.nombre.trim() || f.nombre.trim().length > 100) e.nombre = 'Escribe el nombre.'
  if (!f.apellido_paterno.trim()) e.apellido_paterno = 'Escribe el primer apellido.'
  if (!f.fecha_nacimiento || f.fecha_nacimiento < '1900-01-01' || f.fecha_nacimiento > hoy) {
    e.fecha_nacimiento = 'Fecha de nacimiento fuera de rango.'
  }
  const curp = f.curp.trim().toUpperCase()
  if (curp && !RE_CURP.test(curp)) e.curp = 'CURP inválida (18 caracteres).'
  const tel = validarTelefono(f.telefono)
  if (tel) e.telefono = tel
  const correo = validarCorreo(f.correo)
  if (correo) e.correo = correo
  if (f.con_visita) {
    if (!f.fecha_visita || f.fecha_visita > hoy) e.fecha_visita = 'La fecha de la visita no puede ser futura.'
    if (!f.sede_id) e.sede_id = 'Elige la sede.'
    if (!f.servicio) e.servicio = 'Elige el servicio.'
  }

  const datos: DatosPaciente = {
    nombre: f.nombre.trim(),
    apellido_paterno: f.apellido_paterno.trim(),
    apellido_materno: nulo(f.apellido_materno),
    fecha_nacimiento: f.fecha_nacimiento,
    curp: curp || null,
    telefono: soloDigitos(f.telefono) || null,
    correo: nulo(f.correo),
    municipio: nulo(f.municipio),
    antecedentes: nulo(f.antecedentes),
  }
  const visita: CapturaP['visita'] = f.con_visita
    ? { fecha: f.fecha_visita, sede_id: Number(f.sede_id), servicio: f.servicio }
    : null
  return { errores: e, datos, visita }
}
