import type { ReactNode } from 'react'

export type NoticeTone = 'info' | 'success' | 'warning' | 'error'

const TONES: Record<NoticeTone, { box: string; icon: string; symbol: string; prefix: string }> = {
  info: { box: 'bg-sky-soft', icon: 'text-sky', symbol: 'i', prefix: 'Information : ' },
  success: { box: 'bg-sage-soft', icon: 'text-sage', symbol: '✓', prefix: 'Succès : ' },
  warning: { box: 'bg-warning-soft', icon: 'text-warning', symbol: '!', prefix: 'Attention : ' },
  error: { box: 'bg-danger-soft', icon: 'text-danger', symbol: '✕', prefix: 'Erreur : ' },
}

interface NoticeProps {
  tone?: NoticeTone
  title?: string
  children?: ReactNode
  /**
   * Annonce aux lecteurs d'écran : une erreur est une alerte, le reste
   * un statut poli. Faux pour un message présent dès l'affichage.
   */
  announce?: boolean
  /** Bouton ou lien d'action, à droite (ou dessous sur petit écran). */
  action?: ReactNode
  className?: string
}

/** Message d'information, de succès, d'avertissement ou d'erreur. */
export function Notice({ tone = 'info', title, children, announce = true, action, className }: NoticeProps) {
  const style = TONES[tone]
  const role = announce ? (tone === 'error' ? 'alert' : 'status') : undefined
  return (
    <div
      role={role}
      className={`flex flex-wrap items-start gap-3 rounded-control px-4 py-3 text-sm text-ink ${style.box} ${className ?? ''}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs font-bold ${style.icon}`}
      >
        {style.symbol}
      </span>
      <div className="min-w-0 flex-1">
        {title && (
          <p className="font-semibold">
            <span className="sr-only">{style.prefix}</span>
            {title}
          </p>
        )}
        {children && (
          <div className={title ? 'mt-0.5' : ''}>
            {!title && <span className="sr-only">{style.prefix}</span>}
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
