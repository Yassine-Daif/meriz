import { useId, useRef, useState } from 'react'
import {
  canDeleteComment,
  commentCountLabel,
  formatCommentDate,
} from '../lib/commentsApi'
import type { Comment, CommentPosition } from '../lib/commentsApi'
import { displayName } from '../lib/authApi'
import type { CollabUser } from '../model/collabProvider'
import { ConfirmDialog } from './ConfirmDialog'
import { FormAlert } from './FormAlert'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { buttonClass } from './ui/buttonClass'
import { MoreInfo } from './ui/MoreInfo'
import { Notice } from './ui/Notice'
import type { CommentsThread } from './useComments'

interface CommentsPanelProps {
  thread: CommentsThread
  me: CollabUser
  open: boolean
  onToggleOpen: () => void
  /** Mode « poser une bulle » : le clic suivant sur le schéma la place. */
  placing: boolean
  onTogglePlacing: () => void
  /** Position choisie par le clic, en attente d'un corps. */
  pendingPosition: CommentPosition | null
  onClearPosition: () => void
  /** Recentre la vue sur une bulle et lui donne le focus. */
  onReveal: (commentId: string) => void
}

const actionClass = buttonClass({ variant: 'ghost', size: 'sm' })

/**
 * Le fil de la correction, sous l'inspecteur et les problèmes.
 *
 * Il vit dès qu'un travail est ouvert, y compris quand l'édition est
 * coupée : commenter, c'est corriger, pas éditer. Le fil est borné en
 * hauteur et replié par défaut, pour ne pas pousser l'inspecteur hors de
 * l'écran quand la discussion s'allonge.
 */
