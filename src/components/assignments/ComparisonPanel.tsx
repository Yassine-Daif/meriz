import type { Comparison } from '../../model/compare'
import { comparisonDetailText, comparisonSummaryText, formatGrade } from '../../model/compare'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Notice } from '../ui/Notice'

interface ComparisonPanelProps {
  comparison: Comparison
  /** Remplit le champ Note sans rien enregistrer. */
  onUseGrade: (grade: string) => void
  /** Ajoute un texte au commentaire destiné à l'élève. */
  onAddToFeedback: (text: string) => void
}

/** Points à vérifier, regroupés par élément du modèle. */
function groupByScope(comparison: Comparison): { scope: string; messages: string[] }[] {
  const groups: { scope: string; messages: string[] }[] = []
  for (const difference of comparison.differences) {
    const last = groups[groups.length - 1]
    if (last && last.scope === difference.scope) {
      last.messages.push(difference.message)
    } else {
      groups.push({ scope: difference.scope, messages: [difference.message] })
    }
  }
  return groups
}

/**
 * Comparaison du rendu au corrigé, comme aide à la correction.
 *
 * Ce panneau ne juge rien : il relève des points à vérifier, et le prof
 * tranche. La note proposée n'est jamais posée d'office, et rien ne part
 * vers l'élève sans un geste du prof.
 */
export function ComparisonPanel({ comparison, onUseGrade, onAddToFeedback }: ComparisonPanelProps) {
  const { expectedPoints, matchedPoints, checks, extras, suggestedGrade } = comparison.summary
  const groups = groupByScope(comparison)
  const matched = [...comparison.matchedEntities, ...comparison.matchedAssociations]

  return (
    <Card as="section" aria-labelledby="comparaison-titre" className="mt-4">
      <h4 id="comparaison-titre" className="text-base font-semibold text-ink">
        Comparaison au corrigé
      </h4>

      <div className="mt-2">
        <Notice tone="info" title="Une aide, pas un verdict">
          Une différence peut être un choix valable : en Merise, un même énoncé admet souvent plusieurs modèles
          corrects. C’est vous qui décidez.
        </Notice>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-ink-soft">Éléments attendus retrouvés</dt>
          <dd className="font-semibold text-ink">
            {matchedPoints} sur {expectedPoints}
          </dd>
        </div>
        <div>
          <dt className="text-ink-soft">Points à vérifier</dt>
          <dd className="font-semibold text-ink">{checks}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Éléments en plus du corrigé</dt>
          <dd className="font-semibold text-ink">{extras}</dd>
        </div>
      </dl>

      {suggestedGrade !== null && (
        <div className="mt-4 rounded-card bg-accent-soft p-4">
          <p className="text-sm text-ink">
            Note indicative : <strong>{formatGrade(suggestedGrade)} sur 20</strong>. C’est une proposition, calculée sur
            les seuls éléments du corrigé retrouvés. Reprenez-la, modifiez-la, ou ignorez-la.
          </p>
          <div className="mt-3">
            <Button size="sm" onClick={() => onUseGrade(`${formatGrade(suggestedGrade)}/20`)}>
              Reprendre cette note
            </Button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-line-strong bg-surface-soft p-4 text-sm text-ink-soft">
          Aucune différence relevée avec le corrigé. À vous de juger le reste, la mise en forme et la lisibilité du
          modèle notamment.
        </p>
      ) : (
        <section aria-labelledby="a-verifier-titre" className="mt-4">
          <h5 id="a-verifier-titre" className="text-sm font-semibold text-ink">
            À vérifier
          </h5>
          <ul className="mt-2 flex flex-col gap-3">
            {groups.map((group) => (
              <li key={group.scope}>
                <p className="flex items-center gap-2">
                  <Badge tone="apricot">{group.scope}</Badge>
                </p>
                <ul className="mt-1 ml-4 list-disc text-sm leading-6 text-ink">
                  {group.messages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {matched.length > 0 && (
        <details className="group mt-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-control text-sm font-medium text-accent-ink [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
            >
              ▸
            </span>
            Ce qui correspond ({matched.length})
          </summary>
          <ul className="mt-2 ml-4 list-disc text-sm leading-6 text-ink-soft">
            {matched.map((pair) => (
              <li key={`${pair.expected}:${pair.submitted}`}>
                {pair.expected}
                {pair.expected !== pair.submitted && <span> (écrit « {pair.submitted} » au rendu)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm text-ink-soft">
          Votre élève ne voit rien de tout ceci. Vous pouvez en ajouter une trace à votre commentaire, puis la relire et
          la modifier avant d’enregistrer.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onAddToFeedback(comparisonSummaryText(comparison))}>
            Ajouter le résumé au commentaire
          </Button>
          <Button size="sm" onClick={() => onAddToFeedback(comparisonDetailText(comparison))}>
            Ajouter le détail au commentaire
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Le résumé ne donne que des compteurs. Le détail nomme les différences, donc une partie de votre corrigé.
        </p>
      </div>
    </Card>
  )
}
