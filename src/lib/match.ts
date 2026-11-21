// Espejo en el dispositivo de buscar_coincidencias (servidor). El resultado es PRELIMINAR:
// la palabra final la tienen el servidor y una persona al sincronizar.
import type { PacienteLocal } from './cola'
import type { Candidata, DatosPaciente } from './tipos'
import { enmascararTel } from './utils'

export const norm = (t = '') =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

export function lev(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

const sim = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length, 1)

export function coincidenciasLocales(q: DatosPaciente, padron: PacienteLocal[]): Candidata[] {
  const corto = norm(`${q.nombre ?? ''} ${q.apellido_paterno ?? ''}`)
  const completo = norm(`${q.nombre ?? ''} ${q.apellido_paterno ?? ''} ${q.apellido_materno ?? ''}`)
  const res: Candidata[] = []
  for (const p of padron) {
    const s = Math.max(
      sim(norm(`${p.nombre} ${p.apellido_paterno}`), corto),
      sim(norm(`${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`), completo),
    )
    const mC = !!q.curp && p.curp === q.curp
    const mF = p.fecha_nacimiento === q.fecha_nacimiento
    const mT = !!q.telefono && p.telefono === q.telefono
    if (!(mC || mF || mT || s >= 0.8)) continue
    const razones = [
      mC && 'Misma CURP',
      mF && 'Misma fecha de nacimiento',
      mT && 'Mismo teléfono',
      s === 1 ? 'Mismo nombre (sin acentos)' : s >= 0.8 ? 'Nombre parecido' : null,
      s >= 0.8 && !mF && 'Fecha de nacimiento distinta',
    ].filter(Boolean) as string[]
    res.push({
      paciente_id: p.id,
      folio: p.folio,
      nombre_completo: [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' '),
      fecha_nacimiento: p.fecha_nacimiento,
      municipio: p.municipio,
      telefono_mask: p.telefono ? enmascararTel(p.telefono) : null,
      nivel: mC || (mF && s >= 0.8) || (mT && s >= 0.8) ? 'alta' : 'posible',
      razones,
      preliminar: true,
    })
  }
  return res.sort((a, b) =>
    (a.nivel === 'alta' ? 0 : 1) - (b.nivel === 'alta' ? 0 : 1) || b.razones.length - a.razones.length)
}

/** Búsqueda en el padrón local (sin red): nombre con o sin acentos, folio, CURP o teléfono. */
export function buscarLocal(q: string, padron: PacienteLocal[]): PacienteLocal[] {
  const t = q.trim()
  if (!t) return padron
  const n = norm(t)
  const dig = t.replace(/\D/g, '')
  return padron.filter((p) =>
    p.folio.toLowerCase().includes(t.toLowerCase()) ||
    (p.curp && p.curp === t.toUpperCase()) ||
    (dig.length >= 4 && p.telefono === dig) ||
    norm(`${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`).includes(n) ||
    (n.length >= 4 && sim(norm(`${p.nombre} ${p.apellido_paterno}`), n) >= 0.8))
}