export function CommentsPanel({
  thread,
  me,
  open,
  onToggleOpen,
  placing,
  onTogglePlacing,
  pendingPosition,
  onClearPosition,
  onReveal,
}: CommentsPanelProps) {
  const titleId = useId()
  const listId = useId()
  const fieldId = useId()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [formError, setFormError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const { comments, error, total, unresolved } = thread
  const canModerate = me.role === 'teacher'

  const run = async (action: () => Promise<string | null>, success: string) => {
    if (busy) return
    setBusy(true)
    const failure = await action()
    setBusy(false)
    if (failure === null) {
      setStatus(success)
    } else {
      setStatus('')
      setFormError(failure)
      setAttempt((count) => count + 1)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = body.trim()
    if (trimmed === '') {
      setFormError('Écrivez un commentaire avant de l’envoyer.')
      setAttempt((count) => count + 1)
      return
    }
    setFormError('')
    await run(async () => {
      const failure = await thread.add({ body: trimmed, position: pendingPosition })
      if (failure === null) {
        setBody('')
        onClearPosition()
      }
      return failure?.message ?? null
    }, pendingPosition === null ? 'Commentaire ajouté.' : 'Commentaire ajouté, avec sa bulle.')
  }

  const confirmDelete = () => {
    const comment = pendingDelete
    setPendingDelete(null)
    if (!comment) return
    void run(async () => (await thread.remove(comment.id))?.message ?? null, 'Commentaire supprimé.').then(() => {
      // Le bouton déclencheur a disparu : le focus revient au titre.
      window.setTimeout(() => headingRef.current?.focus(), 0)
    })
  }

  return (
    <section aria-labelledby={titleId} className="border-t border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-ink">
          Commentaires
        </h2>
        {total > 0 && <Badge tone="neutral">{total}</Badge>}
        {unresolved > 0 && <Badge tone="warning">{unresolved} à traiter</Badge>}
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={listId}
          className={`${actionClass} ml-auto`}
        >
          {open ? 'Masquer le fil' : 'Afficher le fil'}
        </button>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-xs text-ink-soft">
        {status || (comments === null ? '' : `${commentCountLabel(total)}${unresolved > 0 ? `, dont ${unresolved} à traiter.` : '.'}`)}
      </p>

      <div id={listId} hidden={!open}>
        {error !== null && (
          <Notice
            tone="error"
            announce={false}
            action={
              <Button size="sm" onClick={thread.refresh}>
                Réessayer
              </Button>
            }
          >
            {error}
          </Notice>
        )}

        {comments === null ? (
          <p className="mt-2 text-xs text-ink-soft">Chargement des commentaires…</p>
        ) : comments.length === 0 ? (
          <p className="mt-2 rounded-control border border-dashed border-line-strong p-3 text-xs text-ink-soft">
            Aucun commentaire pour l’instant. Écrivez le premier.
          </p>
        ) : (
          <ul className="mt-2 flex max-h-[22rem] flex-col gap-2 overflow-y-auto">
            {comments.map((comment, index) => {
              const author = displayName(comment.author) || 'Participant'
              const mine = comment.author.id === me.id
              return (
                <li key={comment.id}>
                  <article
                    tabIndex={-1}
                    className={`rounded-card border p-2 ${
                      comment.resolved ? 'border-line bg-shell/60 text-ink-soft' : 'border-line-strong bg-surface'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Avatar person={comment.author} size="sm" />
                      <span className="text-xs font-semibold text-ink">
                        {author}
                        {mine && ' (vous)'}
                      </span>
                      {comment.position !== null && <Badge tone="sky">Bulle {index + 1}</Badge>}
                      {comment.resolved && <Badge tone="sage">Résolu</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      <time dateTime={comment.createdAt ?? undefined}>{formatCommentDate(comment.createdAt)}</time>
                    </p>
                    <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-ink">{comment.body}</p>
                    {comment.resolved && (
                      <p className="mt-1 text-xs text-ink-soft">
                        {comment.resolver ? `Résolu par ${displayName(comment.resolver)}` : 'Résolu'}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={actionClass}
                        disabled={busy}
                        aria-label={`${comment.resolved ? 'Rouvrir' : 'Marquer résolu'} le commentaire de ${author}`}
                        onClick={() =>
                          void run(
                            async () =>
                              (comment.resolved
                                ? await thread.reopen(comment.id)
                                : await thread.resolve(comment.id))?.message ?? null,
                            comment.resolved ? 'Commentaire rouvert.' : 'Commentaire marqué résolu.',
                          )
                        }
                      >
                        {comment.resolved ? 'Rouvrir' : 'Marquer résolu'}
                      </button>
                      {comment.position !== null && (
                        <button
                          type="button"
                          className={actionClass}
                          aria-label={`Montrer sur le schéma le commentaire de ${author}`}
                          onClick={() => onReveal(comment.id)}
                        >
                          Montrer sur le schéma
                        </button>
                      )}
                      {canDeleteComment(comment, me.id, canModerate) && (
                        <button
                          type="button"
                          className={actionClass}
                          disabled={busy}
                          aria-label={`Supprimer le commentaire de ${author}`}
                          onClick={() => setPendingDelete(comment)}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}

        <form onSubmit={(event) => void submit(event)} className="mt-3 flex flex-col gap-2">
          <FormAlert message={formError} attempt={attempt} />
          <label htmlFor={fieldId} className="text-xs font-medium text-ink">
            Votre commentaire
          </label>
          <textarea
            id={fieldId}
            ref={bodyRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
          />
          {pendingPosition !== null && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              Bulle posée sur le schéma.
              <button type="button" className={actionClass} onClick={onClearPosition}>
                Retirer la bulle
              </button>
            </p>
          )}
          {placing && (
            <p className="text-xs text-ink-soft">Cliquez sur le schéma pour poser la bulle. Échap pour annuler.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" loading={busy} loadingLabel="Envoi…">
              Commenter
            </Button>
            <button
              type="button"
              className={actionClass}
              aria-pressed={placing}
              onClick={onTogglePlacing}
              disabled={pendingPosition !== null}
            >
              {placing ? 'Annuler la bulle' : 'Poser une bulle'}
            </button>
          </div>
          <MoreInfo summary="À quoi sert une bulle ?">
            <p>
              Une bulle marque un endroit précis du schéma. Elle reste à sa place quand vous zoomez ou déplacez la
              vue. Un commentaire sans bulle parle du travail en général.
            </p>
          </MoreInfo>
        </form>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer le commentaire"
        message="Ce commentaire sera supprimé pour tout le monde. Cette action est définitive."
        confirmLabel="Oui, supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
