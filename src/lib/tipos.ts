export type Rol = 'captura' | 'medico' | 'coordinacion' | 'admin' | 'auditor'

export interface Candidata {
  paciente_id: string
  folio: string
  nombre_completo: string
  fecha_nacimiento: string
  municipio: string | null
  telefono_mask: string | null
  nivel: 'alta' | 'posible'
  razones: string[]
  preliminar?: boolean
}

export interface DatosPaciente {
  nombre?: string
  apellido_paterno?: string
  apellido_materno?: string | null
  fecha_nacimiento?: string
  curp?: string | null
  telefono?: string | null
  correo?: string | null
  municipio?: string | null
  localidad?: string | null
  antecedentes?: string | null
}

/** Payload de registrar_captura. */
export interface CapturaP {
  client_id: string
  tipo: 'alta' | 'visita' | 'cambio'
  origen?: 'en_linea' | 'sin_conexion'
  decision?: 'vincular' | 'nueva'
  paciente_id?: string
  descartadas?: string[]
  version_base?: number
  paciente?: DatosPaciente
  visita?: { fecha: string; sede_id: number; servicio: string } | null
  /** Solo para la interfaz: nombre a mostrar en la cola. No lo usa el servidor. */
  etiqueta?: string
}

export type RespuestaCaptura =
  | { client_id: string; estado: 'ok'; paciente_id: string; folio: string }
  | { client_id: string; estado: 'coincidencias'; candidatas: Candidata[] }
  | { client_id: string; estado: 'conflicto'; servidor: Record<string, string | number | null> & { version: number } }
  | { client_id: string; estado: 'error'; mensaje: string }

export interface FilaPadron {
  id: string
  folio: string
  nombre_completo: string
  fecha_nacimiento: string
  municipio: string | null
  num_visitas: number | null
  ultima_visita: string | null
  version: number
}

export interface Sede {
  id: number
  nombre: string
  municipio: string
  localidad: string | null
}

export interface Expediente {
  rol: Rol
  paciente: {
    id: string
    folio: string
    nombre: string
    apellido_paterno: string
    apellido_materno: string | null
    fecha_nacimiento: string
    curp: string | null
    telefono: string | null
    correo: string | null
    municipio: string | null
    localidad: string | null
    version: number
  }
  visitas: { id: string; fecha: string; servicio: string; sede: string; origen: string; nota: string | null }[]
  cambios: { campo: string; antes: string | null; despues: string | null; en: string }[]
  antecedentes: string | null
}
