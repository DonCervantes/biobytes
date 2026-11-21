import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Fecha de hoy en America/Mexico_City, formato AAAA-MM-DD. */
export function hoyCDMX(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' sin pasar por Date (evita corrimientos de zona). */
export function fmtFecha(iso?: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** Marca de tiempo → 'DD/MM/AAAA HH:MM' en hora de CDMX. */
export function fmtFechaHora(ts: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts))
}

export function enmascararTel(t?: string | null): string {
  if (!t) return '—'
  return t.length === 10 ? `${t.slice(0, 2)}****${t.slice(-4)}` : t
}

export const SERVICIOS = [
  { valor: 'papanicolaou', etiqueta: 'Papanicolaou' },
  { valor: 'ultrasonido_mama', etiqueta: 'Ultrasonido de mama' },
  { valor: 'exploracion_mama', etiqueta: 'Exploración clínica de mama' },
  { valor: 'valoracion_nutricional', etiqueta: 'Valoración nutricional' },
  { valor: 'mastografia', etiqueta: 'Mastografía' },
] as const

export function etiquetaServicio(v: string): string {
  return SERVICIOS.find((s) => s.valor === v)?.etiqueta ?? v
}

export const CAMPOS: Record<string, string> = {
  telefono: 'Teléfono',
  correo: 'Correo',
  municipio: 'Municipio',
  localidad: 'Localidad',
}

export const ROLES: Record<string, string> = {
  captura: 'Captura',
  medico: 'Personal médico',
  coordinacion: 'Coordinación',
  admin: 'Administración',
  auditor: 'Auditoría',
}

export function soloDigitos(t: string): string {
  return t.replace(/\D/g, '')
}
