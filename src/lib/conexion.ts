import { useSyncExternalStore } from 'react'
import { SUPABASE_KEY, SUPABASE_URL } from './supabase'

// navigator.onLine no basta (puede haber Wi-Fi sin internet): cada 20 s se hace un HEAD
// a /auth/v1/health de Supabase con 4 s de límite.
let enLinea = typeof navigator === 'undefined' ? true : navigator.onLine
const oyentes = new Set<() => void>()

function fijar(v: boolean) {
  if (v === enLinea) return
  enLinea = v
  oyentes.forEach((f) => f())
}

export async function comprobarConexion(): Promise<boolean> {
  if (!navigator.onLine) {
    fijar(false)
    return false
  }
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/health?apikey=${encodeURIComponent(SUPABASE_KEY)}`, {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(4000),
    })
    fijar(true)
    return true
  } catch {
    fijar(false)
    return false
  }
}

let iniciado = false
function iniciar() {
  if (iniciado) return
  iniciado = true
  window.addEventListener('online', () => void comprobarConexion())
  window.addEventListener('offline', () => fijar(false))
  setInterval(() => void comprobarConexion(), 20_000)
  void comprobarConexion()
}

export function estaEnLinea() {
  return enLinea
}

export function useConexion(): boolean {
  iniciar()
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => enLinea,
  )
}
