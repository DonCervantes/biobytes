import { Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Boton } from '@/components/ui'
import { SERVICIOS } from '@/lib/utils'

/**
 * BB-11 · Contingencia: formato en blanco para capturar en papel si todo falla.
 * No tiene datos, no requiere sesión y queda en caché del service worker (abre sin internet).
 */
export function Formato() {
  return (
    <div className="min-h-dvh bg-arena print:bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 print:hidden">
        <Link to="/" aria-label="BioBytes, inicio"><Logo /></Link>
        <Boton onClick={() => {
          document.getElementById('biobytes-pagina')?.remove()
          window.print()
        }}><Printer size={18} aria-hidden /> Imprimir formato</Boton>
      </div>

      <article className="mx-auto mb-10 max-w-3xl rounded-bb border border-borde bg-white p-8 text-tinta print:m-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex items-center justify-between border-b-2 border-tinta pb-2">
          <div>
            <h1 className="font-sans text-xl font-extrabold">Formato de registro · Jornada de salud</h1>
            <p className="text-xs">BioBytes · EIRA Movimiento Rosa · Capturar en BioBytes al volver la conexión</p>
          </div>
          <img src="/icon.svg" alt="" className="h-10 w-auto" />
        </header>

        <Seccion titulo="¿Ya tiene folio?">
          <Linea etiqueta="Folio EIRA-" ancho="w-48" /> <Casilla texto="Primera visita" />
        </Seccion>

        <Seccion titulo="Datos de la paciente">
          <div className="grid grid-cols-3 gap-x-6">
            <Linea etiqueta="Nombre(s)" /><Linea etiqueta="Primer apellido" /><Linea etiqueta="Segundo apellido" />
            <Linea etiqueta="Fecha de nacimiento (DD/MM/AAAA)" /><Linea etiqueta="CURP (opcional)" /><Linea etiqueta="Teléfono (10 dígitos)" />
            <Linea etiqueta="Correo" /><Linea etiqueta="Municipio" /><Linea etiqueta="Localidad" />
          </div>
        </Seccion>

        <Seccion titulo="Antecedentes (los verá solo el personal médico)">
          <div className="h-20 border-b border-tinta" /><div className="h-8 border-b border-tinta" />
        </Seccion>

        <Seccion titulo="Servicio de hoy">
          <div className="grid grid-cols-2 gap-x-6">
            <Linea etiqueta="Fecha" /><Linea etiqueta="Sede" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {SERVICIOS.map((s) => <Casilla key={s.valor} texto={s.etiqueta} />)}
          </div>
        </Seccion>

        <Seccion titulo="Control">
          <div className="grid grid-cols-2 gap-x-6">
            <Linea etiqueta="Capturó (nombre)" /><Linea etiqueta="Fecha en que se pasó a BioBytes" />
          </div>
        </Seccion>

        <p className="mt-6 text-[10px]">
          CONFIDENCIAL · Contiene datos personales de salud. Resguárdalo y destrúyelo de forma segura una vez capturado.
        </p>
      </article>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-2 font-sans text-sm font-bold uppercase tracking-wide">{titulo}</h2>
      {children}
    </section>
  )
}

function Linea({ etiqueta, ancho = 'w-full' }: { etiqueta: string; ancho?: string }) {
  return (
    <div className={`${ancho} inline-block pt-5`}>
      <div className="border-b border-tinta" />
      <p className="mt-0.5 text-[10px] text-gris print:text-black">{etiqueta}</p>
    </div>
  )
}

function Casilla({ texto }: { texto: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="inline-block size-4 border border-tinta" /> {texto}
    </span>
  )
}
