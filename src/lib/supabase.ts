import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const KEY = SUPABASE_KEY

if (!SUPABASE_URL || !KEY) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (copia .env.example a .env.local).')
}

export const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** ¿El error de Supabase es por falta de red (y no un rechazo del servidor)? */
export function esErrorDeRed(error: { code?: string; message?: string } | null, status?: number): boolean {
  if (!error) return false
  if (status === 0) return true
  const m = error.message ?? ''
  return !error.code && (m.includes('Failed to fetch') || m.includes('NetworkError') || m.includes('Load failed') || m.includes('fetch'))
}
