import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, ClipboardList, CloudOff, Pencil, Phone, Stethoscope } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { Alerta, AreaTexto, Boton, Campo, Entrada, Folio, Insignia, Selector, Tarjeta } from '@/components/ui'
import { db, descartar, enviarCaptura, pacienteLocal, useCapturas } from '@/lib/cola'
import { useConexion } from '@/lib/conexion'
import { esErrorDeRed, supabase } from '@/lib/supabase'
import type { CapturaP, Expediente as TExpediente, RespuestaCaptura } from '@/lib/tipos'
import { CAMPOS, enmascararTel, etiquetaServicio, fmtFecha, fmtFechaHora, hoyCDMX, SERVICIOS, soloDigitos } from '@/lib/utils'
import { validarCorreo, validarTelefono } from '@/lib/validacion'

type Modo = null | 'contacto' | 'visita'

export function Expediente() {
  const { id = '' } = useParams()
  const { rol, session } = useAuth()
  const enLinea = useConexion()
  const [exp, setExp] = useState<TExpediente | null>(null)
  const [local, setLocal] = useState(false)
  const [error, setError] = useState('')
  const [modo, setModo] = useState<Modo>(null)
  const pendientes = useCapturas(() => db.cola.where('paciente_id').equals(id).toArray(), [id])
    .filter((c) => c.p.tipo !== 'alta')

  const cargar = useCallback(async () => {
    setError('')
    const desdeDispositivo = async () => {
      const p = await pacienteLocal(id)
      if (!p) { setError('Sin internet y este expediente no está guardado en el dispositivo.'); return }
      setExp({
        rol: rol!, antecedentes: null, visitas: [], cambios: [],
        paciente: { ...p, correo: null, localidad: null },
      })
      setLocal(true)
    }
    if (!enLinea) return desdeDispositivo()
    const { data, error, status } = await supabase.rpc('abrir_expediente', { p_id: id })
    if (error) return esErrorDeRed(error, status) ? desdeDispositivo() : setError(error.message)
    setExp(data as TExpediente); setLocal(false)
  }, [id, enLinea, rol])

  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => {
    const f = () => void cargar()
    window.addEventListener('biobytes:sincronizado', f)
    return () => window.removeEventListener('biobytes:sincronizado', f)
  }, [cargar])

  if (error) return <Alerta>{error}</Alerta>
  if (!exp) return <p className="text-gris">Cargando expediente…</p>

  const p = exp.paciente
  const esCaptura = rol === 'captura' || rol === 'coordinacion'
  const esMedico = rol === 'medico'
  const nombre = [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ')

  const despues = async (r: RespuestaCaptura | undefined, cid: string) => {
    if (!r) {
      toast('Guardada en este dispositivo. Se enviará sola al volver la conexión.')
      setModo(null)
    } else if (r.estado === 'ok') {
      toast.success('Guardado')
      setModo(null)
      void cargar()
    } else if (r.estado === 'conflicto') {
      toast.warning('Alguien cambió este expediente mientras tanto. Decide qué datos se quedan en «Por decidir».')
      setModo(null)
    } else if (r.estado === 'error') {
      await descartar(cid)
      toast.error(r.mensaje)
    }
  }

  const cronologia = [
    ...exp.visitas.map((v) => ({ tipo: 'visita' as const, orden: `${v.fecha}T23:59:59`, v })),
    ...exp.cambios.map((c) => ({ tipo: 'cambio' as const, orden: c.en, c })),
  ].sort((a, b) => (a.orden === b.orden ? 0 : a.orden < b.orden ? 1 : -1)) // estable: respeta el orden del servidor

  return (
    <div className="flex flex-col gap-5">
      <Link to="/padron" className="text-sm font-semibold text-primario hover:underline">← Padrón</Link>
      {local && (
        <Alerta tono="ambar">
          Sin internet: mostramos los datos guardados en este dispositivo. La cronología completa aparecerá al volver la conexión.
        </Alerta>
      )}

      <Tarjeta className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">{nombre}</h1>
            <Folio className="text-2xl">{p.folio}</Folio>
          </div>
          {esCaptura && (
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" onClick={() => setModo(modo === 'contacto' ? null : 'contacto')}>
                <Phone size={18} aria-hidden /> Actualizar contacto
              </Boton>
              <Boton onClick={() => setModo(modo === 'visita' ? null : 'visita')}>
                <CalendarPlus size={18} aria-hidden /> Registrar visita de hoy
              </Boton>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Dato t="Nacimiento" v={fmtFecha(p.fecha_nacimiento)} />
          <Dato t="CURP" v={p.curp ?? '—'} mono />
          <Dato t="Teléfono" v={local ? enmascararTel(p.telefono) : (p.telefono ?? '—')} mono />
          <Dato t="Correo" v={p.correo ?? '—'} />
          <Dato t="Municipio" v={p.municipio ?? '—'} />
          <Dato t="Localidad" v={p.localidad ?? '—'} />
        </dl>
      </Tarjeta>

      {modo === 'contacto' && <FormContacto exp={exp} onCancelar={() => setModo(null)} onEnviar={despues} />}
      {modo === 'visita' && <FormVisita exp={exp} onCancelar={() => setModo(null)} onEnviar={despues} />}

      {esMedico && <Antecedentes pacienteId={p.id} inicial={exp.antecedentes} uid={session?.user.id} />}

      <Tarjeta className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-xl font-bold"><ClipboardList size={20} aria-hidden /> Cronología</h2>
        <ol className="flex flex-col gap-3">
          {pendientes.map((c) => (
            <li key={c.client_id} className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-ambar bg-ambar-claro/50 p-3 text-sm">
              <Insignia tono="ambar"><CloudOff size={12} aria-hidden /> {c.estado === 'pendiente' ? 'Pendiente de enviar' : 'Por decidir'}</Insignia>
              <span className="font-medium">{descripcionPendiente(c.p)}</span>
            </li>
          ))}
          {cronologia.map((e) => e.tipo === 'visita' ? (
            <li key={e.v.id} className="rounded-[10px] border border-borde p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Stethoscope size={18} className="text-jade" aria-hidden />
                <span className="font-semibold">{etiquetaServicio(e.v.servicio)}</span>
                <span className="text-gris">· {e.v.sede} · {fmtFecha(e.v.fecha)}</span>
                {e.v.origen === 'sin_conexion' && <Insignia tono="ambar"><CloudOff size={12} aria-hidden /> Capturada sin conexión</Insignia>}
              </div>
              {esMedico && <NotaVisita visitaId={e.v.id} inicial={e.v.nota} uid={session?.user.id} />}
            </li>
          ) : (
            <li key={`${e.c.campo}-${e.c.en}`} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-arena p-3 text-sm">
              <Pencil size={16} className="text-gris" aria-hidden />
              <span className="font-semibold">{CAMPOS[e.c.campo] ?? e.c.campo}:</span>
              <del className="text-gris" aria-label={`antes ${e.c.antes ?? 'sin dato'}`}>{e.c.antes ?? 'sin dato'}</del>
              <span aria-hidden>→</span>
              <span className="font-medium">{e.c.despues ?? 'sin dato'}</span>
              <span className="text-gris">· {fmtFechaHora(e.c.en)}</span>
            </li>
          ))}
          {cronologia.length === 0 && pendientes.length === 0 && !local && <p className="text-gris">Sin visitas registradas.</p>}
        </ol>
      </Tarjeta>
    </div>
  )
}

function descripcionPendiente(p: CapturaP) {
  if (p.tipo === 'visita' && p.visita) return `Visita: ${etiquetaServicio(p.visita.servicio)} · ${fmtFecha(p.visita.fecha)}`
  if (p.tipo === 'cambio') return `Cambio de ${Object.keys(p.paciente ?? {}).map((k) => CAMPOS[k]?.toLowerCase() ?? k).join(', ')}`
  return 'Captura'
}

function Dato({ t, v, mono }: { t: string; v: string; mono?: boolean }) {
  return <div><dt className="text-gris">{t}</dt><dd className={mono ? 'font-mono font-medium' : 'font-medium'}>{v}</dd></div>
}

type OnEnviar = (r: RespuestaCaptura | undefined, cid: string) => Promise<void>

function FormContacto({ exp, onCancelar, onEnviar }: { exp: TExpediente; onCancelar: () => void; onEnviar: OnEnviar }) {
  const p = exp.paciente
  const [f, setF] = useState({ telefono: p.telefono ?? '', correo: p.correo ?? '', municipio: p.municipio ?? '', localidad: p.localidad ?? '' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const t = validarTelefono(f.telefono); if (t) errs.telefono = t
    const c = validarCorreo(f.correo); if (c) errs.correo = c
    const nuevos: Record<string, string | null> = {
      telefono: soloDigitos(f.telefono) || null, correo: f.correo.trim() || null,
      municipio: f.municipio.trim() || null, localidad: f.localidad.trim() || null,
    }
    const cambiados = Object.fromEntries(
      Object.entries(nuevos).filter(([k, v]) => v !== ((p as unknown as Record<string, string | null>)[k] ?? null)))
    if (Object.keys(errs).length === 0 && Object.keys(cambiados).length === 0) errs._ = 'No cambiaste ningún dato.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    const cap: CapturaP = {
      client_id: crypto.randomUUID(), tipo: 'cambio', paciente_id: p.id, version_base: p.version,
      paciente: cambiados, etiqueta: `Cambio de contacto: ${p.folio}`,
    }
    setOcupado(true)
    try { await onEnviar(await enviarCaptura(cap), cap.client_id) } finally { setOcupado(false) }
  }

  return (
    <Tarjeta>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Actualizar contacto</h2>
        {errores._ && <Alerta>{errores._}</Alerta>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="c-tel" etiqueta="Teléfono" error={errores.telefono}>
            <Entrada id="c-tel" type="tel" inputMode="numeric" value={f.telefono} aria-invalid={!!errores.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
          </Campo>
          <Campo id="c-correo" etiqueta="Correo" error={errores.correo}>
            <Entrada id="c-correo" type="email" value={f.correo} aria-invalid={!!errores.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} />
          </Campo>
          <Campo id="c-mun" etiqueta="Municipio">
            <Entrada id="c-mun" value={f.municipio} onChange={(e) => setF({ ...f, municipio: e.target.value })} />
          </Campo>
          <Campo id="c-loc" etiqueta="Localidad">
            <Entrada id="c-loc" value={f.localidad} onChange={(e) => setF({ ...f, localidad: e.target.value })} />
          </Campo>
        </div>
        <p className="text-xs text-gris">El valor anterior queda en la cronología: nada se borra.</p>
        <div className="flex gap-2">
          <Boton type="submit" disabled={ocupado}>Guardar cambios</Boton>
          <Boton type="button" variante="secundario" onClick={onCancelar}>Cancelar</Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

function FormVisita({ exp, onCancelar, onEnviar }: { exp: TExpediente; onCancelar: () => void; onEnviar: OnEnviar }) {
  const sedes = useLiveQuery(() => db.sedes.toArray(), [], [])
  const [sede, setSede] = useState('')
  const [servicio, setServicio] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!sede) errs.sede = 'Elige la sede.'
    if (!servicio) errs.servicio = 'Elige el servicio.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    const cap: CapturaP = {
      client_id: crypto.randomUUID(), tipo: 'visita', paciente_id: exp.paciente.id,
      visita: { fecha: hoyCDMX(), sede_id: Number(sede), servicio },
      etiqueta: `Visita: ${exp.paciente.folio}`,
    }
    setOcupado(true)
    try { await onEnviar(await enviarCaptura(cap), cap.client_id) } finally { setOcupado(false) }
  }

  return (
    <Tarjeta>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Registrar visita de hoy · {fmtFecha(hoyCDMX())}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="v-sede" etiqueta="Sede" error={errores.sede}>
            <Selector id="v-sede" value={sede} aria-invalid={!!errores.sede} onChange={(e) => setSede(e.target.value)}>
              <option value="">Elige…</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo id="v-servicio" etiqueta="Servicio" error={errores.servicio}>
            <Selector id="v-servicio" value={servicio} aria-invalid={!!errores.servicio} onChange={(e) => setServicio(e.target.value)}>
              <option value="">Elige…</option>
              {SERVICIOS.map((s) => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
            </Selector>
          </Campo>
        </div>
        <div className="flex gap-2">
          <Boton type="submit" disabled={ocupado}>Registrar visita</Boton>
          <Boton type="button" variante="secundario" onClick={onCancelar}>Cancelar</Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

function Antecedentes({ pacienteId, inicial, uid }: { pacienteId: string; inicial: string | null; uid?: string }) {
  const [texto, setTexto] = useState(inicial ?? '')
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => setTexto(inicial ?? ''), [inicial])

  const guardar = async () => {
    setOcupado(true)
    const { error } = await supabase.from('paciente_clinico').upsert({
      paciente_id: pacienteId, antecedentes: texto.trim() || null, actualizado_por: uid, actualizado_en: new Date().toISOString(),
    })
    setOcupado(false)
    if (error) return toast.error(esErrorDeRed(error) ? 'Sin internet: los antecedentes se editan con conexión.' : error.message)
    toast.success('Antecedentes guardados'); setEditando(false)
  }

  return (
    <Tarjeta className="flex flex-col gap-3 border-l-4 border-l-jade">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Antecedentes</h2>
        {!editando && <Boton variante="secundario" onClick={() => setEditando(true)}><Pencil size={16} aria-hidden /> Editar</Boton>}
      </div>
      {editando ? (
        <>
          <label htmlFor="antecedentes" className="sr-only">Antecedentes</label>
          <AreaTexto id="antecedentes" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="flex gap-2">
            <Boton variante="jade" disabled={ocupado} onClick={guardar}>Guardar</Boton>
            <Boton variante="secundario" onClick={() => { setTexto(inicial ?? ''); setEditando(false) }}>Cancelar</Boton>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap">{texto || <span className="text-gris">Sin antecedentes registrados.</span>}</p>
      )}
      <p className="text-xs text-gris">Solo el personal médico ve esta sección.</p>
    </Tarjeta>
  )
}

function NotaVisita({ visitaId, inicial, uid }: { visitaId: string; inicial: string | null; uid?: string }) {
  const [texto, setTexto] = useState(inicial ?? '')
  const [ocupado, setOcupado] = useState(false)
  const cambiado = (texto.trim() || null) !== (inicial ?? null)

  const guardar = async () => {
    setOcupado(true)
    const { error } = await supabase.from('visita_nota').upsert({
      visita_id: visitaId, observaciones: texto.trim() || null, autor: uid, creado_en: new Date().toISOString(),
    })
    setOcupado(false)
    if (error) return toast.error(error.message)
    toast.success('Observaciones guardadas')
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label htmlFor={`nota-${visitaId}`} className="text-sm font-semibold">Observaciones clínicas</label>
      <AreaTexto id={`nota-${visitaId}`} className="min-h-16" value={texto} onChange={(e) => setTexto(e.target.value)} />
      {cambiado && <Boton variante="jade" className="self-start" disabled={ocupado} onClick={guardar}>Guardar observaciones</Boton>}
    </div>
  )
}
