import type { Mcd } from '../model/mcd'
import type { ValidationProblem } from '../model/validate'
import { validationErrors, validationWarnings } from '../model/validate'
import { findAssociation, findEntity, findLeg } from '../model/queries'

interface ProblemsPanelProps {
  problems: ValidationProblem[]
  mcd: Mcd
  onSelectElement: (elementId: string) => void
}

function isSelectable(mcd: Mcd, elementId: string): boolean {
  return (
    findEntity(mcd, elementId) !== undefined ||
    findAssociation(mcd, elementId) !== undefined ||
    findLeg(mcd, elementId) !== undefined
  )
}

interface ProblemGroupProps {
  title: string
  icon: string
  problems: ValidationProblem[]
  mcd: Mcd
  onSelectElement: (elementId: string) => void
  toneClass: string
}

function ProblemGroup({ title, icon, problems, mcd, onSelectElement, toneClass }: ProblemGroupProps) {
  if (problems.length === 0) {
    return null
  }
  return (
    <div className="mt-2">
      <h3 className="text-xs font-semibold text-zinc-700">
        {title} ({problems.length})
      </h3>
      <ul className="mt-1 flex flex-col gap-1">
        {problems.map((problem, index) => {
          const elementId = problem.elementId
          const selectable = elementId !== undefined && isSelectable(mcd, elementId)
          const body = (
            <>
              <span aria-hidden="true">{icon} </span>
              {problem.message}
            </>
          )
          return (
            <li key={index}>
              {selectable ? (
                <button
                  type="button"
                  onClick={() => onSelectElement(elementId)}
                  className={`w-full rounded border px-2 py-1 text-left text-xs ${toneClass}`}
                >
                  {body}
                </button>
              ) : (
                <p className={`rounded border px-2 py-1 text-xs ${toneClass}`}>{body}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Rapport de vérification, mis à jour en direct : erreurs (bloquent la
 * génération) puis avertissements (informent). Seul le résumé est en
 * région live : annoncer chaque message à chaque frappe serait du
 * bavardage pour un lecteur d'écran.
 */
export function ProblemsPanel({ problems, mcd, onSelectElement }: ProblemsPanelProps) {
  const errors = validationErrors(problems)
  const warnings = validationWarnings(problems)

  const summary =
    errors.length === 0 && warnings.length === 0
      ? 'Aucun problème. Le modèle est prêt à être transformé.'
      : errors.length === 0
        ? `Aucune erreur, ${warnings.length} avertissement${warnings.length > 1 ? 's' : ''}. Le modèle est prêt à être transformé.`
        : `${errors.length} erreur${errors.length > 1 ? 's' : ''} et ${warnings.length} avertissement${warnings.length > 1 ? 's' : ''}. Les erreurs bloquent la génération.`

  return (
    <section aria-label="Rapport de vérification" className="p-3">
      <h2 className="text-sm font-semibold">Vérification</h2>
      <p role="status" aria-live="polite" className="mt-1 text-xs text-zinc-600">
        {summary}
      </p>
      <ProblemGroup
        title="Erreurs"
        icon="✕"
        problems={errors}
        mcd={mcd}
        onSelectElement={onSelectElement}
        toneClass="border-rose-300 bg-rose-50 hover:bg-rose-100"
      />
      <ProblemGroup
        title="Avertissements"
        icon="⚠"
        problems={warnings}
        mcd={mcd}
        onSelectElement={onSelectElement}
        toneClass="border-amber-300 bg-amber-50 hover:bg-amber-100"
      />
    </section>
  )
}
