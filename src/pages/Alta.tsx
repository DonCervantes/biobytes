import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Candidatas } from '@/components/Candidatas'
import { Alerta, AreaTexto, Boton, Campo, Entrada, Selector, Tarjeta } from '@/components/ui'
import { db, decidir, descartar, enviarCaptura, existeEnCola, leerPadron } from '@/lib/cola'
import { estaEnLinea } from '@/lib/conexion'
import { coincidenciasLocales } from '@/lib/match'
import type { Candidata, CapturaP, RespuestaCaptura } from '@/lib/tipos'
import { hoyCDMX, SERVICIOS } from '@/lib/utils'
import { validarAlta, type FormAlta } from '@/lib/validacion'

const VACIO: FormAlta = {
  nombre: '', apellido_paterno: '', apellido_materno: '', fecha_nacimiento: '', curp: '', telefono: '',
  correo: '', municipio: '', antecedentes: '', con_visita: true, fecha_visita: hoyCDMX(), sede_id: '', servicio: '',
}

export function Alta() {
  const navegar = useNavigate()
  const sedes = useLiveQuery(() => db.sedes.toArray(), [], [])
  const [f, setF] = useState<FormAlta>(VACIO)
  const [errores, setErrores] = useState<Partial<Record<keyof FormAlta, string>>>({})
  const [errorServidor, setErrorServidor] = useState('')
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null)
  const [preliminar, setPreliminar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  // Una captura = un client_id. Se conserva mientras se decide sobre las coincidencias.
  const captura = useRef<CapturaP | null>(null)

  const cambiar = (k: keyof FormAlta) => (e: { target: { value: string } }) => {
    setF((x) => ({ ...x, [k]: e.target.value }))
    captura.current = null // si cambian los datos, es otra captura
  }

  const terminar = async (r: RespuestaCaptura | undefined, cid: string) => {
    if (!r) {
      toast('Guardada en este dispositivo. Se enviará sola al volver la conexión.')
      navegar('/padron')
      return
    }
    if (r.estado === 'ok') {
      toast.success(`Expediente ${r.folio} listo`)
      navegar(`/expediente/${r.paciente_id}`)
    } else if (r.estado === 'coincidencias') {
      setCandidatas(r.candidatas); setPreliminar(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (r.estado === 'error') {
      // Error de validación: se corrige aquí mismo, no queda en la cola.
      await descartar(cid)
      captura.current = null
      setCandidatas(null)
      setErrorServidor(r.mensaje)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErrorServidor('')
    const { errores: errs, datos, visita } = validarAlta(f)
    setErrores(errs)
    if (Object.keys(errs).length > 0) {
      document.getElementById(Object.keys(errs)[0])?.focus()
      return
    }
    const p: CapturaP = captura.current ?? {
      client_id: crypto.randomUUID(),
      tipo: 'alta',
      paciente: datos,
      visita,
      etiqueta: `Alta: ${datos.nombre} ${datos.apellido_paterno}`,
    }
    captura.current = p
    setOcupado(true)
    try {
      if (!estaEnLinea()) {
        // Sin red: coincidencias preliminares contra el padrón descargado.
        const locales = coincidenciasLocales(datos, await leerPadron())
        if (locales.length > 0) {
          setCandidatas(locales); setPreliminar(true)
          window.scrollTo({ top: 0, behavior: 'smooth' })
          return
        }
      }
      await terminar(await enviarCaptura(p), p.client_id)
    } finally {
      setOcupado(false)
    }
  }

  const resolver = async (cambios: Partial<CapturaP>) => {
    const p = captura.current
    if (!p) return
    setOcupado(true)
    try {
      const enCola = await existeEnCola(p.client_id)
      const r = enCola ? await decidir(p.client_id, cambios) : await enviarCaptura({ ...p, ...cambios })
      await terminar(r, p.client_id)
    } finally {
      setOcupado(false)
    }
  }

  if (candidatas) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Candidatas
          candidatas={candidatas}
          preliminar={preliminar}
          ocupado={ocupado}
          onVincular={(id) => resolver({ decision: 'vincular', paciente_id: id })}
          onNueva={(ids) => resolver({ decision: 'nueva', descartadas: ids })}
        />
        <Boton variante="fantasma" disabled={ocupado} onClick={async () => {
          if (captura.current) await descartar(captura.current.client_id)
          captura.current = null
          setCandidatas(null)
        }}>← Volver a corregir los datos</Boton>
      </div>
    )
  }

  const err = (k: keyof FormAlta) => ({ 'aria-invalid': !!errores[k], 'aria-describedby': errores[k] ? `${k}-error` : undefined })

  return (
    <form onSubmit={enviar} noValidate className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Registrar paciente</h1>
      {errorServidor && <Alerta>{errorServidor}</Alerta>}

      <Tarjeta className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold">Datos de la paciente</h2>
          <p className="text-sm text-gris">Con CURP o teléfono la búsqueda de coincidencias es más confiable.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo id="nombre" etiqueta="Nombre *" error={errores.nombre}>
            <Entrada id="nombre" value={f.nombre} onChange={cambiar('nombre')} maxLength={100} autoComplete="off" {...err('nombre')} />
          </Campo>
          <Campo id="apellido_paterno" etiqueta="Primer apellido *" error={errores.apellido_paterno}>
            <Entrada id="apellido_paterno" value={f.apellido_paterno} onChange={cambiar('apellido_paterno')} maxLength={100} autoComplete="off" {...err('apellido_paterno')} />
          </Campo>
          <Campo id="apellido_materno" etiqueta="Segundo apellido" error={errores.apellido_materno}>
            <Entrada id="apellido_materno" value={f.apellido_materno} onChange={cambiar('apellido_materno')} maxLength={100} autoComplete="off" />
          </Campo>
          <Campo id="fecha_nacimiento" etiqueta="Fecha de nacimiento *" error={errores.fecha_nacimiento}>
            <Entrada id="fecha_nacimiento" type="date" min="1900-01-01" max={hoyCDMX()} value={f.fecha_nacimiento} onChange={cambiar('fecha_nacimiento')} {...err('fecha_nacimiento')} />
          </Campo>
          <Campo id="curp" etiqueta="CURP" error={errores.curp}>
            <Entrada id="curp" value={f.curp} maxLength={18} className="font-mono uppercase" autoComplete="off"
              onChange={(e) => cambiar('curp')({ target: { value: e.target.value.toUpperCase() } })} {...err('curp')} />
          </Campo>
          <Campo id="telefono" etiqueta="Teléfono" error={errores.telefono}>
            <Entrada id="telefono" type="tel" inputMode="numeric" value={f.telefono} onChange={cambiar('telefono')} placeholder="10 dígitos" {...err('telefono')} />
          </Campo>
          <Campo id="correo" etiqueta="Correo" error={errores.correo}>
            <Entrada id="correo" type="email" value={f.correo} onChange={cambiar('correo')} {...err('correo')} />
          </Campo>
          <Campo id="municipio" etiqueta="Municipio" className="sm:col-span-2">
            <Entrada id="municipio" value={f.municipio} onChange={cambiar('municipio')} list="municipios" />
            <datalist id="municipios">
              {[...new Set(sedes.map((s) => s.municipio))].map((m) => <option key={m} value={m} />)}
            </datalist>
          </Campo>
        </div>
        <Campo id="antecedentes" etiqueta="Antecedentes (del formato en papel)"
          ayuda="Después de guardar, solo el personal médico podrá leerlos y editarlos.">
          <AreaTexto id="antecedentes" value={f.antecedentes} onChange={cambiar('antecedentes')} />
        </Campo>
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Servicio de hoy</h2>
        <label className="flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" className="size-5 accent-primario" checked={f.con_visita}
            onChange={(e) => setF((x) => ({ ...x, con_visita: e.target.checked }))} />
          Registrar también la visita de hoy
        </label>
        {f.con_visita && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="fecha_visita" etiqueta="Fecha" error={errores.fecha_visita}>
              <Entrada id="fecha_visita" type="date" max={hoyCDMX()} value={f.fecha_visita} onChange={cambiar('fecha_visita')} {...err('fecha_visita')} />
            </Campo>
            <Campo id="sede_id" etiqueta="Sede" error={errores.sede_id}>
              <Selector id="sede_id" value={f.sede_id} onChange={cambiar('sede_id')} {...err('sede_id')}>
                <option value="">Elige…</option>
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Selector>
            </Campo>
            <Campo id="servicio" etiqueta="Servicio" error={errores.servicio}>
              <Selector id="servicio" value={f.servicio} onChange={cambiar('servicio')} {...err('servicio')}>
                <option value="">Elige…</option>
                {SERVICIOS.map((s) => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
              </Selector>
            </Campo>
          </div>
        )}
      </Tarjeta>

      <Boton type="submit" tam="grande" disabled={ocupado}>
        <Search size={18} aria-hidden /> {ocupado ? 'Buscando…' : 'Buscar coincidencias y registrar'}
      </Boton>
    </form>
  )
}

