// BB-12b · Imprimir / guardar como PDF con window.print(): funciona sin internet, no agrega
// librerías e imprime solo lo que el rol ya puede ver (abrir_expediente ya filtra lo clínico).
import { estaEnLinea } from './conexion'
import { supabase } from './supabase'

export type TipoImpresion = 'expediente' | 'comprobante'

const ID_ESTILO = 'biobytes-pagina'

function estiloPagina(tipo: TipoImpresion, folio: string) {
  const pie = tipo === 'expediente'
    ? `"CONFIDENCIAL · Contiene datos personales de salud · Folio ${folio} · Página " counter(page) " de " counter(pages)`
    : `"BioBytes · EIRA Movimiento Rosa · Comprobante sin datos clínicos"`
  const tam = tipo === 'expediente' ? 'letter' : '5.5in 8.5in' // carta · media carta
  return `@page { size: ${tam}; margin: 14mm 14mm 18mm;
    @bottom-center { content: ${pie}; font: 8pt Inter, sans-serif; color: #444; } }`
}

/**
 * Imprime el expediente o el comprobante de visita. Antes registra la impresión en la bitácora;
 * sin red se imprime igual (la contingencia no puede depender de la conexión).
 */
export async function imprimir(tipo: TipoImpresion, pacienteId: string, folio: string) {
  if (estaEnLinea()) {
    await supabase.rpc('registrar_impresion', { p_id: pacienteId, p_tipo: tipo })
  }
  document.getElementById(ID_ESTILO)?.remove()
  const estilo = document.createElement('style')
  estilo.id = ID_ESTILO
  estilo.textContent = estiloPagina(tipo, folio)
  document.head.appendChild(estilo)
  document.body.dataset.imprimir = tipo
  const limpiar = () => {
    delete document.body.dataset.imprimir
    estilo.remove()
    window.removeEventListener('afterprint', limpiar)
  }
  window.addEventListener('afterprint', limpiar)
  window.print()
}

/** Fecha y hora actuales en CDMX, para el encabezado impreso. */
export function ahoraCDMX() {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City', dateStyle: 'long', timeStyle: 'short',
  }).format(new Date())
}

/** Solo los últimos 4 caracteres de la CURP en papel. */
export function curpImpresa(curp: string | null) {
  return curp ? `••••••••••••••${curp.slice(-4)}` : '—'
}
