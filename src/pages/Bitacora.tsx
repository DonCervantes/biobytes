import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alerta, Boton } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { fmtFechaHora, ROLES } from '@/lib/utils'

interface Fila { id: number; en: string; rol: string | null; accion: string; entidad: string | null; entidad_id: string | null; detalle: unknown }

/** Bitácora encadenada con HMAC: ids, nunca nombres. Solo auditoría y administración. */
export function Bitacora() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [error, setError] = useState('')
  const [verif, setVerif] = useState<{ ok: boolean; primera_fila_rota: number | null; filas: number } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    void supabase.from('bitacora').select('id, en, rol, accion, entidad, entidad_id, detalle')
      .order('id', { ascending: false }).limit(200)
      .then(({ data, error }) => error ? setError(error.message) : setFilas((data ?? []) as Fila[]))
  }, [])

  const verificar = async () => {
    setOcupado(true)
    const { data, error } = await supabase.rpc('verificar_bitacora')
    setOcupado(false)
    if (error) return setError(error.message)
    setVerif((data as typeof verif[])[0] ?? null)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Bitácora</h1>
        <Boton variante="jade" disabled={ocupado} onClick={verificar}><ShieldCheck size={18} aria-hidden /> Verificar integridad</Boton>
      </div>
      <div aria-live="polite">
        {verif && (verif.ok
          ? <p className="rounded-bb bg-jade-claro px-4 py-3 font-semibold text-jade">✓ Cadena íntegra ({verif.filas} registros)</p>
          : <Alerta>✗ Registro alterado: #{verif.primera_fila_rota}</Alerta>)}
      </div>
      {error && <Alerta>{error}</Alerta>}
      <div className="overflow-x-auto rounded-bb border border-borde bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-niebla">
            <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Rol</th><th className="px-3 py-2">Acción</th><th className="px-3 py-2">Entidad</th><th className="px-3 py-2">Detalle</th></tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-borde align-top">
                <td className="px-3 py-2 font-mono">{f.id}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtFechaHora(f.en)}</td>
                <td className="px-3 py-2">{f.rol ? ROLES[f.rol] : '—'}</td>
                <td className="px-3 py-2 font-medium">{f.accion}</td>
                <td className="px-3 py-2 font-mono text-xs">{f.entidad} {f.entidad_id?.slice(0, 8)}</td>
                <td className="max-w-md px-3 py-2 font-mono text-xs break-all text-gris">{JSON.stringify(f.detalle)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
