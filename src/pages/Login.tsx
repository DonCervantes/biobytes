import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Alerta, Boton, Campo, Entrada, Tarjeta } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function Login() {
  const { session, rol, sinPerfil, cerrarSesion } = useAuth()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (session && rol) return <Navigate to={rol === 'auditor' ? '/bitacora' : '/padron'} replace />

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
    setEnviando(false)
    if (error) setError(error.message.includes('Invalid login') ? 'Correo o contraseña incorrectos.' : error.message)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Tarjeta className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-12" />
          <div>
            <h1 className="text-3xl font-extrabold text-primario">BioBytes</h1>
            <p className="text-sm text-gris">Cada mujer, un solo expediente.</p>
          </div>
        </div>
        {session && sinPerfil ? (
          <div className="flex flex-col gap-4">
            <Alerta tono="ambar">Tu cuenta no tiene un perfil asignado. Pide acceso a coordinación.</Alerta>
            <Boton variante="secundario" onClick={() => void cerrarSesion()}>Salir</Boton>
          </div>
        ) : (
          <form onSubmit={entrar} className="flex flex-col gap-4">
            {error && <Alerta>{error}</Alerta>}
            <Campo id="correo" etiqueta="Correo">
              <Entrada id="correo" type="email" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
            </Campo>
            <Campo id="clave" etiqueta="Contraseña">
              <Entrada id="clave" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
            </Campo>
            <Boton type="submit" tam="grande" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</Boton>
            <p className="text-center text-xs text-gris">Solo personal autorizado. Las cuentas las crea coordinación.</p>
          </form>
        )}
      </Tarjeta>
    </main>
  )
}
