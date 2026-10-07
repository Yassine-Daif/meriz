import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import type { Assignment } from '../../lib/assignmentsApi'
import { displayName } from '../../lib/authApi'
import {
  disableLiveTracking,
  enableLiveTracking,
  formatLastActivity,
  formatLastObservation,
  getLiveSnapshot,
  listLiveWorkers,
  liveStateLabel,
} from '../../lib/liveApi'
import type { LiveWorker } from '../../lib/liveApi'
import { createPoller } from '../../lib/poller'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Notice } from '../ui/Notice'
import type { OpenLiveCoedition, OpenReadOnlyModel } from './types'

/** Cadence du suivi : assez vif pour voir une classe travailler. */
const REFRESH_MS = 3000

interface LiveTrackingPanelProps {
  client: ApiClient
  assignment: Assignment
  /** Le devoir a changé : le suivi vient d'être ouvert ou fermé. */
  onTrackingChanged: (assignment: Assignment) => void
  onOpenReadOnlyModel: OpenReadOnlyModel
  /** Corriger en direct le travail d'un élève, en co-édition. */
  onStartLiveCoedition: OpenLiveCoedition
  /** Faux après une fermeture à la main : on ne rouvre pas dans son dos. */
  autoOpen: boolean
  /** Le prof vient de fermer le suivi lui-même. */
  onTrackingClosed: () => void
}

/**
 * Suivi en direct d'un devoir, côté prof. La liste dit qui travaille et
 * depuis quand, jamais ce qui est écrit. Elle s'affiche d'emblée : venir
 * dans cette section ouvre le suivi, et les élèves le lisent dans leur
 * devoir.
 *
 * Sur chaque élève, deux modes au choix. Lire son travail en lecture
 * seule, sans rien pouvoir y toucher. Ou corriger en direct avec lui,
 * dans le même modèle, ce qu'il voit alors en toutes lettres.
 *
 * Le rafraîchissement ne tourne que tant que cette section est ouverte
 * et la page au premier plan : quitter l'onglet démonte le panneau.
 */
