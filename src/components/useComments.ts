import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import {
  createComment,
  deleteComment,
  listComments,
  reopenComment,
  resolveComment,
  sortedThread,
  unresolvedCount,
} from '../lib/commentsApi'
import type { Comment, CommentDraft } from '../lib/commentsApi'
import { createPoller } from '../lib/poller'
import type { CollabUser } from '../model/collabProvider'

/** Délai entre deux relectures du fil, panneau ouvert. */
export const COMMENTS_REFRESH_MS = 10_000

/**
 * De quoi tenir le fil d'un travail. Absent : aucun fil, aucune bulle.
 * C'est le cas d'un document local, d'une base ou d'un corrigé de devoir.
 */
export interface CommentsAccess {
  client: ApiClient
  /** Document de travail commenté : identifiant réel côté serveur. */
  documentId: string
  me: CollabUser
}

export interface CommentsThread {
  /** Null tant que la première lecture n'est pas arrivée. */
  comments: Comment[] | null
  error: string | null
  total: number
  unresolved: number
  refresh: () => void
  add: (draft: CommentDraft) => Promise<ApiError | null>
  resolve: (id: string) => Promise<ApiError | null>
  reopen: (id: string) => Promise<ApiError | null>
  remove: (id: string) => Promise<ApiError | null>
}

/**
 * Le fil d'un travail.
 *
 * Le serveur ne diffuse rien quand un commentaire arrive : on relit. Une
 * fois au montage, pour que les bulles existent même panneau fermé, puis
 * à cadence tenue tant que le panneau est ouvert, et après chaque
 * écriture pour voir aussi ce que l'autre a écrit entre-temps.
 */
export function useComments({
  access,
  watching,
}: {
  access: CommentsAccess | null
  /** Panneau ouvert et vue MCD affichée : la relecture ne tourne que là. */
  watching: boolean
}): CommentsThread {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const client = access?.client ?? null
  const documentId = access?.documentId ?? null

  /*
   * Une écriture déclenche une lecture hors du garde du rafraîchisseur :
   * deux lectures peuvent donc se croiser. Seule la dernière demandée a
   * le droit d'écrire l'état, sinon le fil clignote.
   */
  const seqRef = useRef(0)

  const read = useCallback(async () => {
    if (client === null || documentId === null) {
      return
    }
    seqRef.current += 1
    const seq = seqRef.current
    const result = await listComments(client, documentId)
    if (seq !== seqRef.current) {
      return
    }
    if (result.ok) {
      setComments(sortedThread(result.value))
      setError(null)
    } else {
      setError(result.error.message)
    }
  }, [client, documentId])

  const refresh = useCallback(() => {
    void read()
  }, [read])

  // Une lecture au montage, même panneau fermé : sans elle, aucune bulle
  // ne se dessinerait avant que l'on ouvre le fil.
  useEffect(() => {
    setComments(null)
    setError(null)
    void read()
  }, [read])

  useEffect(() => {
    if (!watching || client === null || documentId === null) {
      return
    }
    const poller = createPoller({ run: async () => read(), delayMs: COMMENTS_REFRESH_MS })
    poller.start()
    return () => poller.stop()
  }, [watching, client, documentId, read])

  /** Une écriture, puis une relecture : le fil reste la source d'affichage. */
  const write = useCallback(
    async (action: () => Promise<{ ok: true } | { ok: false; error: ApiError }>): Promise<ApiError | null> => {
      const result = await action()
      await read()
      return result.ok ? null : result.error
    },
    [read],
  )

  const add = useCallback(
    (draft: CommentDraft) =>
      write(() =>
        client === null || documentId === null
          ? Promise.resolve({ ok: true as const })
          : createComment(client, documentId, draft),
      ),
    [write, client, documentId],
  )

  const resolve = useCallback(
    (id: string) =>
      write(() => (client === null ? Promise.resolve({ ok: true as const }) : resolveComment(client, id))),
    [write, client],
  )

  const reopen = useCallback(
    (id: string) =>
      write(() => (client === null ? Promise.resolve({ ok: true as const }) : reopenComment(client, id))),
    [write, client],
  )

  const remove = useCallback(
    (id: string) =>
      write(() => (client === null ? Promise.resolve({ ok: true as const }) : deleteComment(client, id))),
    [write, client],
  )

  return {
    comments,
    error,
    total: comments?.length ?? 0,
    unresolved: comments === null ? 0 : unresolvedCount(comments),
    refresh,
    add,
    resolve,
    reopen,
    remove,
  }
}
