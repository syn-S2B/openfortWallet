import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
const aad = (kind, method, path, symbol) => Buffer.from(`species-gateway-v1\0${kind}\0${method}\0${path}\0${symbol}`)

export function seal(body, key, method, path, symbol, kind = 'request') {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(aad(kind, method, path, symbol))
  return { nonce: nonce.toString('base64'), body: Buffer.concat([cipher.update(body), cipher.final(), cipher.getAuthTag()]) }
}
export function open(body, nonce, key, method, path, symbol, kind = 'response') {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'base64'))
  decipher.setAAD(aad(kind, method, path, symbol)); decipher.setAuthTag(body.subarray(-16))
  return Buffer.concat([decipher.update(body.subarray(0, -16)), decipher.final()])
}
