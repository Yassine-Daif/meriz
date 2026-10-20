import { useEffect } from 'react'
import type { AccountSpace } from '../lib/accountController'
import { getLiveSnapshot } from '../lib/liveApi'
import { createLiveTransport } from '../lib/liveTransport'
import type { EditorTarget } from './editorTarget'

interface LiveObservationOptions {
  account: AccountSpace
  /** La cible ouverte, ou null : seul un rendu suivi est observé. */
  target: EditorTarget | null
  /** Ce qu'on fait d'un contenu reçu : remplacer l'état affiché. */
  onContent: (content: string) => void
}

/**
 * Suivre en direct le travail d'un élève, pour son prof.
 *
 * Le hook ne s'allume que sur un rendu dont le suivi est ouvert. Tout le
 * reste, un document personnel, une base de devoir, un corrigé libéré,
 * le laisse éteint.
 */
export function useLiveObservation({ account, target, onContent }: LiveObservationOptions) {
  const liveTarget = target?.kind === 'review' ? target.live : null
  const liveAssignmentId = target?.kind === 'review' ? target.assignmentId : null

  /**
   * Un travail observé arrive en direct par websocket, et le
   * rafraîchissement régulier reste en filet : si le direct ne s'établit
   * pas ou retombe, l'image continue d'avancer. Tout se ferme avec la
   * vue, et s'interrompt quand l'onglet passe en arrière-plan.
   */
  useEffect(() => {
    if (account.kind !== 'cloud' || liveTarget === null || liveAssignmentId === null) {
      return
    }
    const client = account.client
    const transport = createLiveTransport({
      assignmentId: liveAssignmentId,
      studentId: liveTarget.studentId,
      fetchSnapshot: async (stillWanted) => {
        const result = await getLiveSnapshot(client, liveAssignmentId, liveTarget.studentId)
        if (stillWanted() && result.ok) {
          onContent(result.value.content)
          await client.request('POST', '/assignments/'+encodeURIComponent(liveAssignmentId)+'/live/'+encodeURIComponent(String(liveTarget.studentId))+'/seen')
        }
      },
      onContent: onContent,
    })
    transport.start()
    return () => transport.stop()
  }, [account, liveTarget, liveAssignmentId, onContent])
}
