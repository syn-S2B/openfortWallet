import { useEffect, useRef, type ReactNode } from 'react'

export default function Dialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close() }, [])
  return <dialog ref={ref} className={`species-dialog ${className}`} aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-body">
      <button className="dialog-close" onClick={onClose} aria-label={`Close ${title}`}>×</button>
      {children}
    </div>
  </dialog>
}
