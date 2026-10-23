import { useToast } from './ui/toastContext'
import { counted } from "../lib/plural"
import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { Icon } from './ui/Icon'
import { useRef } from 'react'
import type { Dispatch } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { McdAction } from '../model/mcdReducer'
import type { ValidationProblem } from '../model/validate'
import { validationErrors, validationWarnings } from '../model/validate'
import type { Position } from '../model/layout'
import { Button } from './ui/Button'

interface McdToolbarProps {
  dispatch: Dispatch<McdAction>
  problems: ValidationProblem[]
  /** Ouvre les résultats (MLD, MPD, SQL), toujours dérivés du MCD courant. */
  onGenerate: () => void
  /** Consultation seule : plus d'ajout, mais vérifier et générer restent. */
  readOnly?: boolean
  /**
   * Crayon rouge du prof, en correction à deux. Absent : aucun bouton.
   * Le trait ne s'enregistre jamais, il n'explique que sur le moment.
   */
  panel?: { open: boolean; onToggle: () => void; controls: string; buttonId: string }
  pencil?: { active: boolean; onToggle: () => void; onSelect: () => void }
}

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
export function McdToolbar({ dispatch, problems, onGenerate, readOnly = false, pencil, panel }: McdToolbarProps) {
  useLanguage()
  const { screenToFlowPosition, fitView } = useReactFlow()
  const setStatus = useToast()
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
  const errorsLabel = counted(errors.length, 'erreur', 'erreurs')
  const warningsLabel = counted(warnings.length, 'avertissement', 'avertissements')

  // L'engrenage d'AnalyseSI : le MCD est-il prêt à être transformé ?
  const handleVerify = () => {
    if (errors.length > 0) {
      setStatus({
        kind: 'error',
        text: t("{0} et {1} : corrigez les erreurs avant de générer (voir le rapport).", [errorsLabel, warningsLabel]),
      })
    } else if (warnings.length > 0) {
      setStatus({
        kind: 'info',
        text: t("Prêt à être transformé, avec {0} (voir le rapport).", [warningsLabel]),
      })
    } else {
      setStatus({ kind: 'info', text: t("Aucun problème. Le modèle est prêt à être transformé.") })
    }
  }

  // La coche verte d'AnalyseSI : vérification puis accès aux résultats.
  // Seules les erreurs bloquent, les avertissements informent.
  const handleGenerate = () => {
    if (errors.length > 0) {
      setStatus({
        kind: 'error',
        text: t("Impossible de générer : {0} à corriger d'abord (voir le rapport).", [errorsLabel]),
      })
      return
    }
    onGenerate()
    setStatus({ kind: 'info', text: t("MCD vérifié : MLD, MPD et SQL à jour.") })
  }

  return (
    <div className="mcd-toolbar flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-3 py-2">
      {!readOnly && (
        <>
          <div role="group" aria-label={t("Édition du MCD")} className="flex min-w-0 flex-wrap gap-1.5">
            <Button size="sm" aria-label={t("Ajouter une entité")} title={t("Ajouter une entité")} onClick={() => dispatch({ type: 'ADD_ENTITY', position: nextPosition() })}>
              <Icon name="entity" /><span className="hidden sm:inline">{t("Entité")}</span>
            </Button>
            <Button size="sm" aria-label={t("Ajouter une association")} title={t("Ajouter une association")} onClick={() => dispatch({ type: 'ADD_ASSOCIATION', position: nextPosition() })}>
              <Icon name="association" /><span className="hidden sm:inline">{t("Association")}</span>
            </Button>
          </div>

          <div aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />
        </>
      )}

      {pencil && (
        <>
          <div role="group" aria-label={t("Outils du schéma")} className="flex gap-1.5">
            <Button size="sm" title={t("Sélectionner (Échap pour quitter le crayon)")} aria-pressed={!pencil.active} variant={!pencil.active ? 'soft' : 'ghost'} onClick={pencil.onSelect}><Icon name="pointer" /><span className="hidden sm:inline">{t("Sélection")}</span><span className="sr-only sm:hidden">{t("Sélection")}</span></Button>
            <Button
              size="sm"
              aria-label={t("Crayon rouge")} title={t("Crayon rouge")}
              aria-pressed={pencil.active}
              onClick={() => {
                pencil.onToggle()
                setStatus({
                  kind: 'info',
                  text: pencil.active
                    ? t("Crayon rouge désactivé.")
                    : t("Crayon rouge activé. Choisissez sa durée, puis dessinez sur le schéma."),
                })
              }}
              /*
               * L'outil actif se voit au fond rouge pâle, en plus de
               * aria-pressed et du pictogramme : jamais la couleur seule.
               */
              className={pencil.active ? 'border-danger-strong bg-danger-soft text-danger' : undefined}
            >
              <Icon name="pencil" />
              <span className="hidden sm:inline">{t("Crayon rouge")}</span></Button>
          </div>

          <div aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />
        </>
      )}

      <div role="group" aria-label={t("Vérification et génération")} className="flex gap-2">
        <Button size="sm" onClick={handleVerify} aria-label={t("Vérifier")} title={t("Vérifier")}>
          <svg {...iconProps}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
          </svg>
          <span className="hidden sm:inline">{t("Vérifier")}</span></Button>
        <Button size="sm" variant="primary" onClick={handleGenerate}>
          <svg {...iconProps}>
            <path d="m4.5 12.5 5 5 10-11" />
          </svg>
          {t("Générer")}</Button>
      </div>

      <div role="group" aria-label={t("Vues")} className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" aria-label={t("Ajuster à la fenêtre")} title={t("Ajuster à la fenêtre")} onClick={() => void fitView({ padding: .2, duration: 0 })}><Icon name="fit" /></Button>
        {panel && <Button id={panel.buttonId} size="sm" variant="ghost" className="md:hidden" aria-label={t("Inspecteur")} title={t("Inspecteur")} aria-expanded={panel.open} aria-controls={panel.controls} onClick={panel.onToggle}><Icon name="panel" /></Button>}
      </div>
    </div>
  )
}
