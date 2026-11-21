// BB-17 · Recorrido de punta a punta en un navegador real.
// Usan la base de la demo: al terminar, reiníciala con supabase/reinicio-demo.sql.
import { expect, test } from '@playwright/test'
import { abrirExpediente, entrar, telefonoAleatorio } from './ayuda'

test.describe.configure({ mode: 'serial' })

test('María regresa: BioBytes sugiere, la persona confirma y la visita cae en su expediente', async ({ page }) => {
  const tel = telefonoAleatorio()
  await entrar(page, 'captura')

  await page.getByRole('link', { name: 'Registrar paciente' }).click()
  await page.getByLabel('Nombre *').fill('Maria') // sin acento, a propósito
  await page.getByLabel('Primer apellido *').fill('Ejemplo')
  await page.getByLabel('Fecha de nacimiento *').fill('1980-03-14')
  await page.getByLabel('Teléfono').fill(tel)
  await page.getByLabel('Sede').selectOption({ index: 1 })
  await page.getByLabel('Servicio').selectOption('ultrasonido_mama')
  await page.getByRole('button', { name: 'Buscar coincidencias y registrar' }).click()

  // El servidor no crea nada: muestra candidatas con nivel y razones.
  await expect(page.getByRole('heading', { name: '¿Es la misma persona?' })).toBeVisible()
  const maria = page.getByRole('listitem').filter({ hasText: 'EIRA-900101' })
  await expect(maria.getByText('Muy probable')).toBeVisible()
  await expect(maria.getByText('Misma fecha de nacimiento')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'EIRA-900102' }).getByText('Revisar')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'EIRA-900103' }).getByText('Revisar')).toBeVisible()

  await maria.getByRole('button', { name: 'Sí, es ella: usar este expediente' }).click()

  // Vínculo + teléfono nuevo en una sola operación; el anterior queda tachado.
  await expect(page).toHaveURL(/\/expediente\//)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('María Ejemplo López')
  await expect(page.getByRole('listitem').filter({ hasText: tel }).locator('del')).toBeVisible()
  await expect(page.getByText('Ultrasonido de mama').first()).toBeVisible()

  // En el padrón no aparece una cuarta María: sigue habiendo un solo expediente de María Ejemplo López.
  await page.goto('/padron')
  await page.getByLabel(/Busca a la paciente/).fill('maria ejemplo')
  await expect(page.getByRole('link', { name: /Abrir expediente EIRA-900101/ })).toBeVisible()
  const filas = await page.locator('tr[role="link"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  expect(filas.filter((f) => f.includes('María Ejemplo López'))).toHaveLength(1)
})

test('Sin internet: la app abre, guarda la visita cifrada y la envía sola al volver la red', async ({ page, context }) => {
  await entrar(page, 'captura')
  await page.evaluate(() => navigator.serviceWorker.ready) // el service worker ya tiene la app en caché
  await abrirExpediente(page, 'EIRA-900101')
  const insignias = page.getByText('Capturada sin conexión')
  const antes = await insignias.count()

  await context.setOffline(true)
  await expect(page.getByText('Sin internet', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Registrar visita de hoy' }).click()
  await page.getByLabel('Sede').selectOption({ index: 1 })
  await page.getByLabel('Servicio').selectOption('exploracion_mama')
  await page.getByRole('button', { name: 'Registrar visita', exact: true }).click()
  await expect(page.getByText(/1 pendiente de enviar/)).toBeVisible()

  // La captura queda en IndexedDB solo como bytes cifrados.
  const legible = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((ok) => { const q = indexedDB.open('biobytes'); q.onsuccess = () => ok(q.result) })
    const filas: Array<{ pc: { ct: ArrayBuffer } }> = await new Promise((ok) => {
      const t = db.transaction('cola').objectStore('cola').getAll(); t.onsuccess = () => ok(t.result)
    })
    db.close()
    return filas.some((f) => /exploracion|EIRA|Visita/i.test(new TextDecoder('latin1').decode(f.pc.ct)))
  })
  expect(legible).toBe(false)

  // Recargar SIN red: la app abre desde el service worker y la captura sigue ahí.
  await page.reload()
  await expect(page.getByText('Sin internet', { exact: true })).toBeVisible()
  await expect(page.getByText(/1 pendiente de enviar/)).toBeVisible()
  await expect(page.getByText('Pendiente de enviar', { exact: true })).toBeVisible()

  // Vuelve la red: se sincroniza sola y queda marcada como capturada sin conexión.
  await context.setOffline(false)
  await expect(page.getByText('En línea', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/pendiente de enviar/i)).toHaveCount(0, { timeout: 40_000 })
  await expect(insignias).toHaveCount(antes + 1, { timeout: 15_000 })
})

test('Roles: el personal médico ve antecedentes; Captura no', async ({ browser }) => {
  const medico = await (await browser.newContext()).newPage()
  await entrar(medico, 'medico')
  await abrirExpediente(medico, 'EIRA-900101')
  await expect(medico.getByRole('heading', { name: 'Antecedentes' })).toBeVisible()
  await expect(medico.getByRole('button', { name: 'Registrar visita de hoy' })).toHaveCount(0)
  await expect(medico.getByRole('link', { name: 'Registrar' })).toHaveCount(0)

  const captura = await (await browser.newContext()).newPage()
  await entrar(captura, 'captura')
  await abrirExpediente(captura, 'EIRA-900101')
  await expect(captura.getByRole('button', { name: 'Registrar visita de hoy' })).toBeVisible()
  await expect(captura.getByRole('heading', { name: 'Antecedentes' })).toHaveCount(0)
})

test('Auditoría verifica la integridad de la bitácora', async ({ page }) => {
  await entrar(page, 'auditor')
  await page.getByRole('button', { name: 'Verificar integridad' }).click()
  await expect(page.getByText(/Cadena íntegra \(\d+ registros\)/)).toBeVisible()
})

test('Cerrar sesión borra todo lo guardado en el dispositivo, incluida la llave', async ({ page }) => {
  await entrar(page, 'captura')
  await expect.poll(() => page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((ok) => { const q = indexedDB.open('biobytes'); q.onsuccess = () => ok(q.result) })
    const n: number = await new Promise((ok) => { const t = db.transaction('padron').objectStore('padron').count(); t.onsuccess = () => ok(t.result) })
    db.close()
    return n
  })).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  const restos = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((ok) => { const q = indexedDB.open('biobytes'); q.onsuccess = () => ok(q.result) })
    const contar = (s: string): Promise<number> => new Promise((ok) => { const t = db.transaction(s).objectStore(s).count(); t.onsuccess = () => ok(t.result) })
    const r = { cola: await contar('cola'), padron: await contar('padron'), sedes: await contar('sedes'), llave: await contar('meta') }
    db.close()
    return r
  })
  expect(restos).toEqual({ cola: 0, padron: 0, sedes: 0, llave: 0 })
})
