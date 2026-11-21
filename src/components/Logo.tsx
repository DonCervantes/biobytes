import { cn } from '@/lib/utils'

/** Logotipo: símbolo + palabra «BioBytes» en tinta, como en el logo oficial. */
export function Logo({ tam = 'normal', className }: { tam?: 'normal' | 'grande'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center', tam === 'grande' ? 'gap-3' : 'gap-2', className)}>
      <img src="/icon.svg" alt="" className={tam === 'grande' ? 'h-12 w-auto' : 'h-8 w-auto'} />
      <span className={cn(
        'font-sans font-extrabold tracking-tight text-tinta',
        tam === 'grande' ? 'text-4xl' : 'text-[1.4rem]',
      )}>BioBytes</span>
    </span>
  )
}
