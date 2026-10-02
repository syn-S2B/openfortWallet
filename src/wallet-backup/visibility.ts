type VisibilityPage = EventTarget & { readonly visibilityState: string }
// Approving in OnliYou may hide this page. Wait before spending the approval,
// so an encrypted response is never opened in the background.
export function waitForVisiblePage(signal: AbortSignal, page: VisibilityPage = document): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { page.removeEventListener('visibilitychange', visible); signal.removeEventListener('abort', cancel) }
    const visible = () => { if (page.visibilityState === 'visible') { cleanup(); resolve() } }
    const cancel = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')) }
    page.addEventListener('visibilitychange', visible); signal.addEventListener('abort', cancel, {once:true})
    if (signal.aborted) cancel(); else visible()
  })
}
