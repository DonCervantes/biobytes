// BB-10 · Cifrado local con WebCrypto (AES-GCM 256).
// La llave es un CryptoKey NO exportable: se guarda en IndexedDB (sobrevive a una recarga o a un
// reinicio, así no se pierden capturas pendientes) pero ningún script puede leer sus bytes.
// Al cerrar sesión se borra la llave y, con ella, cualquier dato cifrado que quedara es ilegible.

export interface Cifrado {
  iv: Uint8Array
  ct: ArrayBuffer
}

const ALG = { name: 'AES-GCM', length: 256 } as const

export function generarLlave(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(ALG, false, ['encrypt', 'decrypt']) // false = no exportable
}

export async function cifrar(llave: CryptoKey, obj: unknown): Promise<Cifrado> {
  const iv = crypto.getRandomValues(new Uint8Array(12)) // IV nuevo en cada cifrado
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, new TextEncoder().encode(JSON.stringify(obj)))
  return { iv, ct }
}

export async function descifrar<T>(llave: CryptoKey, x: Cifrado): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: x.iv as Uint8Array<ArrayBuffer> }, llave, x.ct)
  return JSON.parse(new TextDecoder().decode(pt)) as T
}
