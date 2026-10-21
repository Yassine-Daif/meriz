import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { Icon } from './ui/Icon'
import { useId, useState } from 'react'
import type { Comment } from '../lib/commentsApi'
import type { ApiError } from '../lib/apiClient'
import { displayName } from '../lib/authApi'
import type { InkDuration } from './useAnnotationInk'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/Button'
export function AnnotationControls(props: {
  canDraw: boolean
  drawingActive: boolean
  duration: InkDuration; onDuration: (duration: InkDuration) => void
  visible: boolean; onToggleVisible: () => void; onClear: () => void
  saved: Comment[]; onDelete: (id: string) => Promise<ApiError | null>; onComment: () => void
}) {
  useLanguage()
  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null)
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const remove = async (comment: Comment) => {
    setBusy(true)
    const result = await props.onDelete(comment.id)
    setError(result?.message ?? null)
    setBusy(false)
  }
  return <div className="border-b border-line bg-surface-soft px-4 py-2 text-xs text-ink">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button size="sm" variant="soft" onClick={props.onComment} aria-keyshortcuts="C" title={t("Poser un commentaire (C)")}><Icon name="comment" /><span>{t("Commenter le schéma")}</span></Button>
      {props.canDraw && props.drawingActive && <>
        <label htmlFor={id}>{t("Durée du crayon")}</label>
        <select id={id} value={props.duration} onChange={(event) => props.onDuration(event.target.value as InkDuration)} className="rounded-control border border-line-strong bg-surface px-2 py-1 text-ink">
          <option value="short">{t("Court · 3 secondes")}</option><option value="long">{t("Cours · 15 secondes")}</option><option value="saved">{t("Conserver dans le document")}</option>
        </select>
        <Button size="sm" variant="ghost" onClick={props.onClear} title={t("Effacer mes traits temporaires")} aria-label={t("Effacer mes traits temporaires")}><Icon name="eraser" /><span className="hidden sm:inline">{t("Effacer mes traits")}</span></Button>
      </>}
      <Button size="sm" variant="ghost" aria-pressed={!props.visible} onClick={props.onToggleVisible}>
        <Icon name={props.visible ? 'eyeOff' : 'eye'} /><span>{props.visible ? t("Masquer les annotations") : t("Afficher les annotations")}</span>
      </Button>
      {!props.visible && <span>{t("Masquées sur cet écran seulement.")}</span>}
    </div>
    {props.saved.length > 0 && <details className="mt-2"><summary className="cursor-pointer">{t("Traits conservés (")}{props.saved.length})</summary>
      <ul className="mt-1 max-h-32 overflow-auto">{props.saved.map((comment) => <li key={comment.id} className="flex items-center justify-between gap-2">
        <span>{displayName(comment.author)} {t(" · annotation conservée")}</span>
        {comment.canDelete && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPendingDelete(comment)}>{t("Effacer pour tous")}</Button>}
      </li>)}</ul>
    </details>}
    <ConfirmDialog open={pendingDelete !== null} title={t("Effacer ce trait pour tous ?")}
      message={t("Le trait conservé sera supprimé du document pour tous les participants. Le masquage permet simplement de le cacher sur votre écran.")}
      confirmLabel={t("Effacer pour tous")} onCancel={() => setPendingDelete(null)}
      onConfirm={() => { const comment = pendingDelete; setPendingDelete(null); if (comment) void remove(comment) }} />
    {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
  </div>
}
