import Dexie, { type Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { estaEnLinea } from './conexion'
import { cifrar, descifrar, generarLlave, type Cifrado } from './cripto'
import { esErrorDeRed, supabase } from './supabase'
import type { CapturaP, RespuestaCaptura, Sede } from './tipos'

export type Estado = 'pendiente' | 'coincidencias' | 'conflicto' | 'error'

/** Captura ya descifrada, como la usa la interfaz. */
export interface Captura {
  client_id: string
  p: CapturaP
  estado: Estado
  respuesta?: RespuestaCaptura
  creada: number
}

/**
 * Captura tal como queda en IndexedDB. Solo van en claro los campos que hacen falta para
 * ordenar y contar (estado, fecha y el id opaco del expediente); los datos personales van en `pc`.
 */
interface CapturaGuardada {
  client_id: string
  estado: Estado
  creada: number
  paciente_id: string | null
  pc: Cifrado // { p, respuesta } cifrado
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

interface PacienteGuardado { id: string; pc: Cifrado }
interface Meta { id: string; v: CryptoKey }

class DB extends Dexie {
  cola!: Table<CapturaGuardada, string>
  padron!: Table<PacienteGuardado, string>
  sedes!: Table<Sede, number>
  meta!: Table<Meta, string>
  constructor() {
    super('biobytes')
    this.version(1).stores({ cola: 'client_id, estado, creada', padron: 'id, folio', sedes: 'id' })
    // v2 (BB-10): cola y padrón cifrados. Lo guardado en claro por la v1 se descarta
    // (el padrón se vuelve a descargar al iniciar sesión).
    this.version(2)
      .stores({ cola: 'client_id, estado, creada, paciente_id', padron: 'id', sedes: 'id', meta: 'id' })
      .upgrade(async (tx) => {
        await tx.table('padron').clear()
        await tx.table('cola').clear()
      })
  }
}
export const db = new DB()

// ---------------------------------------------------------------- llave
let llaveEnCurso: Promise<CryptoKey> | null = null
function llave(): Promise<CryptoKey> {
  llaveEnCurso ??= (async () => {
    const m = await db.meta.get('llave')
    if (m) return m.v
    const nueva = await generarLlave()
    await db.meta.put({ id: 'llave', v: nueva })
    return nueva
  })().catch((e) => { llaveEnCurso = null; throw e })
  return llaveEnCurso
}

async function guardar(c: Captura) {
  const pc = await cifrar(await llave(), { p: c.p, respuesta: c.respuesta })
  await db.cola.put({ client_id: c.client_id, estado: c.estado, creada: c.creada, paciente_id: c.p.paciente_id ?? null, pc })
}

async function abrir(g: CapturaGuardada): Promise<Captura | null> {
  try {
    const { p, respuesta } = await descifrar<{ p: CapturaP; respuesta?: RespuestaCaptura }>(await llave(), g.pc)
    return { client_id: g.client_id, estado: g.estado, creada: g.creada, p, respuesta }
  } catch {
    return null // cifrada con una llave que ya no existe: ilegible
  }
}

export async function abrirCapturas(gs: CapturaGuardada[]): Promise<Captura[]> {
  return (await Promise.all(gs.map(abrir))).filter((c): c is Captura => c !== null)
}

async function leerCaptura(client_id: string) {
  const g = await db.cola.get(client_id)
  return g ? abrir(g) : null
}

/** Capturas descifradas que cumplen la consulta, y se actualizan solas cuando cambia la cola. */
export function useCapturas(consulta: () => Promise<CapturaGuardada[]>, deps: unknown[]): Captura[] {
  // La consulta a Dexie es reactiva; el descifrado (WebCrypto) se hace aparte, fuera de liveQuery.
  const crudas = useLiveQuery(consulta, deps)
  const [capturas, setCapturas] = useState<Captura[]>([])
  useEffect(() => {
    let vigente = true
    void abrirCapturas(crudas ?? []).then((c) => { if (vigente) setCapturas(c) })
    return () => { vigente = false }
  }, [crudas])
  return capturas
}

// ---------------------------------------------------------------- padrón local
export async function leerPadron(): Promise<PacienteLocal[]> {
  const k = await llave()
  const filas = await db.padron.toArray()
  const res = await Promise.all(filas.map((f) => descifrar<PacienteLocal>(k, f.pc).catch(() => null)))
  return res.filter((p): p is PacienteLocal => p !== null)
}

export async function pacienteLocal(id: string): Promise<PacienteLocal | null> {
  const f = await db.padron.get(id)
  if (!f) return null
  return descifrar<PacienteLocal>(await llave(), f.pc).catch(() => null)
}

export async function descargarPadron(municipio?: string) {
  const { data, error } = await supabase.rpc('padron_offline', { p_municipio: municipio ?? null })
  if (error || !data) return
  const k = await llave()
  // Se cifra antes de abrir la transacción (WebCrypto no puede ir dentro de una transacción de IndexedDB).
  const filas = await Promise.all((data as PacienteLocal[]).map(async (p) => ({ id: p.id, pc: await cifrar(k, p) })))
  await db.transaction('rw', db.padron, async () => {
    await db.padron.clear()
    await db.padron.bulkPut(filas)
  })
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

// ---------------------------------------------------------------- cola
function avisar(m: string) {
  window.dispatchEvent(new CustomEvent('biobytes:aviso', { detail: m }))
}

/**
 * Guarda la captura (cifrada) en la cola y trata de enviarla.
 * Devuelve la respuesta del servidor para ESTA captura, o undefined si no hubo red
 * (queda «Pendiente de enviar» y se manda sola al volver la conexión).
 */
export async function enviarCaptura(p: CapturaP): Promise<RespuestaCaptura | undefined> {
  p.origen = p.origen ?? (estaEnLinea() ? 'en_linea' : 'sin_conexion')
  await guardar({ client_id: p.client_id, p, estado: 'pendiente', creada: Date.now() })
  const resultados = await sincronizar()
  const r = resultados.get(p.client_id)
  if (!r) {
    // No llegó al servidor: queda marcada como capturada sin conexión.
    const c = await leerCaptura(p.client_id)
    if (c && c.estado === 'pendiente' && c.p.origen !== 'sin_conexion') {
      await guardar({ ...c, p: { ...c.p, origen: 'sin_conexion' } })
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
  const pendientes = await abrirCapturas(await db.cola.where('estado').equals('pendiente').sortBy('creada'))
  // BB-11: tras horas sin red el token ya venció; getSession() lo renueva con el refresh token
  // antes de enviar, así no hace falta volver a iniciar sesión.
  if (pendientes.length > 0) await supabase.auth.getSession().catch(() => undefined)
  if (MODO_EDGE) await correrPorLotes(pendientes, resultados)
  else for (const c of pendientes) {
    const { etiqueta: _e, ...p } = c.p // descifrada justo antes de enviar
    const { data, error, status } = await supabase.rpc('registrar_captura', { p })
    if (error) {
      if (esErrorDeRed(error, status)) break // sin red: se detiene, nada se pierde
      if (status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303' || /JWT/i.test(error.message)) {
        avisar('Tu sesión expiró. Inicia sesión de nuevo; la captura sigue guardada en este dispositivo.')
        break
      }
      const r: RespuestaCaptura = { client_id: c.client_id, estado: 'error', mensaje: error.message }
      await guardar({ ...c, estado: 'error', respuesta: r })
      resultados.set(c.client_id, r)
      continue
    }
    const r = data as RespuestaCaptura
    if (r.estado === 'ok') await db.cola.delete(c.client_id)
    else await guardar({ ...c, estado: r.estado, respuesta: r })
    resultados.set(c.client_id, r)
  }
  if (resultados.size > 0) {
    // Con lo nuevo ya en el servidor, se refresca el padrón local (versiones y teléfonos).
    if ([...resultados.values()].some((r) => r.estado === 'ok')) void descargarPadron()
    window.dispatchEvent(new CustomEvent('biobytes:sincronizado'))
  }
  return resultados
}

// BB-13 · Con VITE_SYNC_MODE=edge la cola se manda en lotes a la Edge Function `sync`
// (idempotencia rápida y límite de intentos en Valkey). Sin la variable, RPC directo, una por una.
const MODO_EDGE = import.meta.env.VITE_SYNC_MODE === 'edge'
const TAM_LOTE = 20

async function aplicarResultado(c: Captura, r: RespuestaCaptura) {
  if (r.estado === 'ok') await db.cola.delete(c.client_id)
  else await guardar({ ...c, estado: r.estado, respuesta: r })
}

async function correrPorLotes(pendientes: Captura[], resultados: Map<string, RespuestaCaptura>) {
  for (let i = 0; i < pendientes.length; i += TAM_LOTE) {
    const lote = pendientes.slice(i, i + TAM_LOTE)
    const capturas = lote.map(({ p: { etiqueta: _e, ...p } }) => p) // descifradas justo antes de enviar
    const { data, error } = await supabase.functions.invoke('sync', { body: { capturas } })
    if (error) {
      const status = (error as { context?: Response }).context?.status
      if (status === 401) {
        avisar('Tu sesión expiró. Inicia sesión de nuevo; la captura sigue guardada en este dispositivo.')
      } else if (status === 429) {
        avisar('Demasiadas capturas por minuto. Se enviarán solas en un momento.')
      }
      return // sin red, sesión vencida o límite: se detiene, nada se pierde
    }
    const porId = new Map<string, RespuestaCaptura>(
      ((data as { resultados: RespuestaCaptura[] }).resultados ?? []).map((r) => [r.client_id, r]))
    for (const c of lote) {
      const r = porId.get(c.client_id)
      if (!r) continue // sin respuesta para esta captura: se queda pendiente
      await aplicarResultado(c, r)
      resultados.set(c.client_id, r)
    }
  }
}

/** Reenvía tras una decisión humana (coincidencias o conflicto) con el MISMO client_id. */
export async function decidir(client_id: string, cambios: Partial<CapturaP>) {
  const c = await leerCaptura(client_id)
  if (!c) return undefined
  await guardar({ ...c, p: { ...c.p, ...cambios }, estado: 'pendiente', respuesta: undefined })
  return (await sincronizar()).get(client_id)
}

export async function reintentar(client_id: string) {
  const c = await leerCaptura(client_id)
  if (!c) return undefined
  await guardar({ ...c, estado: 'pendiente', respuesta: undefined })
  return (await sincronizar()).get(client_id)
}

export async function descartar(client_id: string) {
  await db.cola.delete(client_id)
}

export async function existeEnCola(client_id: string) {
  return (await db.cola.get(client_id)) !== undefined
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

/** Borra todo lo local, incluida la llave de cifrado. Se usa al cerrar sesión. */
export async function borrarDatosLocales() {
  // Vaciar en una transacción (db.delete() puede quedar bloqueado por otra pestaña abierta).
  await db.transaction('rw', [db.cola, db.padron, db.sedes, db.meta], async () => {
    await Promise.all([db.cola.clear(), db.padron.clear(), db.sedes.clear(), db.meta.clear()])
  })
  llaveEnCurso = null // la próxima sesión genera una llave nueva
}
