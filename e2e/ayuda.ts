import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

export type Perfil = 'captura' | 'medico' | 'auditor'

/**
 * Contraseñas de las cuentas de prueba: de las variables E2E_CAPTURA_PASS, E2E_MEDICO_PASS y
 * E2E_AUDITOR_PASS, o del archivo local supabase/usuarios-demo.local.txt (ignorado por git).
 */
export function credenciales(perfil: Perfil): { correo: string; clave: string } {
  const correo = `${perfil}@biobytes.demo`
  const deEntorno = process.env[`E2E_${perfil.toUpperCase()}_PASS`]
  if (deEntorno) return { correo, clave: deEntorno }
  try {
    const linea = readFileSync('supabase/usuarios-demo.local.txt', 'utf8')
      .split(/\r?\n/).find((l) => l.startsWith(correo))
    const clave = linea?.split(/\s+/)[1]
    if (clave) return { correo, clave }
  } catch { /* sin archivo */ }
  throw new Error(`Falta la contraseña de ${correo}: define E2E_${perfil.toUpperCase()}_PASS o crea supabase/usuarios-demo.local.txt`)
}

export async function entrar(page: Page, perfil: Perfil) {
  const { correo, clave } = credenciales(perfil)
  await page.goto('/login')
  await page.getByLabel('Correo').fill(correo)
  await page.getByLabel('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(perfil === 'auditor' ? /\/bitacora$/ : /\/padron$/)
}

export async function abrirExpediente(page: Page, folio: string) {
  await page.goto('/padron')
  await page.getByLabel(/Busca a la paciente/).fill(folio)
  await page.getByRole('link', { name: new RegExp(`Abrir expediente ${folio}`) }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/** Teléfono distinto en cada corrida, para que siempre haya un cambio que registrar. */
export function telefonoAleatorio() {
  return '34' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
}
