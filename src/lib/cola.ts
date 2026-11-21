import Dexie, { type Table } from 'dexie'
import { estaEnLinea } from './conexion'
import { esErrorDeRed, supabase } from './supabase'
import type { CapturaP, RespuestaCaptura, Sede } from './tipos'

export type Estado = 'pendiente' | 'coincidencias' | 'conflicto' | 'error'

export interface Captura {
  client_id: string
  p: CapturaP
  estado: Estado
  respuesta?: RespuestaCaptura
  creada: number
}

export interface PacienteLocal {
  id: string
  folio: string
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  fecha_nacimiento: string
  curp: string | null
  telefono: string | null
  municipio: string | null
  version: number
}

class DB extends Dexie {
  cola!: Table<Captura, string>
  padron!: Table<PacienteLocal, string>
  sedes!: Table<Sede, number>
  constructor() {
    super('biobytes')
    this.version(1).stores({ cola: 'client_id, estado, creada', padron: 'id, folio', sedes: 'id' })
  }
}
export const db = new DB()

function avisar(m: string) {
  window.dispatchEvent(new CustomEvent('biobytes:aviso', { detail: m }))
}

/**
 * Guarda la captura en la cola y trata de enviarla.
 * Devuelve la respuesta del servidor para ESTA captura, o undefined si no hubo red
 * (queda «Pendiente de enviar» y se manda sola al volver la conexión).
 */
export async function enviarCaptura(p: CapturaP): Promise<RespuestaCaptura | undefined> {
  p.origen = p.origen ?? (estaEnLinea() ? 'en_linea' : 'sin_conexion')
  await db.cola.put({ client_id: p.client_id, p, estado: 'pendiente', creada: Date.now() })
  const resultados = await sincronizar()
  const r = resultados.get(p.client_id)
  if (!r) {
    // No llegó al servidor: queda marcada como capturada sin conexión.
    const c = await db.cola.get(p.client_id)
    if (c && c.p.origen !== 'sin_conexion') {
      await db.cola.update(p.client_id, { p: { ...c.p, origen: 'sin_conexion' } })
    }
  }
  return r
}

// Las corridas se encadenan: nunca hay dos a la vez y ninguna llamada se pierde.
let cadena: Promise<unknown> = Promise.resolve()
export function sincronizar(): Promise<Map<string, RespuestaCaptura>> {
  const corrida = cadena.then(correr)
  cadena = corrida.catch(() => undefined)
  return corrida
}

async function correr(): Promise<Map<string, RespuestaCaptura>> {
  const resultados = new Map<string, RespuestaCaptura>()
  const pendientes = await db.cola.where('estado').equals('pendiente').sortBy('creada')
  for (const c of pendientes) {
    const { etiqueta: _e, ...p } = c.p
    const { data, error, status } = await supabase.rpc('registrar_captura', { p })
    if (error) {
      if (esErrorDeRed(error, status)) break // sin red: se detiene, nada se pierde
      if (status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303' || /JWT/i.test(error.message)) {
        avisar('Tu sesión expiró. Inicia sesión de nuevo; la captura sigue guardada en este dispositivo.')
        break
      }
      const r: RespuestaCaptura = { client_id: c.client_id, estado: 'error', mensaje: error.message }
      await db.cola.update(c.client_id, { estado: 'error', respuesta: r })
      resultados.set(c.client_id, r)
      continue
    }
    const r = data as RespuestaCaptura
    if (r.estado === 'ok') await db.cola.delete(c.client_id)
    else await db.cola.update(c.client_id, { estado: r.estado, respuesta: r })
    resultados.set(c.client_id, r)
  }
  if (resultados.size > 0) {
    // Con lo nuevo ya en el servidor, se refresca el padrón local (versiones y teléfonos).
    if ([...resultados.values()].some((r) => r.estado === 'ok')) void descargarPadron()
    window.dispatchEvent(new CustomEvent('biobytes:sincronizado'))
  }
  return resultados
}

/** Reenvía tras una decisión humana (coincidencias o conflicto) con el MISMO client_id. */
export async function decidir(client_id: string, cambios: Partial<CapturaP>) {
  const c = await db.cola.get(client_id)
  if (!c) return undefined
  await db.cola.update(client_id, { p: { ...c.p, ...cambios }, estado: 'pendiente', respuesta: undefined })
  const r = await sincronizar()
  return r.get(client_id)
}

export async function reintentar(client_id: string) {
  await db.cola.update(client_id, { estado: 'pendiente', respuesta: undefined })
  return (await sincronizar()).get(client_id)
}

export async function descartar(client_id: string) {
  await db.cola.delete(client_id)
}

export async function descargarPadron(municipio?: string) {
  const { data, error } = await supabase.rpc('padron_offline', { p_municipio: municipio ?? null })
  if (!error && data) {
    await db.transaction('rw', db.padron, async () => {
      await db.padron.clear()
      await db.padron.bulkPut(data as PacienteLocal[])
    })
  }
}

export async function descargarSedes() {
  const { data, error } = await supabase.from('sedes').select('id, nombre, municipio, localidad').order('id')
  if (!error && data) {
    await db.transaction('rw', db.sedes, async () => {
      await db.sedes.clear()
      await db.sedes.bulkPut(data as Sede[])
    })
  }
}

let iniciada = false
export function iniciarSincronizacion() {
  if (iniciada) return
  iniciada = true
  window.addEventListener('online', () => void sincronizar())
  setInterval(() => void sincronizar(), 30_000)
  void navigator.storage?.persist?.() // pedir que el navegador no borre la cola
  void sincronizar()
}

/** Borra todo lo local (cola, padrón y sedes). Se usa al cerrar sesión. */
export async function borrarDatosLocales() {
  // Vaciar en una transacción (db.delete() puede quedar bloqueado por otra pestaña abierta).
  await db.transaction('rw', db.cola, db.padron, db.sedes, async () => {
    await Promise.all([db.cola.clear(), db.padron.clear(), db.sedes.clear()])
  })
}
