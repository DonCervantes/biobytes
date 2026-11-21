import {
  ArrowRight, CircleCheck, CloudOff, FileSpreadsheet, HeartHandshake, Laptop, Lock, MapPin, Search,
  ShieldCheck, Stethoscope, UserCheck, Users, Wifi, type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Logo'
import { estiloBoton } from '@/components/ui'
import { cn } from '@/lib/utils'

const PILARES = [
  { t: 'Encuentra sin duplicar', d: 'busca por nombre, fecha de nacimiento, CURP o teléfono.' },
  { t: 'Tú decides', d: 'BioBytes sugiere coincidencias, nunca une expedientes solo.' },
  { t: 'Funciona sin señal', d: 'captura en campo y se sincroniza al volver la conexión.' },
  { t: 'Datos protegidos', d: 'cada perfil ve solo lo que necesita.' },
]

const PROBLEMAS: { i: LucideIcon; t: string; d: string }[] = [
  { i: Users, t: 'Cuatro visitas, cuatro registros.', d: 'Hoy a la paciente se le identifica por su nombre, y «María López» puede ser muchas mujeres.' },
  { i: CloudOff, t: 'Sin señal no hay sistema.', d: 'En muchas comunidades el internet va y viene.' },
  { i: FileSpreadsheet, t: 'Datos de salud en hojas de cálculo.', d: 'Información sensible sin control de quién la ve.' },
]

const PASOS: { i: LucideIcon; t: string; d: string }[] = [
  { i: Search, t: 'Busca', d: 'con nombre, folio, CURP o teléfono, con o sin acentos.' },
  { i: UserCheck, t: 'Confirma', d: 'BioBytes sugiere y tú decides. Nunca une expedientes por su cuenta.' },
  { i: Stethoscope, t: 'Atiende', d: 'la visita queda en su historial, con o sin internet.' },
]

const MEXICO = [
  { i: Laptop, t: 'Funciona en las laptops que ya tienen, sin instalar nada.' },
  { i: HeartHandshake, t: 'Folio EIRA-###### en una tarjeta que la paciente conserva.' },
  { i: UserCheck, t: 'CURP opcional: sirve para buscar, nunca es obligatoria para atender.' },
  { i: MapPin, t: 'Horario y fechas de la Ciudad de México; catálogo de municipios y localidades.' },
  { i: ShieldCheck, t: 'Diseñado pensando en la protección de datos personales de salud.' },
]

const PARA_QUIEN = ['Organizaciones de la sociedad civil', 'DIF y gobiernos municipales', 'Brigadas universitarias y de servicio social', 'Clínicas comunitarias']

export function Landing() {
  const { session, rol } = useAuth()
  const destino = session && rol ? (rol === 'auditor' ? '/bitacora' : '/padron') : '/login'
  const textoEntrar = session && rol ? 'Ir a BioBytes' : 'Entrar'

  return (
    <div className="min-h-dvh overflow-x-clip">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-bb focus:bg-white focus:px-4 focus:py-2">
        Saltar al contenido
      </a>

      {/* 0 · Barra de navegación */}
      <header className="sticky top-0 z-30 border-b border-borde/70 bg-arena/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <a href="#inicio" aria-label="BioBytes, inicio"><Logo /></a>
          <nav aria-label="Secciones de la página" className="hidden gap-1 md:flex">
            {[['#como-funciona', 'Cómo funciona'], ['#privacidad', 'Privacidad'], ['#para-quien', 'Para quién']].map(([h, t]) => (
              <a key={h} href={h} className="rounded-[10px] px-3 py-2 font-semibold text-tinta hover:bg-niebla">{t}</a>
            ))}
          </nav>
          <Link to={destino} className={cn(estiloBoton({ variante: 'primario' }), 'ml-auto')}>{textoEntrar}</Link>
        </div>
      </header>

      <main id="contenido">
        {/* 1 · Hero */}
        <section id="inicio" className="relative">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-32 size-[28rem] rounded-full bg-niebla blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute top-64 -left-40 size-80 rounded-full bg-jade-claro blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
            <div className="min-w-0">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-primario shadow-sm">
                <HeartHandshake size={16} aria-hidden /> Para brigadas de salud en México
              </p>
              <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight break-words text-tinta min-[400px]:text-5xl sm:text-6xl">
                Cada mujer, <span className="text-primario">un solo expediente.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-gris">
                La herramienta para brigadas de salud que reconoce a cada paciente que regresa, en la sierra,
                en la colonia o en la plaza del pueblo, aunque no haya internet.
              </p>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {PILARES.map((p) => (
                  <li key={p.t} className="flex gap-2.5">
                    <CircleCheck className="mt-0.5 shrink-0 text-jade" size={20} aria-hidden />
                    <span><strong className="font-semibold">{p.t}:</strong> <span className="text-gris">{p.d}</span></span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#como-funciona" className={estiloBoton({ variante: 'primario', tam: 'grande' })}>
                  Ver demo en 2 minutos <ArrowRight size={18} aria-hidden />
                </a>
                <Link to={destino} className={estiloBoton({ variante: 'secundario', tam: 'grande' })}>{textoEntrar}</Link>
              </div>
            </div>
            <Ilustracion />
          </div>
        </section>

        {/* 2 · El problema */}
        <section aria-labelledby="t-problema" className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-bold tracking-wide text-primario uppercase">El problema</p>
            <h2 id="t-problema" className="mt-2 max-w-2xl text-3xl font-extrabold sm:text-4xl">
              Una paciente que regresa no debería empezar de cero.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PROBLEMAS.map(({ i: Icono, t, d }) => (
                <article key={t} className="rounded-bb border border-borde bg-arena p-6">
                  <span className="grid size-12 place-items-center rounded-full bg-niebla text-primario"><Icono aria-hidden /></span>
                  <h3 className="mt-4 text-xl font-bold">{t}</h3>
                  <p className="mt-2 text-gris">{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 3 · Cómo funciona */}
        <section id="como-funciona" aria-labelledby="t-como" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-bold tracking-wide text-primario uppercase">Cómo funciona</p>
            <h2 id="t-como" className="mt-2 text-3xl font-extrabold sm:text-4xl">Tres pasos en la mesa de registro</h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {PASOS.map(({ i: Icono, t, d }, n) => (
                <li key={t} className="relative rounded-bb border border-borde bg-white p-6 shadow-sm">
                  <span className="absolute top-5 right-5 font-mono text-4xl font-semibold text-niebla" aria-hidden>{n + 1}</span>
                  <span className="grid size-12 place-items-center rounded-full bg-primario text-white"><Icono aria-hidden /></span>
                  <h3 className="mt-4 text-2xl font-extrabold">{n + 1}. {t}</h3>
                  <p className="mt-2 text-gris">{d}</p>
                </li>
              ))}
            </ol>
            <Demo />
          </div>
        </section>

        {/* 4 · Hecho para México */}
        <section aria-labelledby="t-mexico" className="bg-jade py-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-sm font-bold tracking-wide text-jade-claro uppercase">Hecho aquí</p>
              <h2 id="t-mexico" className="mt-2 text-3xl font-extrabold sm:text-4xl">Hecho para las jornadas en México</h2>
              <p className="mt-4 text-jade-claro">Pensado para la realidad de una brigada: laptops compartidas, filas largas y señal que va y viene.</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {MEXICO.map(({ i: Icono, t }) => (
                <li key={t} className="flex gap-3 rounded-bb bg-white/10 p-4">
                  <Icono className="mt-0.5 shrink-0" size={22} aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5 · Privacidad por diseño */}
        <section id="privacidad" aria-labelledby="t-privacidad" className="scroll-mt-20 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold tracking-wide text-primario uppercase">Privacidad por diseño</p>
              <h2 id="t-privacidad" className="mt-2 text-3xl font-extrabold sm:text-4xl">Cada perfil ve solo lo que necesita.</h2>
              <p className="mt-4 text-lg text-gris">
                Los antecedentes clínicos solo los ve el personal médico. Cada consulta queda en una bitácora que
                nadie puede alterar sin que se note.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                { i: Users, t: 'Captura', d: 'Busca, registra visitas y actualiza contacto. No ve antecedentes.' },
                { i: Stethoscope, t: 'Personal médico', d: 'Ve la cronología y los antecedentes antes de atender.' },
                { i: Lock, t: 'Auditoría', d: 'Verifica que la bitácora esté íntegra, sin abrir expedientes.' },
              ].map(({ i: Icono, t, d }) => (
                <div key={t} className="flex gap-4 rounded-bb border border-borde bg-white p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-niebla text-primario"><Icono size={20} aria-hidden /></span>
                  <div><p className="font-bold">{t}</p><p className="text-gris">{d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6 · Impacto */}
        <section aria-labelledby="t-impacto" className="bg-niebla py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="t-impacto" className="sr-only">Impacto</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {[['40,000+', 'mujeres acompañadas por EIRA'], ['86,000', 'estudios realizados']].map(([n, t]) => (
                <div key={t} className="rounded-bb bg-white p-8 text-center shadow-sm">
                  <p className="font-titulo text-5xl font-extrabold text-primario sm:text-6xl">{n}</p>
                  <p className="mt-2 text-lg font-semibold">{t}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-3xl text-center text-lg text-tinta">
              EIRA ha acompañado a más de 40,000 mujeres y realizado 86,000 estudios desde Zapotlán el Grande, Jalisco.
              BioBytes existe para que ninguna de esas historias se pierda entre registros duplicados.
            </p>
          </div>
        </section>

        {/* 7 · Para quién */}
        <section id="para-quien" aria-labelledby="t-quien" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <p className="text-sm font-bold tracking-wide text-primario uppercase">Para quién</p>
            <h2 id="t-quien" className="mt-2 text-3xl font-extrabold sm:text-4xl">Para quien lleva la salud a la comunidad</h2>
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {PARA_QUIEN.map((t) => (
                <li key={t} className="rounded-full border border-borde bg-white px-5 py-3 font-semibold shadow-sm">{t}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* 8 · Llamado final */}
        <section aria-labelledby="t-final" className="px-4 pb-20">
          <div className="mx-auto max-w-6xl rounded-[28px] bg-primario px-6 py-14 text-center text-white sm:px-12">
            <h2 id="t-final" className="mx-auto max-w-3xl text-3xl font-extrabold sm:text-4xl">
              Prevenir hoy para salvar vidas mañana, con datos que sí se encuentran.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#como-funciona" className={cn(estiloBoton({ tam: 'grande' }), 'bg-white text-primario hover:bg-niebla')}>
                Ver demo en 2 minutos <ArrowRight size={18} aria-hidden />
              </a>
              <span className="inline-flex min-h-13 items-center rounded-bb border border-white/40 px-5 font-semibold">
                Código abierto · Licencia MIT
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-borde bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-gris sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <img src="/icon.svg" alt="" className="h-6 w-auto" />
            Un proyecto hermano de EIRA Movimiento Rosa A.C.
          </p>
          <p>Aviso de privacidad (en preparación) · Licencia MIT · Hecho en México 🇲🇽</p>
        </div>
      </footer>
    </div>
  )
}

/** Mesa de registro: la app reconociendo a la paciente y su tarjeta con folio (datos ficticios). */
function Ilustracion() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div className="rounded-[22px] border border-borde bg-white p-3 shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-borde px-2 pb-2.5">
          <span className="size-2.5 rounded-full bg-rosa/60" /><span className="size-2.5 rounded-full bg-ambar/50" /><span className="size-2.5 rounded-full bg-jade/50" />
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-jade-claro px-2 py-0.5 text-[11px] font-semibold text-jade">
            <Wifi size={11} /> En línea
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-[10px] border-2 border-borde px-3 py-2 text-sm text-gris">
            <Search size={15} /> maria ejemplo
          </div>
          <p className="mt-4 font-titulo text-lg font-extrabold">¿Es la misma persona?</p>
          <div className="mt-2 rounded-[12px] border-2 border-primario p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold">María Ejemplo López</p>
                <p className="font-mono text-sm font-semibold text-primario">EIRA-900101</p>
              </div>
              <span className="rounded-full bg-primario px-2 py-0.5 text-[11px] font-semibold text-white">Muy probable</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-full bg-jade-claro px-2 py-0.5 text-[11px] font-semibold text-jade">Misma fecha de nacimiento</span>
              <span className="rounded-full bg-jade-claro px-2 py-0.5 text-[11px] font-semibold text-jade">Mismo nombre (sin acentos)</span>
            </div>
            <div className="mt-3 rounded-[10px] bg-primario py-2 text-center text-sm font-semibold text-white">Sí, es ella: usar este expediente</div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-[12px] border border-borde p-3 opacity-70">
            <div>
              <p className="text-sm font-bold">Mariana Ejemplo López</p>
              <p className="font-mono text-xs font-semibold text-primario">EIRA-900102</p>
            </div>
            <span className="rounded-full bg-info px-2 py-0.5 text-[11px] font-semibold text-white">Revisar</span>
          </div>
        </div>
      </div>
      {/* Tarjeta con folio */}
      <div className="absolute -bottom-8 -left-4 w-52 rotate-[-6deg] rounded-[14px] bg-gradient-to-br from-rosa to-primario p-4 text-white shadow-xl sm:-left-10">
        <p className="text-[11px] font-semibold tracking-wide uppercase opacity-80">Tarjeta de paciente</p>
        <p className="mt-1 font-mono text-xl font-semibold">EIRA-900101</p>
        <p className="mt-3 text-xs opacity-90">Preséntala en tu próxima jornada</p>
      </div>
      {/* Sin internet */}
      <div className="absolute -top-5 -right-2 rotate-[4deg] rounded-full bg-ambar-claro px-3 py-1.5 text-sm font-semibold text-ambar shadow-md sm:-right-6">
        <CloudOff size={14} className="mr-1 inline" /> 1 pendiente de enviar
      </div>
    </div>
  )
}

/** Guion de la demo de 2 minutos (§8), en tarjetas. */
function Demo() {
  const pasos = [
    ['0:15', 'María llega a su ultrasonido', 'Captura escribe «Maria», sin acento. BioBytes no crea nada: encuentra tres parecidas y explica por qué.'],
    ['0:45', 'Una persona confirma', 'Solo una tiene su misma fecha de nacimiento. «Sí, es ella» y la visita cae en su expediente.'],
    ['1:00', 'Cambió de teléfono', 'Se actualiza y el anterior queda tachado en la historia: nada se borra.'],
    ['1:20', 'Se va la señal', 'La app abre, busca y captura. «Pendiente de enviar», y al volver la red se sincroniza sola.'],
    ['1:50', 'La doctora ve los antecedentes', 'Captura no. Los permisos se revisan en el servidor, no solo ocultando botones.'],
  ]
  return (
    <div className="mt-14 rounded-bb border border-borde bg-white p-6 shadow-sm sm:p-8">
      <h3 className="text-2xl font-extrabold">La demo en 2 minutos</h3>
      <ol className="mt-6 grid gap-4 md:grid-cols-5">
        {pasos.map(([t, h, d]) => (
          <li key={t} className="border-l-4 border-rosa pl-4 md:border-t-4 md:border-l-0 md:pt-3 md:pl-0">
            <p className="font-mono text-sm font-semibold text-primario">{t}</p>
            <p className="mt-1 font-bold">{h}</p>
            <p className="mt-1 text-sm text-gris">{d}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
