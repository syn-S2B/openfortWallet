import { detectPhantom, readPhantom, phantomError, observePhantom } from '../adapter/adapter_phantom.ts'
export { detectPhantom, readPhantom, phantomError }
export function externalAccountCapability(target: { phantom?: { ethereum?: unknown } }) {
  const provider = detectPhantom(target)
  if (!provider) return null
  return {
    read: (consent = false) => readPhantom(provider, consent),
    observe: (changed: () => void, disconnected: () => void) => observePhantom(provider, changed, disconnected),
    message: phantomError,
  }
}
