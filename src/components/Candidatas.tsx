import { CircleCheck, UserPlus } from 'lucide-react'
import type { Candidata } from '@/lib/tipos'
import { fmtFecha } from '@/lib/utils'
import { Alerta, Boton, Folio, Insignia } from './ui'

/** Tarjeta «¿Es la misma persona?». Nada se vincula ni se crea sin una decisión humana. */
export function Candidatas({ candidatas, preliminar, ocupado, onVincular, onNueva }: {
  candidatas: Candidata[]
  preliminar?: boolean
  ocupado?: boolean
  onVincular: (pacienteId: string) => void
  onNueva: (descartadas: string[]) => void
}) {
  const nueva = () => {
    const n = candidatas.length
    if (window.confirm(`¿Confirmas que ninguna de estas ${n} pacientes es ella?`)) {
      onNueva(candidatas.map((c) => c.paciente_id))
    }
  }

  return (
    <div className="flex flex-col gap-4" aria-labelledby="titulo-candidatas">
      <h2 id="titulo-candidatas" className="text-2xl font-extrabold">¿Es la misma persona?</h2>
      <Alerta tono="info">
        Encontramos expedientes parecidos. El nombre no basta para identificar: compara fecha de nacimiento,
        CURP y teléfono, y pregúntale a la paciente. Nada se fusiona sin tu confirmación.
      </Alerta>
      {preliminar && (
        <Alerta tono="ambar">Coincidencia preliminar: se confirmará al sincronizar.</Alerta>
      )}
      <ul className="flex flex-col gap-3">
        {candidatas.map((c) => (
          <li key={c.paciente_id} className="rounded-bb border-2 border-borde bg-white p-4 data-[alta=true]:border-primario" data-alta={c.nivel === 'alta'}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{c.nombre_completo}</p>
                <Folio>{c.folio}</Folio>
              </div>
              {c.nivel === 'alta'
                ? <Insignia tono="rosa">Muy probable</Insignia>
                : <Insignia tono="info">Revisar</Insignia>}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div><dt className="text-gris">Nacimiento</dt><dd className="font-medium">{fmtFecha(c.fecha_nacimiento)}</dd></div>
              <div><dt className="text-gris">Municipio</dt><dd className="font-medium">{c.municipio ?? '—'}</dd></div>
              <div><dt className="text-gris">Teléfono</dt><dd className="font-mono font-medium">{c.telefono_mask ?? '—'}</dd></div>
            </dl>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Razones">
              {c.razones.map((r) => (
                <li key={r}><Insignia tono={r.includes('distinta') ? 'ambar' : 'jade'}>{r}</Insignia></li>
              ))}
            </ul>
            <Boton className="mt-4 w-full sm:w-auto" disabled={ocupado} onClick={() => onVincular(c.paciente_id)}>
              <CircleCheck size={18} aria-hidden /> Sí, es ella: usar este expediente
            </Boton>
          </li>
        ))}
      </ul>
      <Boton variante="secundario" disabled={ocupado} onClick={nueva}>
        <UserPlus size={18} aria-hidden /> Ninguna es ella: crear expediente nuevo
      </Boton>
    </div>
  )
}
