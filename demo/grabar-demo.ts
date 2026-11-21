// Demo de BioBytes en video, con subtítulos quemados y archivo .srt.
// Sigue el guion de 2 minutos de la §8 de docs/BioBytes.md.
// Escribe en la base de la demo: al terminar, corre supabase/reinicio-demo.sql.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { credenciales } from '../e2e/ayuda'

const SALIDA = 'demo/salida'

// ---------------------------------------------------------------- subtítulos
interface Linea { desde: number; hasta?: number; texto: string }
const lineas: Linea[] = []
let t0 = 0

/** Muestra un subtítulo en pantalla (sobrevive a recargas) y lo anota para el .srt. */
async function sub(page: Page, texto: string, pausa = 2600) {
  const ahora = Date.now() - t0
  const previa = lineas.at(-1)
  if (previa && previa.hasta === undefined) previa.hasta = ahora
  lineas.push({ desde: ahora, texto })
  await page.evaluate((t) => {
    sessionStorage.setItem('demo-sub', t)
    const el = document.getElementById('demo-sub')
    if (el) { el.textContent = t; el.style.opacity = '1' }
  }, texto)
  await page.waitForTimeout(pausa)
}

function srt(): string {
  const fmt = (ms: number) => {
    const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`
  }
  return lineas.map((l, i) => `${i + 1}\n${fmt(l.desde)} --> ${fmt(l.hasta ?? l.desde + 3000)}\n${l.texto}\n`).join('\n')
}

async function escribir(page: Page, etiqueta: string | RegExp, texto: string) {
  const campo = page.getByLabel(etiqueta)
  await campo.click()
  await campo.pressSequentially(texto, { delay: 70 })
}

// ---------------------------------------------------------------- la demo
test('Demo BioBytes', async ({ page, context }) => {
  // Capa de subtítulos en cada página que se abra.
  await context.addInitScript(() => {
    const poner = () => {
      if (document.getElementById('demo-sub')) return
      const el = document.createElement('div')
      el.id = 'demo-sub'
      el.setAttribute('aria-hidden', 'true')
      el.textContent = sessionStorage.getItem('demo-sub') ?? ''
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%)', 'z-index:2147483647',
        'max-width:86%', 'padding:12px 22px', 'border-radius:14px', 'background:rgba(20,14,24,.86)', 'color:#fff',
        'font:600 24px/1.35 Inter,system-ui,sans-serif', 'text-align:center', 'pointer-events:none',
        'box-shadow:0 6px 24px rgba(0,0,0,.25)', 'transition:opacity .2s',
      ].join(';')
      if (!el.textContent) el.style.opacity = '0'
      document.body.appendChild(el)
    }
    if (document.body) poner()
    else document.addEventListener('DOMContentLoaded', poner)
  })

  t0 = Date.now()
  const telNuevo = '3419998877'

  // 1 · Landing
  await page.goto('/')
  await page.waitForTimeout(800)
  await sub(page, 'María fue a cuatro jornadas de EIRA este año.', 2600)
  await sub(page, 'Hoy tiene cuatro registros, porque se le busca por su nombre. Y en México hay muchas Marías.', 3800)
  await sub(page, 'BioBytes: cada mujer, un solo expediente, aunque no haya internet.', 3200)
  await page.mouse.wheel(0, 650)
  await page.waitForTimeout(1200)
  await page.getByRole('heading', { name: 'Tres pasos en la mesa de registro' }).scrollIntoViewIfNeeded()
  await sub(page, 'Busca, confirma y atiende. BioBytes sugiere; las personas deciden.', 3200)

  // 2 · Captura entra
  await page.goto('/login')
  await sub(page, 'La voluntaria de Captura entra con su cuenta.', 1200)
  const cap = credenciales('captura')
  await escribir(page, 'Correo', cap.correo)
  await page.getByLabel('Contraseña').fill(cap.clave)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/padron$/)
  await sub(page, 'Primero busca en el padrón, antes de registrar a nadie.', 2400)

  // 3 · Alta de María
  await page.getByRole('link', { name: 'Registrar paciente' }).click()
  await sub(page, 'María llega a su ultrasonido. Captura escribe «Maria», sin acento, y su teléfono nuevo.', 1000)
  await escribir(page, 'Nombre *', 'Maria')
  await escribir(page, 'Primer apellido *', 'Ejemplo')
  await page.getByLabel('Fecha de nacimiento *').fill('1980-03-14')
  await escribir(page, 'Teléfono', telNuevo)
  await page.getByLabel('Sede').selectOption({ index: 1 })
  await page.getByLabel('Servicio').selectOption('ultrasonido_mama')
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Buscar coincidencias y registrar' }).click()

  // 4 · ¿Es la misma persona?
  await expect(page.getByRole('heading', { name: '¿Es la misma persona?' })).toBeVisible()
  await sub(page, 'BioBytes no crea nada: encuentra tres expedientes parecidos y explica por qué.', 3600)
  const maria = page.getByRole('listitem').filter({ hasText: 'EIRA-900101' })
  await maria.scrollIntoViewIfNeeded()
  await sub(page, 'Solo una tiene su misma fecha de nacimiento: «Muy probable».', 3200)
  await sub(page, 'La persona confirma con la paciente. Nada se fusiona sin su decisión.', 2400)
  await maria.getByRole('button', { name: 'Sí, es ella: usar este expediente' }).click()

  // 5 · Expediente
  await expect(page).toHaveURL(/\/expediente\//)
  await expect(page.getByRole('listitem').filter({ hasText: telNuevo }).locator('del')).toBeVisible()
  await sub(page, 'La visita cae en su expediente de siempre: EIRA-900101.', 3000)
  await page.getByRole('heading', { name: 'Cronología' }).scrollIntoViewIfNeeded()
  await sub(page, 'Cambió de teléfono: el anterior queda tachado en la historia. Nada se borra.', 3600)

  // 6 · Sin internet
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sub(page, 'Ahora se va la señal…', 1400)
  await context.setOffline(true)
  await expect(page.getByText('Sin internet', { exact: true })).toBeVisible()
  await sub(page, 'La barra lo dice claro: «Sin internet». Y la app sigue funcionando.', 3000)
  await page.getByRole('button', { name: 'Registrar visita de hoy' }).click()
  await page.getByLabel('Sede').selectOption({ index: 1 })
  await page.getByLabel('Servicio').selectOption('exploracion_mama')
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Registrar visita', exact: true }).click()
  await expect(page.getByText(/1 pendiente de enviar/)).toBeVisible()
  await sub(page, 'La visita queda «Pendiente de enviar», guardada y cifrada en la laptop.', 3400)
  await page.reload()
  await expect(page.getByText(/1 pendiente de enviar/)).toBeVisible()
  await sub(page, 'Aunque se recargue la página sin internet, la app abre y la captura sigue ahí.', 3600)

  // 7 · Vuelve la señal
  await sub(page, 'Vuelve la señal…', 1200)
  await context.setOffline(false)
  await expect(page.getByText('En línea', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Capturada sin conexión').first()).toBeVisible({ timeout: 40_000 })
  await page.getByText('Capturada sin conexión').first().scrollIntoViewIfNeeded()
  await sub(page, '…y se sincroniza sola, marcada como «Capturada sin conexión».', 3600)

  // 8 · El personal médico
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sub(page, 'Al cerrar sesión, se borra todo lo guardado en la laptop.', 1600)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await sub(page, 'Ahora entra la doctora, con su propio perfil.', 1000)
  const med = credenciales('medico')
  await escribir(page, 'Correo', med.correo)
  await page.getByLabel('Contraseña').fill(med.clave)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/padron$/)
  await page.getByLabel(/Busca a la paciente/).pressSequentially('900101', { delay: 80 })
  await page.getByRole('link', { name: /Abrir expediente EIRA-900101/ }).click()
  await expect(page.getByRole('heading', { name: 'Antecedentes' })).toBeVisible()
  await sub(page, 'Ella sí ve los antecedentes antes de atender. Captura no los ve.', 3400)
  await sub(page, 'No es solo ocultar botones: los permisos se revisan en el servidor.', 3200)

  // 9 · Cierre
  await page.goto('/')
  await page.getByRole('heading', { name: /Prevenir hoy para salvar vidas/ }).scrollIntoViewIfNeeded()
  await sub(page, 'Es real: Supabase con permisos por rol, PWA sin conexión, cola cifrada y Valkey.', 3600)
  await sub(page, 'Siguiente paso: un piloto con EIRA, con revisión jurídica y de seguridad.', 3400)
  await sub(page, 'BioBytes · Cada mujer, un solo expediente.', 3000)
  lineas.at(-1)!.hasta = Date.now() - t0

  // Guardar el .srt; el video se copia cuando Playwright cierra la página.
  mkdirSync(SALIDA, { recursive: true })
  writeFileSync(`${SALIDA}/biobytes-demo.srt`, srt(), 'utf8')
  const video = page.video()
  await page.close()
  if (video) copyFileSync(await video.path(), `${SALIDA}/biobytes-demo.webm`)
})
