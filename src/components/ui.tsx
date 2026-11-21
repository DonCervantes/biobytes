import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const boton = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-bb px-4 py-2 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55',
  {
    variants: {
      variante: {
        primario: 'bg-primario text-white hover:bg-primario-hover',
        secundario: 'border border-borde bg-white text-tinta hover:bg-niebla',
        jade: 'bg-jade text-white hover:bg-[#186457]',
        fantasma: 'text-primario hover:bg-niebla',
        peligro: 'border border-rojo bg-white text-rojo hover:bg-rojo-claro',
      },
      tam: { normal: '', grande: 'min-h-13 px-5 text-base' },
    },
    defaultVariants: { variante: 'primario', tam: 'normal' },
  },
)

export function Boton({ className, variante, tam, ...props }: ComponentProps<"button"> & VariantProps<typeof boton>) {
  return <button className={cn(boton({ variante, tam }), className)} {...props} />
}
export { boton as estiloBoton }

export function Tarjeta({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-bb border border-borde bg-white p-5 shadow-sm', className)}>{children}</section>
}

const control = 'min-h-11 w-full rounded-[10px] border border-borde bg-white px-3 py-2 text-tinta placeholder:text-gris/70 focus:border-primario focus:outline-none aria-[invalid=true]:border-rojo'

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />
}

export function Selector({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, className)} {...props} />
}

export function AreaTexto({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24', className)} {...props} />
}

export function Campo({ id, etiqueta, error, ayuda, children, className }: {
  id: string; etiqueta: string; error?: string; ayuda?: string; children: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-tinta">{etiqueta}</label>
      {children}
      {ayuda && !error && <p className="text-xs text-gris">{ayuda}</p>}
      {error && <p id={`${id}-error`} className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  )
}

const insignia = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    tono: {
      rosa: 'bg-primario text-white',
      info: 'bg-info text-white',
      ambar: 'bg-ambar-claro text-ambar',
      jade: 'bg-jade-claro text-jade',
      rojo: 'bg-rojo-claro text-rojo',
      neutro: 'bg-arena text-gris border border-borde',
    },
  },
  defaultVariants: { tono: 'neutro' },
})

export function Insignia({ tono, className, children }: VariantProps<typeof insignia> & { className?: string; children: ReactNode }) {
  return <span className={cn(insignia({ tono }), className)}>{children}</span>
}

export function Alerta({ children, tono = 'rojo' }: { children: ReactNode; tono?: 'rojo' | 'ambar' | 'info' }) {
  const t = { rojo: 'border-rojo bg-rojo-claro text-rojo', ambar: 'border-ambar bg-ambar-claro text-ambar', info: 'border-info bg-info-claro text-info' }[tono]
  return <div role="alert" className={cn('rounded-bb border-l-4 px-4 py-3 text-sm font-medium', t)}>{children}</div>
}

export function Folio({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono font-semibold tracking-tight text-primario', className)}>{children}</span>
}
