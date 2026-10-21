import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { registerUpdateGuard } from '../lib/updateSafety'
import { useEffect, useId, useRef, useState } from 'react'
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
  onDraftChange?: (dirty: boolean) => void
  revealedId?: string
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
  revealedId,
  onDraftChange,
  me,
  open,
  onToggleOpen,
  placing,
  onTogglePlacing,
  pendingPosition,
  onClearPosition,
  onReveal,
}: CommentsPanelProps) {
  useLanguage()
  const titleId = useId()
  const listId = useId()
  const fieldId = useId()
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [hideResolved, setHideResolved] = useState(false)
  const articles = useRef(new Map<string, HTMLElement>())
  useEffect(() => {
    if (open && revealedId) {
      setHideResolved(false)
      const article = articles.current.get(revealedId)
      article?.scrollIntoView({ block: 'nearest' })
      article?.focus({ preventScroll: true })
    }
  }, [revealedId, open])
  const [body, setBody] = useState('')
  const dirty = body.trim() !== ''
  useEffect(() => { onDraftChange?.(dirty) }, [dirty, onDraftChange])
  useEffect(() => registerUpdateGuard(async () => !dirty), [dirty])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [formError, setFormError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const { comments, error, total, unresolved } = thread
  const roots = (comments ?? []).filter((comment) => !comment.parentId)
  const ordered = roots.filter((comment) => !hideResolved || !comment.resolved).flatMap((root) =>
    [root, ...(comments ?? []).filter((comment) => comment.parentId === root.id)])
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
      setFormError(t("Écrivez un commentaire avant de l’envoyer."))
      setAttempt((count) => count + 1)
      return
    }
    setFormError('')
    await run(async () => {
      const failure = await thread.add({ body: trimmed, position: replyTo ? null : pendingPosition, parentId: replyTo?.id })
      if (failure === null) {
        setBody('')
        setReplyTo(null)
        onClearPosition()
      }
      return failure?.message ?? null
    }, pendingPosition === null ? t("Commentaire ajouté.") : t("Commentaire ajouté, avec sa bulle."))
  }

  const confirmDelete = () => {
    const comment = pendingDelete
    setPendingDelete(null)
    if (!comment) return
    void run(async () => (await thread.remove(comment.id))?.message ?? null, t("Commentaire supprimé.")).then(() => {
      // Le bouton déclencheur a disparu : le focus revient au titre.
      window.setTimeout(() => headingRef.current?.focus(), 0)
    })
  }

  return (
    <section aria-labelledby={titleId} className="border-t border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-ink">
          {t("Commentaires")}</h2>
        {total > 0 && <Badge tone="neutral">{total}</Badge>}
        {unresolved > 0 && <Badge tone="warning">{unresolved} {t(" à traiter")}</Badge>}
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={listId}
          className={`${actionClass} ml-auto`}
        >
          {open ? t("Masquer le fil") : t("Afficher le fil")}
        </button>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-xs text-ink-soft">
        {status || (comments === null ? '' : `${commentCountLabel(total)}${unresolved > 0 ? t(", dont {0} à traiter.", [unresolved]) : '.'}`)}
      </p>

      <div id={listId} hidden={!open}>
        <Button variant="ghost" size="sm" aria-pressed={hideResolved} onClick={() => setHideResolved((value) => !value)}>
          {hideResolved ? t("Afficher les discussions résolues") : t("Masquer les discussions résolues")}
        </Button>
        {error !== null && (
          <Notice
            tone="error"
            announce={false}
            action={
              <Button size="sm" onClick={thread.refresh}>
                {t("Réessayer")}</Button>
            }
          >
            {error}
          </Notice>
        )}

        {comments === null ? (
          <p className="mt-2 text-xs text-ink-soft">{t("Chargement des commentaires…")}</p>
        ) : comments.length === 0 ? (
          <p className="mt-2 rounded-control border border-dashed border-line-strong p-3 text-xs text-ink-soft">
            {t("Aucun commentaire pour l’instant. Écrivez le premier.")}</p>
        ) : (
          <ul className="mt-2 flex max-h-[22rem] flex-col gap-2 overflow-y-auto">
            {ordered.map((comment) => {
              const author = displayName(comment.author) || t("Participant")
              const mine = comment.author.id === me.id
              return (
                <li key={comment.id} className={comment.parentId ? 'ml-4 border-l-2 border-mark pl-2' : undefined}>
                  <article
                    data-comment-id={comment.id}
                    ref={(element) => { if (element) articles.current.set(comment.id, element); else articles.current.delete(comment.id) }}
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
                      {comment.position !== null && <Badge tone="sky">{t("Bulle ")}{roots.findIndex((root) => root.id === comment.id) + 1}</Badge>}
                      {comment.resolved && <Badge tone="sage">{t("Résolu")}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      <time dateTime={comment.createdAt ?? undefined}>{formatCommentDate(comment.createdAt)}</time>
                    </p>
                    <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-ink">{comment.body}</p>
                    {comment.resolved && (
                      <p className="mt-1 text-xs text-ink-soft">
                        {comment.resolver ? t("Résolu par {0}", [displayName(comment.resolver)]) : t("Résolu")}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setReplyTo(comment.parentId ? roots.find((root) => root.id === comment.parentId) ?? comment : comment)
                        onClearPosition()
                        bodyRef.current?.focus()
                      }}>{t("Répondre")}</Button>
                      <button
                        type="button"
                        className={actionClass}
                        disabled={busy}
                        hidden={!!comment.parentId}
                        aria-label={t("{0} le commentaire de {1}", [comment.resolved ? t("Rouvrir") : t("Marquer résolu"), author])}
                        onClick={() =>
                          void run(
                            async () =>
                              (comment.resolved
                                ? await thread.reopen(comment.id)
                                : await thread.resolve(comment.id))?.message ?? null,
                            comment.resolved ? t("Commentaire rouvert.") : t("Commentaire marqué résolu."),
                          )
                        }
                      >
                        {comment.resolved ? t("Rouvrir") : t("Marquer résolu")}
                      </button>
                      {comment.position !== null && (
                        <button
                          type="button"
                          className={actionClass}
                          aria-label={t("Montrer sur le schéma le commentaire de {0}", [author])}
                          onClick={() => onReveal(comment.id)}
                        >
                          {t("Montrer sur le schéma")}</button>
                      )}
                      {canDeleteComment(comment, me.id, canModerate) && (
                        <button
                          type="button"
                          className={actionClass}
                          disabled={busy}
                          aria-label={t("Supprimer le commentaire de {0}", [author])}
                          onClick={() => setPendingDelete(comment)}
                        >
                          {t("Supprimer")}</button>
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
            {replyTo ? t("Répondre à ")+displayName(replyTo.author) : t("Votre commentaire")}
          </label>
          {replyTo && <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>{t("Annuler la réponse")}</Button>}
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
              {t("Bulle posée sur le schéma.")}<button type="button" className={actionClass} onClick={onClearPosition}>
                {t("Retirer la bulle")}</button>
            </p>
          )}
          {placing && (
            <p className="text-xs text-ink-soft">{t("Cliquez sur le schéma pour poser la bulle. Échap pour annuler.")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" loading={busy} loadingLabel={t("Envoi…")}>
              {t("Commenter")}</Button>
            <button
              type="button"
              className={actionClass}
              aria-pressed={placing}
              onClick={() => { setReplyTo(null); onTogglePlacing() }}
              disabled={pendingPosition !== null}
            >
              {placing ? t("Annuler la bulle") : t("Poser une bulle")}
            </button>
          </div>
          <MoreInfo summary={t("À quoi sert une bulle ?")}>
            <p>
              {t("Une bulle marque un endroit précis du schéma. Elle reste à sa place quand vous zoomez ou déplacez la vue. Un commentaire sans bulle parle du travail en général.")}</p>
          </MoreInfo>
        </form>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("Supprimer le commentaire")}
        message={t("Ce commentaire et ses réponses seront supprimés pour tout le monde. Cette action est définitive.")}
        confirmLabel={t("Oui, supprimer")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
