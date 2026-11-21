import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { db, decidir, descartar, reintentar, useCapturas, type Captura } from '@/lib/cola'
import type { RespuestaCaptura } from '@/lib/tipos'
import { CAMPOS } from '@/lib/utils'
import { Candidatas } from './Candidatas'
import { Alerta, Boton, Tarjeta } from './ui'

function avisarResultado(r: RespuestaCaptura | undefined | null) {
  if (r === null) return
  if (!r) toast('Guardada en este dispositivo. Se enviará sola al volver la conexión.')
  else if (r.estado === 'ok') toast.success(`Listo: expediente ${r.folio}`)
  else if (r.estado === 'error') toast.error(r.mensaje)
}

/** Panel lateral «Por decidir»: capturas que necesitan una decisión humana. */
export function PanelDecisiones({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const capturas = useCapturas(
    () => db.cola.where('estado').anyOf('coincidencias', 'conflicto', 'error').sortBy('creada'), [])
  const cerrarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    cerrarRef.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierto, onCerrar])

  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-tinta/40" onClick={onCerrar}>
      <aside
        role="dialog" aria-modal="true" aria-labelledby="titulo-por-decidir"
        className="flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto bg-arena p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-por-decidir" className="text-2xl font-extrabold">Por decidir</h2>
          <Boton ref={cerrarRef} variante="fantasma" aria-label="Cerrar" onClick={onCerrar}><X aria-hidden /></Boton>
        </div>
        {capturas.length === 0 && <p className="text-gris">No hay capturas por decidir.</p>}
        {capturas.map((c) => <TarjetaDecision key={c.client_id} c={c} />)}
      </aside>
    </div>
  )
}

function TarjetaDecision({ c }: { c: Captura }) {
  const [ocupado, setOcupado] = useState(false)
  const r = c.respuesta
  const correr = async (f: () => Promise<RespuestaCaptura | undefined | null>) => {
    setOcupado(true)
    try { avisarResultado(await f()) } finally { setOcupado(false) }
  }
  const titulo = c.p.etiqueta ?? (c.p.tipo === 'alta' ? 'Alta' : c.p.tipo === 'cambio' ? 'Cambio de contacto' : 'Visita')

  return (
    <Tarjeta className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-gris">{titulo}</p>
      {r?.estado === 'coincidencias' && (
        <Candidatas
          candidatas={r.candidatas}
          ocupado={ocupado}
          onVincular={(id) => correr(() => decidir(c.client_id, { decision: 'vincular', paciente_id: id }))}
          onNueva={(ids) => correr(() => decidir(c.client_id, { decision: 'nueva', descartadas: ids }))}
        />
      )}
      {r?.estado === 'conflicto' && <Conflicto c={c} ocupado={ocupado} correr={correr} />}
      {r?.estado === 'error' && (
        <>
          <Alerta>{r.mensaje}</Alerta>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" disabled={ocupado} onClick={() => correr(() => reintentar(c.client_id))}>Reintentar</Boton>
            <Boton variante="peligro" disabled={ocupado} onClick={async () => {
              if (window.confirm('¿Descartar esta captura? No se enviará.')) await descartar(c.client_id)
            }}>Descartar</Boton>
          </div>
        </>
      )}
    </Tarjeta>
  )
}

function Conflicto({ c, ocupado, correr }: {
  c: Captura; ocupado: boolean; correr: (f: () => Promise<RespuestaCaptura | undefined | null>) => Promise<void>
}) {
  const r = c.respuesta as Extract<RespuestaCaptura, { estado: 'conflicto' }>
  const campos = Object.keys(c.p.paciente ?? {}).filter((k) => k in CAMPOS)
  // Por omisión gana «Actual» (lo que ya está en el servidor).
  const [elige, setElige] = useState<Record<string, 'actual' | 'tuya'>>(() =>
    Object.fromEntries(campos.map((k) => [k, 'actual'])))

  const aplicar = () => correr(async () => {
    const tuyos = Object.fromEntries(
      campos.filter((k) => elige[k] === 'tuya').map((k) => [k, (c.p.paciente as Record<string, unknown>)[k]]))
    if (Object.keys(tuyos).length === 0) {
      await descartar(c.client_id)
      toast('Se conservaron los datos actuales.')
      return null
    }
    return decidir(c.client_id, { version_base: r.servidor.version, paciente: tuyos })
  })

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">Alguien cambió este expediente mientras tanto</h3>
      <p className="text-sm text-gris">Elige, campo por campo, qué valor se queda.</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gris"><th className="py-1">Campo</th><th>Actual</th><th>Tu captura</th></tr></thead>
        <tbody>
          {campos.map((k) => (
            <tr key={k} className="border-t border-borde">
              <th scope="row" className="py-2 text-left font-semibold">{CAMPOS[k]}</th>
              {(['actual', 'tuya'] as const).map((op) => (
                <td key={op} className="py-2 pr-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input type="radio" name={`${c.client_id}-${k}`} checked={elige[k] === op}
                      onChange={() => setElige((e) => ({ ...e, [k]: op }))} />
                    <span>{String((op === 'actual' ? r.servidor[k] : (c.p.paciente as Record<string, unknown>)[k]) ?? '—')}</span>
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Boton disabled={ocupado} onClick={aplicar}>Aplicar</Boton>
    </div>
  )
}
