import { useRef, useState } from 'react'
import type { Dispatch } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { McdAction } from '../model/mcdReducer'
import type { ValidationProblem } from '../model/validate'
import { validationErrors, validationWarnings } from '../model/validate'
import type { Position } from '../model/layout'

interface McdToolbarProps {
  dispatch: Dispatch<McdAction>
  problems: ValidationProblem[]
  /** Génère MLD, MPD et SQL depuis le MCD courant (App). */
  onGenerate: () => void
}

interface StatusMessage {
  kind: 'info' | 'error'
  text: string
}

const buttonClass =
  'flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell'

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/** Sous-barre de la vue MCD : ajout d'éléments, vérification, génération. */
export function McdToolbar({ dispatch, problems, onGenerate }: McdToolbarProps) {
  const { screenToFlowPosition } = useReactFlow()
  const [status, setStatus] = useState<StatusMessage | null>(null)
  // Décalage en cascade pour que des ajouts répétés ne s'empilent pas.
  const addCountRef = useRef(0)

  const nextPosition = (): Position => {
    const offset = (addCountRef.current % 5) * 28
    addCountRef.current += 1
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    return { x: center.x + offset, y: center.y + offset }
  }

  const errors = validationErrors(problems)
  const warnings = validationWarnings(problems)
  const errorsLabel = `${errors.length} erreur${errors.length > 1 ? 's' : ''}`
  const warningsLabel = `${warnings.length} avertissement${warnings.length > 1 ? 's' : ''}`

  // L'engrenage d'AnalyseSI : le MCD est-il prêt à être transformé ?
  const handleVerify = () => {
    if (errors.length > 0) {
      setStatus({
        kind: 'error',
        text: `${errorsLabel} et ${warningsLabel} : corrigez les erreurs avant de générer (voir le rapport).`,
      })
    } else if (warnings.length > 0) {
      setStatus({
        kind: 'info',
        text: `Prêt à être transformé, avec ${warningsLabel} (voir le rapport).`,
      })
    } else {
      setStatus({ kind: 'info', text: 'Aucun problème. Le modèle est prêt à être transformé.' })
    }
  }

  // La coche verte d'AnalyseSI : génération MLD, MPD et SQL.
  // Seules les erreurs bloquent, les avertissements informent.
  const handleGenerate = () => {
    if (errors.length > 0) {
      setStatus({
        kind: 'error',
        text: `Impossible de générer : ${errorsLabel} à corriger d'abord (voir le rapport).`,
      })
      return
    }
    onGenerate()
    setStatus({ kind: 'info', text: 'MLD, MPD et SQL générés depuis le MCD.' })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2">
      <div role="group" aria-label="Édition du MCD" className="flex gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => dispatch({ type: 'ADD_ENTITY', position: nextPosition() })}
        >
          Ajouter une entité
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => dispatch({ type: 'ADD_ASSOCIATION', position: nextPosition() })}
        >
          Ajouter une association
        </button>
      </div>

      <div aria-hidden="true" className="h-6 w-px bg-line" />

      <div role="group" aria-label="Vérification et génération" className="flex gap-2">
        <button type="button" className={buttonClass} onClick={handleVerify}>
          <svg {...iconProps}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
          </svg>
          Vérifier
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          className="flex items-center gap-1.5 rounded-md border border-indigo-700 bg-indigo-700 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-800"
        >
          <svg {...iconProps}>
            <path d="m4.5 12.5 5 5 10-11" />
          </svg>
          Générer
        </button>
      </div>

      <p role="status" aria-live="polite" className="min-w-0 text-xs text-zinc-700">
        {status && (
          <span
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${
              status.kind === 'error' ? 'border-amber-400 bg-amber-50' : 'border-zinc-300 bg-zinc-50'
            }`}
          >
            <span aria-hidden="true">{status.kind === 'error' ? '⚠' : '✓'}</span>
            {status.text}
          </span>
        )}
      </p>
    </div>
  )
}
