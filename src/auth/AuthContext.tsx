import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { borrarDatosLocales, descargarPadron, descargarSedes } from '@/lib/cola'
import { estaEnLinea } from '@/lib/conexion'
import { esErrorDeRed, supabase } from '@/lib/supabase'
import type { Rol } from '@/lib/tipos'

interface Ctx {
  session: Session | null
  rol: Rol | null
  cargando: boolean
  /** true si hay sesión pero la cuenta no tiene perfil asignado */
  sinPerfil: boolean
  cerrarSesion: () => Promise<void>
}

const AuthCtx = createContext<Ctx | null>(null)
const claveRol = (uid: string) => `biobytes:rol:${uid}`

function leerRolGuardado(uid: string): Rol | null {
  try { return (localStorage.getItem(claveRol(uid)) as Rol | null) ?? null } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [rol, setRol] = useState<Rol | null>(null)
  const [sinPerfil, setSinPerfil] = useState(false)
  const [cargando, setCargando] = useState(true)

  const resolverRol = useCallback(async (s: Session | null) => {
    if (!s) {
      setRol(null); setSinPerfil(false); setCargando(false)
      return
    }
    const uid = s.user.id
    const { data, error, status } = await supabase.rpc('rol_actual')
    if (error) {
      // Sin red: se usa el rol guardado en este dispositivo para seguir trabajando.
      const guardado = esErrorDeRed(error, status) ? leerRolGuardado(uid) : null
      setRol(guardado); setSinPerfil(!guardado && !esErrorDeRed(error, status))
    } else {
      const r = (data as Rol | null) ?? null
      setRol(r); setSinPerfil(!r)
      try { if (r) localStorage.setItem(claveRol(uid), r) } catch { /* sin almacenamiento */ }
      if (r) {
        // Con red: bajar el padrón (sin antecedentes) y las sedes para trabajar sin conexión.
        void descargarPadron()
        void descargarSedes()
      }
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    let uidActual: string | null | undefined
    void supabase.auth.getSession().then(({ data }) => {
      uidActual = data.session?.user.id ?? null
      setSession(data.session)
      void resolverRol(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s)
      const uid = s?.user.id ?? null
      if (uid !== uidActual && uidActual !== undefined) {
        uidActual = uid
        setCargando(true)
        // fuera del callback para no bloquear el cliente de auth
        setTimeout(() => void resolverRol(s), 0)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [resolverRol])

  const cerrarSesion = useCallback(async () => {
    const uid = session?.user.id
    await borrarDatosLocales()
    try { if (uid) localStorage.removeItem(claveRol(uid)) } catch { /* nada */ }
    await supabase.auth.signOut({ scope: estaEnLinea() ? 'global' : 'local' }).catch(() =>
      supabase.auth.signOut({ scope: 'local' }))
  }, [session])

  return <AuthCtx.Provider value={{ session, rol, cargando, sinPerfil, cerrarSesion }}>{children}</AuthCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth fuera de AuthProvider')
  return c
}
