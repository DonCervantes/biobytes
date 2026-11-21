// BB-13 · Edge Function `sync`: recibe lotes de la cola y llama a registrar_captura con el JWT de la usuaria.
// Valkey es una capa RÁPIDA y OPCIONAL (idempotencia + límite de intentos). La verdad vive en Postgres
// (captura_sync): si Valkey no está configurado o no responde, todo sigue funcionando (`valkey: false`).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { connect, type Redis } from 'https://deno.land/x/redis@v0.32.4/mod.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MAX_LOTE = 20
const MAX_POR_MINUTO = 60
const TTL_IDEM = 60 * 60 * 24 // 24 h

// ---------------------------------------------------------------- Valkey (perezoso, con tiempo límite)
let valkey: Redis | null = null
let ultimoIntento = 0
async function obtenerValkey(): Promise<Redis | null> {
  const host = Deno.env.get('VALKEY_HOST')
  if (!host) return null // sin configurar: modo degradado
  if (valkey && !valkey.isClosed) return valkey
  if (Date.now() - ultimoIntento < 60_000) return null // no reintentar en cada petición
  ultimoIntento = Date.now()
  try {
    valkey = await Promise.race([
      connect({
        hostname: host,
        port: Number(Deno.env.get('VALKEY_PORT') ?? 6379),
        username: Deno.env.get('VALKEY_USER') ?? undefined,
        password: Deno.env.get('VALKEY_PASS') ?? undefined,
        tls: (Deno.env.get('VALKEY_TLS') ?? 'true') !== 'false',
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ])
    return valkey
  } catch (e) {
    console.error('Valkey no disponible:', (e as Error).message)
    valkey = null
    return null
  }
}

/** Ejecuta una operación de Valkey; si falla, se ignora (Valkey nunca tumba la sincronización). */
async function intentar<T>(f: (v: Redis) => Promise<T>): Promise<T | null> {
  const v = await obtenerValkey()
  if (!v) return null
  try { return await f(v) } catch (e) {
    console.error('Error de Valkey:', (e as Error).message)
    valkey = null
    return null
  }
}

// ---------------------------------------------------------------- handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ mensaje: 'Método no permitido.' }, 405)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ mensaje: 'Tu sesión expiró.' }, 401)

  let capturas: Array<{ client_id: string }>
  try {
    capturas = (await req.json()).capturas
    if (!Array.isArray(capturas) || capturas.length === 0 || capturas.length > MAX_LOTE) throw new Error()
  } catch {
    return json({ mensaje: `Envía entre 1 y ${MAX_LOTE} capturas.` }, 400)
  }

  // Límite de intentos: 60 capturas por minuto por usuaria.
  const n = await intentar(async (v) => {
    const k = `rl:${user.id}:${Math.floor(Date.now() / 60_000)}`
    const total = await v.incrby(k, capturas.length)
    if (total === capturas.length) await v.expire(k, 60)
    return total
  })
  if (n !== null && n > MAX_POR_MINUTO) return json({ mensaje: 'Demasiadas capturas por minuto. Espera un momento.' }, 429)

  const resultados = []
  for (const p of capturas) {
    // Camino rápido: esta captura ya se aplicó (idempotencia en Valkey).
    const hit = await intentar((v) => v.get(`idem:${p.client_id}`))
    if (hit) { resultados.push({ ...JSON.parse(hit), cache: 'valkey' }); continue }

    // La verdad: Postgres (registrar_captura también es idempotente por captura_sync).
    const { data, error } = await sb.rpc('registrar_captura', { p })
    const r = error ? { client_id: p.client_id, estado: 'error', mensaje: error.message } : data
    if (r?.estado === 'ok') await intentar((v) => v.set(`idem:${p.client_id}`, JSON.stringify(r), { ex: TTL_IDEM }))
    resultados.push(r)
  }
  return json({ resultados, valkey: valkey !== null && !valkey.isClosed })
})
