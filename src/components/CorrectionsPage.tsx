import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { assignmentTypeLabel, getAssignment } from '../lib/assignmentsApi'
import { displayName } from '../lib/authApi'
import { listToGrade, pageCountLabel } from '../lib/overviewApi'
import type { ToGradeRow } from '../lib/overviewApi'
import { formatSubmittedAt } from '../lib/submissionsApi'
import { SubmissionReview } from './assignments/SubmissionReview'
import type { OpenReadOnlyModel } from './assignments/types'
import { PageShell } from './PageShell'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

/** Rendu à rouvrir d'emblée, au retour de l'outil MCD. */
export interface CorrectionOpening {
  submissionId: string
  classroomId: string
  assignmentId: string
}

interface CorrectionsPageProps {
  client: ApiClient
  opening: CorrectionOpening | null
  onOpenReadOnlyModel: OpenReadOnlyModel
}

/** De quoi ouvrir un rendu : ses identifiants, et un titre de repli. */
interface OpenTarget extends CorrectionOpening {
  /** Titre connu par la liste, ou null quand on revient de l'outil. */
  title: string | null
}

/** Ce que l'on regarde : la file, ou un rendu en cours de correction. */
type View =
  | { kind: 'list' }
  | {
      kind: 'review'
      submissionId: string
      classroomId: string
      assignmentId: string
      assignmentTitle: string
      /** Corrigé du devoir, pour la comparaison. Absent si le devoir n'a pas pu être lu. */
      solutionContent: string | null
      solutionMissing: boolean
    }

/**
 * Les rendus qui attendent une note, toutes classes confondues, les plus
 * anciens d'abord. Le serveur regroupe et trie : un seul appel, quel que
 * soit le nombre de classes. Noter un rendu le fait quitter la file.
 */
export function CorrectionsPage({ client, opening, onOpenReadOnlyModel }: CorrectionsPageProps) {
  const [rows, setRows] = useState<ToGradeRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'list' })

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await listToGrade(client, 1)
    if (!result.ok) {
      setLoadError(result.error.message)
      return
    }
    setRows(result.value.rows)
    setCurrentPage(result.value.currentPage)
    setLastPage(result.value.lastPage)
    setTotal(result.value.total)
  }, [client])

  useEffect(() => {
    void load()
  }, [load])

  /** La suite de la file, à la demande : la liste s'allonge, on ne perd pas sa place. */
  const loadMore = async () => {
    if (more) return
    setMore(true)
    const result = await listToGrade(client, currentPage + 1)
    setMore(false)
    if (!result.ok) {
      setStatus(result.error.message)
      return
    }
    setRows((previous) => [...(previous ?? []), ...result.value.rows])
    setCurrentPage(result.value.currentPage)
    setLastPage(result.value.lastPage)
    setTotal(result.value.total)
  }

  /**
   * Ouvrir un rendu demande le devoir, pour son corrigé : la comparaison
   * en a besoin, et la file ne le transporte pas. Sans corrigé lisible on
   * ouvre quand même, la correction à la main reste possible.
   */
  const open = useCallback(
    async (target: OpenTarget) => {
      setBusy(true)
      setStatus(null)
      const result = await getAssignment(client, target.assignmentId)
      setBusy(false)
      const title = result.ok ? result.value.title : target.title
      if (title === null) {
        // Retour de l'outil sans titre connu : mieux vaut la liste qu'un écran bancal.
        setStatus(result.ok ? null : result.error.message)
        return
      }
      setView({
        kind: 'review',
        submissionId: target.submissionId,
        classroomId: target.classroomId,
        assignmentId: target.assignmentId,
        assignmentTitle: title,
        solutionContent: result.ok ? result.value.solutionContent : null,
        solutionMissing: !result.ok,
      })
    },
    [client],
  )

  // Retour de l'outil MCD : le rendu consulté se rouvre tout seul.
  useEffect(() => {
    if (opening) void open({ ...opening, title: null })
  }, [opening, open])

  if (view.kind === 'review') {
    return (
      <div>
        {view.solutionMissing && (
          <Notice tone="info" className="mb-4">
            Le corrigé de ce devoir n’a pas pu être chargé : la comparaison automatique n’est pas proposée.
          </Notice>
        )}
        <SubmissionReview
          client={client}
          classroomId={view.classroomId}
          assignmentId={view.assignmentId}
          assignmentTitle={view.assignmentTitle}
          solutionContent={view.solutionContent}
          submissionId={view.submissionId}
          backLabel="Retour à la liste"
          onBack={(message) => {
            setView({ kind: 'list' })
            setStatus(message)
            void load()
          }}
          onOpenReadOnlyModel={onOpenReadOnlyModel}
        />
      </div>
    )
  }

  return (
    <PageShell
      title="À corriger"
      description="Les rendus de toutes vos classes qui attendent une note, les plus anciens d’abord."
    >
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink-soft">
        {status}
      </p>

      {loadError ? (
        <Notice
          tone="warning"
          announce={false}
          action={
            <Button size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          }
        >
          {loadError}
        </Notice>
      ) : rows === null ? (
        <p role="status" className="text-sm text-ink-soft">
          Chargement des rendus à corriger…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
          Rien à corriger pour l’instant. Les travaux remis par vos élèves arriveront ici.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.submissionId}>
                <button
                  type="button"
                  onClick={() =>
                    void open({
                      submissionId: row.submissionId,
                      classroomId: row.classroom.id,
                      assignmentId: row.assignment.id,
                      title: row.assignment.title,
                    })
                  }
                  disabled={busy}
                  aria-label={`Corriger le rendu de ${displayName(row.student)} pour ${row.assignment.title}`}
                  className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition duration-150 hover:shadow-lift disabled:cursor-wait motion-safe:hover:-translate-y-0.5"
                >
                  <Avatar person={row.student} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{displayName(row.student)}</span>
                    <span className="block text-sm text-ink">{row.assignment.title}</span>
                    <span className="block text-xs text-ink-soft">
                      {row.classroom.name} · {formatSubmittedAt(row.submittedAt)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center justify-end gap-1.5">
                    <Badge tone="sky">{assignmentTypeLabel(row.assignment.type)}</Badge>
                    {row.isLate && <Badge tone="apricot">En retard</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p role="status" className="text-sm text-ink-soft">
              {pageCountLabel(rows.length, total)}
            </p>
            {currentPage < lastPage && (
              <Button size="sm" onClick={() => void loadMore()} loading={more} loadingLabel="Chargement…">
                Voir les suivants
              </Button>
            )}
          </div>
        </>
      )}
    </PageShell>
  )
}
