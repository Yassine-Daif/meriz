import { useId, useState } from 'react'
import type { Comment } from '../lib/commentsApi'
import type { ApiError } from '../lib/apiClient'
import { displayName } from '../lib/authApi'
import type { InkDuration } from './useAnnotationInk'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/Button'
export function AnnotationControls(props: {
  canDraw: boolean
  duration: InkDuration; onDuration: (duration: InkDuration) => void
  visible: boolean; onToggleVisible: () => void; onClear: () => void
  saved: Comment[]; onDelete: (id: string) => Promise<ApiError | null>; onComment: () => void
}) {
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
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="soft" onClick={props.onComment} aria-keyshortcuts="C" title="Poser un commentaire (C)">Commenter le schéma</Button>
      {props.canDraw && <>
        <label htmlFor={id}>Durée du crayon</label>
        <select id={id} value={props.duration} onChange={(event) => props.onDuration(event.target.value as InkDuration)} className="rounded-control border border-line-strong bg-surface px-2 py-1 text-ink">
          <option value="short">Court · 3 secondes</option><option value="long">Cours · 15 secondes</option><option value="saved">Conserver dans le document</option>
        </select>
        <Button size="sm" variant="ghost" onClick={props.onClear}>Effacer mes traits temporaires</Button>
      </>}
      <Button size="sm" variant="ghost" aria-pressed={!props.visible} onClick={props.onToggleVisible}>
        {props.visible ? 'Masquer les annotations' : 'Afficher les annotations'}
      </Button>
      {!props.visible && <span>Masquées sur cet écran seulement.</span>}
    </div>
    {props.saved.length > 0 && <details className="mt-2"><summary className="cursor-pointer">Traits conservés ({props.saved.length})</summary>
      <ul className="mt-1 max-h-32 overflow-auto">{props.saved.map((comment) => <li key={comment.id} className="flex items-center justify-between gap-2">
        <span>{displayName(comment.author)} · annotation conservée</span>
        {comment.canDelete && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPendingDelete(comment)}>Effacer pour tous</Button>}
      </li>)}</ul>
    </details>}
    <ConfirmDialog open={pendingDelete !== null} title="Effacer ce trait pour tous ?"
      message="Le trait conservé sera supprimé du document pour tous les participants. Le masquage permet simplement de le cacher sur votre écran."
      confirmLabel="Effacer pour tous" onCancel={() => setPendingDelete(null)}
      onConfirm={() => { const comment = pendingDelete; setPendingDelete(null); if (comment) void remove(comment) }} />
    {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
  </div>
}
