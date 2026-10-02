/** Shared cancellation-aware wait; approval proof remains capability-specific. */
export function waitForObservation(intervalMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'))
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, intervalMs)
    signal?.addEventListener('abort', cancel, { once: true })
  })
}
export async function workflow_wait_for_authorization<T extends { state: string }>(
  observe: () => Promise<T>,
  signal: AbortSignal,
  intervalMs: number,
): Promise<T> {
  while (!signal.aborted) {
    const result = await observe()
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    if (result.state !== 'pending') return result
    await waitForObservation(intervalMs, signal)
  }
  throw new DOMException('Cancelled', 'AbortError')
}
