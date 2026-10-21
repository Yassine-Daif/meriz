import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
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
  useLanguage()
  if (problems.length === 0) {
    return null
  }
  return (
    <div className="mt-2">
      <h3 className="text-xs font-semibold text-ink-soft">
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
                  className={`w-full rounded-lg border px-2 py-1 text-left text-xs ${toneClass}`}
                >
                  {body}
                </button>
              ) : (
                <p className={`rounded-lg border px-2 py-1 text-xs ${toneClass}`}>{body}</p>
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
  useLanguage()
  const errors = validationErrors(problems)
  const warnings = validationWarnings(problems)

  const summary =
    errors.length === 0 && warnings.length === 0
      ? t("Aucun problème. Le modèle est prêt à être transformé.")
      : errors.length === 0
        ? t("Aucune erreur, {0} avertissement{1}. Le modèle est prêt à être transformé.", [warnings.length, warnings.length > 1 ? 's' : ''])
        : t("{0} erreur{1} et {2} avertissement{3}. Les erreurs bloquent la génération.", [errors.length, errors.length > 1 ? 's' : '', warnings.length, warnings.length > 1 ? 's' : ''])

  return (
    <section aria-label={t("Rapport de vérification")} className="p-3">
      <h2 className="text-sm font-semibold">{t("Vérification")}</h2>
      <p role="status" aria-live="polite" className="mt-1 text-xs text-ink-soft">
        {summary}
      </p>
      <ProblemGroup
        title={t("Erreurs")}
        icon="✕"
        problems={errors}
        mcd={mcd}
        onSelectElement={onSelectElement}
        toneClass="border-danger/50 bg-danger-soft hover:border-danger"
      />
      <ProblemGroup
        title={t("Avertissements")}
        icon="⚠"
        problems={warnings}
        mcd={mcd}
        onSelectElement={onSelectElement}
        toneClass="border-warning/50 bg-warning-soft hover:border-warning"
      />
    </section>
  )
}
