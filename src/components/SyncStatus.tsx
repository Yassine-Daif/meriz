import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import type { SaveStatus } from '../lib/documentRepository'

interface SyncStatusProps {
  status: SaveStatus
  onRetry: () => void
  /** Cloud : l'état d'envoi est affiché. Local : rien, sauf erreur. */
  cloud: boolean
}

const badgeClass = 'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs'

/**
 * État de la sauvegarde du document ouvert : enregistré, envoi en
 * cours, hors ligne (travail gardé sur l'appareil), ou échec. Annoncé
 * aux lecteurs d'écran, avec un bouton pour réessayer.
 */
export function SyncStatus({ status, onRetry, cloud }: SyncStatusProps) {
  useLanguage()
  const retryButton = (
    <button
      type="button"
      onClick={onRetry}
      className="rounded-lg border border-line-strong bg-surface px-1.5 py-0.5 text-xs text-ink hover:bg-surface-soft"
    >
      {t("Réessayer")}</button>
  )

  let content = null
  if (status.kind === 'error') {
    content = (
      <span className={`${badgeClass} border-danger/50 bg-danger-soft text-ink`}>
        <span aria-hidden="true">✕</span>
        {status.message}
        {retryButton}
      </span>
    )
  } else if (status.kind === 'offline') {
    content = (
      <span className={`${badgeClass} border-warning bg-warning-soft text-ink`}>
        <span aria-hidden="true">⚠</span>
        {t("Hors ligne : modifications gardées sur cet appareil, nouvel essai en cours.")}{retryButton}
      </span>
    )
  } else if (cloud && status.kind === 'saving') {
    content = <span className={`${badgeClass} border-line-strong bg-surface-soft text-ink-soft`}>{t("Enregistrement…")}</span>
  } else if (cloud) {
    content = (
      <span title={t("Enregistré dans votre compte")} aria-label={t("Enregistré dans votre compte")} className={`${badgeClass} border-line-strong bg-surface-soft text-ink-soft`}>
        <span aria-hidden="true">✓</span>
        <span className="hidden sm:inline">{t("Enregistré dans votre compte")}</span></span>
    )
  }

  return (
    <p role="status" aria-live="polite" className="min-w-0 text-xs">
      {content}
    </p>
  )
}
