import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { toast, Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { Layout } from '@/components/Layout'
import { iniciarSincronizacion } from '@/lib/cola'
import type { Rol } from '@/lib/tipos'
import { Alta } from '@/pages/Alta'
import { Bitacora } from '@/pages/Bitacora'
import { Expediente } from '@/pages/Expediente'
import { Login } from '@/pages/Login'
import { Padron } from '@/pages/Padron'

function Protegida({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  const { session, rol, cargando } = useAuth()
  if (cargando) return <p className="p-8 text-center text-gris">Cargando…</p>
  if (!session || !rol) return <Navigate to="/login" replace />
  if (roles && !roles.includes(rol)) {
    return <p role="alert" className="p-8 text-center text-lg font-semibold">No tienes acceso a esta sección.</p>
  }
  return children
}

function Inicio() {
  const { rol } = useAuth()
  return <Navigate to={rol === 'auditor' ? '/bitacora' : '/padron'} replace />
}

export default function App() {
  useEffect(() => {
    iniciarSincronizacion()
    const aviso = (e: Event) => toast.warning((e as CustomEvent<string>).detail, { duration: 10_000 })
    window.addEventListener('biobytes:aviso', aviso)
    return () => window.removeEventListener('biobytes:aviso', aviso)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protegida><Layout /></Protegida>}>
            <Route index element={<Inicio />} />
            <Route path="/padron" element={<Protegida roles={['captura', 'medico', 'coordinacion', 'admin']}><Padron /></Protegida>} />
            <Route path="/alta" element={<Protegida roles={['captura', 'coordinacion']}><Alta /></Protegida>} />
            <Route path="/expediente/:id" element={<Protegida roles={['captura', 'medico', 'coordinacion', 'admin']}><Expediente /></Protegida>} />
            <Route path="/bitacora" element={<Protegida roles={['auditor', 'admin']}><Bitacora /></Protegida>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </AuthProvider>
  )
}
