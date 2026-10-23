import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../../i18n/runtime'
import { useLanguage } from '../../lib/useLanguage'
import { Icon } from './Icon'

import { ToastContext } from './toastContext'
import type { ToastMessage } from './toastContext'
type Toast = { id: number; kind: 'info' | 'error'; text: string }

/** Une seule notification à la fois, indépendante de la taille des barres d'outils. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const sequence = useRef(0)
  const origin = useRef<HTMLElement | null>(null)
  const show = useCallback((message: ToastMessage) => {
    if (!message) { setToast(null); return }
    if (document.activeElement instanceof HTMLElement && !document.activeElement.closest('[data-toast]')) origin.current = document.activeElement
    setToast({ ...(typeof message === 'string' ? { kind: 'info' as const, text: message } : message), id: ++sequence.current })
  }, [])
  const dismiss = useCallback(() => {
    if (document.activeElement?.closest('[data-toast]') && origin.current?.isConnected) origin.current.focus({ preventScroll: true })
    setToast(null)
  }, [])
  return <ToastContext value={show}>{children}{createPortal(<><p role="status" aria-atomic="true" className="sr-only">{toast && <span key={toast.id}>{toast.text}</span>}</p>{toast && <ToastNotice key={toast.id} toast={toast} onDismiss={dismiss} />}</>, document.body)}</ToastContext>
}

function ToastNotice({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useLanguage()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(document.hidden)
  useEffect(() => {
    const update = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (hovered || focused || hidden) return
    const timer = window.setTimeout(onDismiss, toast.kind === 'error' ? 10000 : 6000)
    return () => window.clearTimeout(timer)
  }, [toast.kind, hovered, focused, hidden, onDismiss])
  return <div data-toast data-kind={toast.kind}
    className={'fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md items-start gap-3 overflow-auto rounded-card border bg-surface p-4 text-sm text-ink shadow-soft [overflow-wrap:anywhere] ' + (toast.kind === 'error' ? 'border-warning' : 'border-line-strong')}
    onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onDismiss() } }}>
    <span aria-hidden="true" className="shrink-0">{toast.kind === 'error' ? '⚠' : <Icon name="check" />}</span>
    <p className="min-w-0 flex-1">{toast.text}</p>
    <button type="button" onClick={onDismiss} aria-label={t('Fermer')} title={t('Fermer')}
      className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-control border border-line-strong hover:bg-shell"><Icon name="close" /></button>
  </div>
}