export function LiveTrackingPanel({
  client,
  assignment,
  onTrackingChanged,
  onOpenReadOnlyModel,
  onStartLiveCoedition,
  autoOpen,
  onTrackingClosed,
}: LiveTrackingPanelProps) {
  const [workers, setWorkers] = useState<LiveWorker[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Quel bouton de quelle ligne attend : chacun porte son propre état.
  const [opening, setOpening] = useState<{ studentId: number; mode: 'observe' | 'coedit' } | null>(null)
  const [autoOpening, setAutoOpening] = useState(false)
  const tracking = assignment.liveTracking

  // Le dernier relevé remplace le précédent : la liste ne repasse jamais
  // par « chargement », donc elle ne clignote pas toutes les 3 secondes.
  const refresh = useCallback(
    async (stillWanted: () => boolean) => {
      const result = await listLiveWorkers(client, assignment.id)
      if (!stillWanted()) {
        return
      }
      if (result.ok) {
        setWorkers(result.value)
        setLoadError(null)
      } else {
        setLoadError(result.error.message)
      }
    },
    [client, assignment.id],
  )

  useEffect(() => {
    if (!tracking) {
      setWorkers(null)
      return
    }
    const poller = createPoller({ run: refresh, delayMs: REFRESH_MS })
    poller.start()
    return () => poller.stop()
  }, [tracking, refresh])

  const openTracking = useCallback(async () => {
    setPending(true)
    setStatus(null)
    const result = await enableLiveTracking(client, assignment.id)
    setPending(false)
    if (!result.ok) {
      setStatus(result.error.message)
      return
    }
    setStatus('Suivi ouvert. Vos élèves en sont informés dans leur devoir.')
    onTrackingChanged(result.value)
  }, [client, assignment.id, onTrackingChanged])

  const closeTracking = async () => {
    setPending(true)
    setStatus(null)
    const result = await disableLiveTracking(client, assignment.id)
    setPending(false)
    if (!result.ok) {
      setStatus(result.error.message)
      return
    }
    setStatus('Suivi fermé. Vous ne voyez plus les travaux en cours.')
    onTrackingClosed()
    onTrackingChanged(result.value)
  }

  /*
   * Venir dans cette section ouvre le suivi : la classe au travail
   * s'affiche sans clic en plus. Une seule tentative par montage, c'est
   * le rôle du garde : React en mode strict ne poste pas deux fois, et un
   * échec n'est pas retenté en boucle. Rien n'est annulé au nettoyage,
   * sinon le suivi ouvert côté serveur ne s'appliquerait jamais ici.
   */
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (tracking || !autoOpen || autoOpenedRef.current) {
      return
    }
    autoOpenedRef.current = true
    setAutoOpening(true)
    void openTracking().finally(() => setAutoOpening(false))
  }, [tracking, autoOpen, openTracking])

  // Un seul instantané demandé à la fois : le bouton reste inerte le temps
  // que l'outil s'ouvre.
  const openingRef = useRef(false)

  /**
   * L'instantané du travail d'un élève, ou null si rien n'est lisible.
   * Les deux modes en ont besoin : la lecture seule affiche son contenu,
   * la correction à deux n'en garde que le document, porteur du canal.
   */
  const takeSnapshot = async (worker: LiveWorker, mode: 'observe' | 'coedit') => {
    if (openingRef.current) {
      return null
    }
    openingRef.current = true
    setOpening({ studentId: worker.student.id, mode })
    setStatus(null)
    const result = await getLiveSnapshot(client, assignment.id, worker.student.id)
    openingRef.current = false
    setOpening(null)
    if (result.ok) {
      return result.value
    }
    setStatus(
      result.error.kind === 'not_found'
        ? `${displayName(worker.student)} n’a pas encore commencé ce devoir.`
        : result.error.message,
    )
    return null
  }

  const observe = async (worker: LiveWorker) => {
    const snapshot = await takeSnapshot(worker, 'observe')
    if (snapshot === null) {
      return
    }
    const name = displayName(worker.student)
    onOpenReadOnlyModel({
      classroomId: assignment.classroomId,
      assignmentId: assignment.id,
      submissionId: null,
      key: `${assignment.id}:live:${worker.student.id}`,
      name: `${assignment.title} : ${name}`,
      label: `Travail de ${name}, en direct`,
      content: snapshot.content,
      live: { studentId: worker.student.id, documentId: snapshot.documentId },
    })
  }

  /*
   * Corriger en direct : le modèle n'est pas repris d'ici. Le document du
   * prof naît vide et se remplit par la synchronisation, sinon la fusion
   * doublerait tout le modèle.
   */
  const correct = async (worker: LiveWorker) => {
    const snapshot = await takeSnapshot(worker, 'coedit')
    if (snapshot === null) {
      return
    }
    const name = displayName(worker.student)
    onStartLiveCoedition({
      classroomId: assignment.classroomId,
      assignmentId: assignment.id,
      studentId: worker.student.id,
      documentId: snapshot.documentId,
      name: `${assignment.title} : ${name}`,
      label: `Travail de ${name}, correction à deux`,
    })
  }

  if (!tracking && autoOpening) {
    return (
      <section aria-labelledby="suivi-titre" className="mt-4">
        <h4 id="suivi-titre" className="text-base font-semibold text-ink">
          Suivi en direct
        </h4>
        <p role="status" className="mt-1 text-sm text-ink-soft">
          Ouverture du suivi…
        </p>
      </section>
    )
  }

  if (!tracking) {
    return (
      <section aria-labelledby="suivi-titre" className="mt-4">
        <Card>
          <h4 id="suivi-titre" className="text-base font-semibold text-ink">
            Suivi en direct
          </h4>
          <p className="mt-1 text-sm text-ink-soft">
            Le suivi vous montre qui travaille et vous laisse ouvrir le modèle d’un élève en lecture seule, pendant
            qu’il le construit. Vous ne pouvez rien y modifier, et vous ne voyez ni ses autres documents, ni son
            travail sur d’autres devoirs.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Vos élèves le voient écrit dans leur devoir, et chaque lecture leur est datée. Tant que le suivi est
            fermé, rien n’est consultable.
          </p>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-soft">
            {status}
          </p>
          <div className="mt-3">
            <Button
              variant="primary"
              onClick={() => void openTracking()}
              loading={pending}
              loadingLabel="Ouverture…"
            >
              Ouvrir le suivi en direct
            </Button>
          </div>
        </Card>
      </section>
    )
  }

  return (
    <section aria-labelledby="suivi-titre" className="mt-4">
      <h4 id="suivi-titre" className="text-base font-semibold text-ink">
        Suivi en direct
        {workers && workers.length > 0 && <span className="font-normal text-ink-soft"> ({workers.length})</span>}
      </h4>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-soft">
          Actualisé toutes les trois secondes, tant que cette page reste ouverte devant vous.
        </p>
        <Button size="sm" onClick={() => void closeTracking()} loading={pending} loadingLabel="Fermeture…">
          Fermer le suivi
        </Button>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-soft">
        {status}
      </p>

      {loadError ? (
        <Notice
          tone="warning"
          announce={false}
          action={
            <Button size="sm" onClick={() => void refresh(() => true)}>
              Réessayer
            </Button>
          }
        >
          {loadError}
        </Notice>
      ) : workers === null ? (
        <p role="status" className="text-sm text-ink-soft">
          Chargement du suivi…
        </p>
      ) : workers.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
          Aucun élève dans cette classe pour l’instant.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {workers.map((worker) => {
            const name = displayName(worker.student)
            const observation = formatLastObservation(worker.lastObservedAt)
            return (
              <li
                key={worker.student.id}
                className="flex w-full flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-soft"
              >
                <Avatar person={worker.student} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{name}</span>
                  <span className="block text-xs text-ink-soft">
                    {formatLastActivity(worker.lastActivityAt)}
                    {observation && ` · ${observation}`}
                  </span>
                </span>
                <Badge tone={worker.hasStarted ? 'sage' : 'neutral'}>{liveStateLabel(worker)}</Badge>
                <Button
                  size="sm"
                  disabled={!worker.hasStarted}
                  loading={opening?.studentId === worker.student.id && opening.mode === 'observe'}
                  loadingLabel="Ouverture…"
                  onClick={() => void observe(worker)}
                  aria-label={`Observer le travail de ${name} en lecture seule`}
                >
                  Observer en lecture seule
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!worker.hasStarted}
                  loading={opening?.studentId === worker.student.id && opening.mode === 'coedit'}
                  loadingLabel="Ouverture…"
                  onClick={() => void correct(worker)}
                  aria-label={`Corriger en direct le travail de ${name}`}
                >
                  Corriger en direct
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
