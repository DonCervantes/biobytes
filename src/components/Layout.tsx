import { useLiveQuery } from 'dexie-react-hooks'
import { CloudOff, LogOut, Wifi } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { db } from '@/lib/cola'
import { useConexion } from '@/lib/conexion'
import { cn, ROLES } from '@/lib/utils'
import { Logo } from './Logo'
import { PanelDecisiones } from './PanelDecisiones'
import { Boton } from './ui'

export function Layout() {
  const { rol, cerrarSesion } = useAuth()
  const enLinea = useConexion()
  const [panel, setPanel] = useState(false)
  const pendientes = useLiveQuery(() => db.cola.where('estado').equals('pendiente').count(), [], 0)
  const porDecidir = useLiveQuery(() => db.cola.where('estado').anyOf('coincidencias', 'conflicto', 'error').count(), [], 0)
  const cerrarPanel = useCallback(() => setPanel(false), [])

  const salir = async () => {
    const sinEnviar = pendientes + porDecidir
    if (sinEnviar > 0 && !window.confirm(
      `Tienes ${sinEnviar} ${sinEnviar === 1 ? 'captura' : 'capturas'} sin enviar. Si sales, se perderán. ` +
      'Conéctate primero o pide a coordinación que las envíe.\n\n¿Salir de todos modos?')) return
    await cerrarSesion()
  }

  const enlace = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-[10px] px-3 py-2 font-semibold', isActive ? 'bg-niebla text-primario' : 'text-tinta hover:bg-niebla')

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-borde bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <Link to="/padron" aria-label="BioBytes, ir al padrón"><Logo /></Link>
          <nav className="flex gap-1" aria-label="Secciones">
            {rol !== 'auditor' && <NavLink to="/padron" className={enlace}>Padrón</NavLink>}
            {(rol === 'captura' || rol === 'coordinacion') && <NavLink to="/alta" className={enlace}>Registrar</NavLink>}
            {(rol === 'auditor' || rol === 'admin') && <NavLink to="/bitacora" className={enlace}>Bitácora</NavLink>}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            <div aria-live="polite" className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold',
              enLinea ? 'bg-jade-claro text-jade' : 'bg-ambar-claro text-ambar')}>
              {enLinea ? <Wifi size={16} aria-hidden /> : <CloudOff size={16} aria-hidden />}
              {enLinea ? 'En línea' : 'Sin internet'}
            </div>
            {pendientes > 0 && (
              <span className="rounded-full bg-ambar-claro px-3 py-1.5 font-semibold text-ambar" aria-live="polite">
                {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'} de enviar
              </span>
            )}
            {porDecidir > 0 && (
              <button onClick={() => setPanel(true)}
                className="min-h-9 rounded-full bg-rojo-claro px-3 py-1.5 font-semibold text-rojo hover:underline">
                {porDecidir} por decidir → Abrir
              </button>
            )}
            <span className="hidden text-gris sm:inline">{rol ? ROLES[rol] : ''}</span>
            <Boton variante="fantasma" onClick={salir}><LogOut size={16} aria-hidden /> Cerrar sesión</Boton>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <PanelDecisiones abierto={panel} onCerrar={cerrarPanel} />
    </div>
  )
}
