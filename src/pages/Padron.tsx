import { Printer, Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Alerta, Boton, estiloBoton, Folio } from '@/components/ui'
import { leerPadron } from '@/lib/cola'
import { useConexion } from '@/lib/conexion'
import { buscarLocal } from '@/lib/match'
import { esErrorDeRed, supabase } from '@/lib/supabase'
import type { FilaPadron } from '@/lib/tipos'
import { fmtFecha } from '@/lib/utils'

const POR_PAGINA = 25

export function Padron() {
  const { rol } = useAuth()
  const enLinea = useConexion()
  const navegar = useNavigate()
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(0)
  const [filas, setFilas] = useState<FilaPadron[]>([])
  const [local, setLocal] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const f = () => setVersion((v) => v + 1)
    window.addEventListener('biobytes:sincronizado', f)
    return () => window.removeEventListener('biobytes:sincronizado', f)
  }, [])

  useEffect(() => {
    let vigente = true
    const buscarEnDispositivo = async () => {
      const todo = buscarLocal(q, await leerPadron())
      if (!vigente) return
      setFilas(todo.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((p) => ({
        id: p.id, folio: p.folio,
        nombre_completo: [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' '),
        fecha_nacimiento: p.fecha_nacimiento, municipio: p.municipio,
        num_visitas: null, ultima_visita: null, version: p.version,
      })))
      setLocal(true); setCargando(false)
    }
    const t = setTimeout(async () => {
      setCargando(true); setError('')
      if (!enLinea) return buscarEnDispositivo()
      const { data, error, status } = await supabase.rpc('buscar_padron', {
        p_q: q.trim() || null, p_limit: POR_PAGINA, p_offset: pagina * POR_PAGINA,
      })
      if (!vigente) return
      if (error) {
        if (esErrorDeRed(error, status)) return buscarEnDispositivo()
        setError(error.message); setCargando(false)
        return
      }
      setFilas((data ?? []) as FilaPadron[]); setLocal(false); setCargando(false)
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, pagina, enLinea, version])

  const puedeRegistrar = rol === 'captura' || rol === 'coordinacion'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Padrón</h1>
        {puedeRegistrar && (
          <div className="flex flex-wrap gap-2">
            <Link to="/formato" className={estiloBoton({ variante: 'secundario' })}>
              <Printer size={18} aria-hidden /> Imprimir formato en blanco
            </Link>
            <Link to="/alta" className={estiloBoton({ variante: 'primario' })}>
              <UserPlus size={18} aria-hidden /> Registrar paciente
            </Link>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="buscar" className="mb-2 block text-base font-semibold">
          Busca a la paciente antes de registrarla: por nombre (con o sin acentos), folio, CURP o teléfono.
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-gris" aria-hidden />
          <input
            id="buscar" type="search" autoFocus value={q}
            onChange={(e) => { setQ(e.target.value); setPagina(0) }}
            placeholder="Ej.: maria ejemplo · EIRA-900101 · 3410000001"
            className="min-h-14 w-full rounded-bb border-2 border-borde bg-white py-3 pr-4 pl-12 text-lg focus:border-primario focus:outline-none"
          />
        </div>
      </div>

      {local && <Alerta tono="ambar">Sin internet: buscando en el padrón guardado en este dispositivo.</Alerta>}
      {error && <Alerta>{error}</Alerta>}

      <div className="overflow-x-auto rounded-bb border border-borde bg-white">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-niebla text-sm text-tinta">
            <tr>
              <th className="px-4 py-3">Folio</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Nacimiento</th>
              <th className="px-4 py-3">Municipio</th><th className="px-4 py-3">Visitas</th><th className="px-4 py-3">Última visita</th>
            </tr>
          </thead>
          <tbody aria-busy={cargando}>
            {filas.map((f) => (
              <tr key={f.id} tabIndex={0} role="link" aria-label={`Abrir expediente ${f.folio}, ${f.nombre_completo}`}
                className="cursor-pointer border-t border-borde hover:bg-arena focus:bg-arena"
                onClick={() => navegar(`/expediente/${f.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navegar(`/expediente/${f.id}`)}>
                <td className="px-4 py-3"><Folio>{f.folio}</Folio></td>
                <td className="px-4 py-3 font-medium">{f.nombre_completo}</td>
                <td className="px-4 py-3">{fmtFecha(f.fecha_nacimiento)}</td>
                <td className="px-4 py-3">{f.municipio ?? '—'}</td>
                <td className="px-4 py-3">{f.num_visitas ?? '—'}</td>
                <td className="px-4 py-3">{fmtFecha(f.ultima_visita)}</td>
              </tr>
            ))}
            {!cargando && filas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gris">
                No encontramos a nadie con esa búsqueda.{puedeRegistrar && ' Si es su primera visita, regístrala.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Boton variante="secundario" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Boton>
        <Boton variante="secundario" disabled={filas.length < POR_PAGINA} onClick={() => setPagina((p) => p + 1)}>Siguiente</Boton>
      </div>
    </div>
  )
}
