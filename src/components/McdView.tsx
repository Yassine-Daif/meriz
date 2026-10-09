import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, KeyboardEvent, PointerEvent, ReactNode, SetStateAction } from 'react'
import type { McdAction, McdEditorState } from '../model/mcdReducer'
import type { RemotePresence } from '../model/collabProvider'
import type { ValidationProblem } from '../model/validate'
import { McdCanvas } from '../canvas/McdCanvas'
import type { CanvasSelection } from '../canvas/selection'
import { McdToolbar } from './McdToolbar'
import { Inspector } from './Inspector'
import { CommentsPanel } from './CommentsPanel'
import { ProblemsPanel } from './ProblemsPanel'
import { useComments } from './useComments'
import type { CommentsAccess } from './useComments'
import { pinLabel } from '../lib/commentsApi'
import type { CommentPosition } from '../lib/commentsApi'
import { displayName } from '../lib/authApi'
import { isEditableTarget } from '../lib/keyboard'
import { LiveAnnouncement } from './ui/LiveAnnouncement'
import type { InkPoint } from '../model/inkTrace'

const PANEL_MIN = 240
const PANEL_MAX = 640
const PANEL_STEP = 16

function clampWidth(width: number): number {
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, width))
}

interface McdViewProps {
  state: McdEditorState
  dispatch: Dispatch<McdAction>
  selection: CanvasSelection
  onSelectionChange: Dispatch<SetStateAction<CanvasSelection>>
  problems: ValidationProblem[]
  onSelectElement: (elementId: string) => void
  onGenerate: () => void
  /**
   * La vue reste montée quand elle est inactive (le zoom et la
   * position du canvas survivent), simplement masquée.
   */
  isActive: boolean
  /** Curseurs des autres participants, en co-édition. */
  others?: RemotePresence[]
  /** Ma position de pointeur, pour que les autres me voient. */
  onPointerFlow?: (position: { x: number; y: number } | null) => void
  /** La liaison que je tire, pour que les autres la voient. */
  onDraftLink?: (from: { x: number; y: number } | null) => void
  /** Faux entre pairs d'un groupe : aucune étiquette prof sur les curseurs. */
  teacherTag?: boolean
  /** Bande de co-édition, posée sous la barre d'outils. */
  banner?: ReactNode
  /** Consultation seule : le modèle se parcourt, il ne se modifie pas. */
  readOnly?: boolean
  /**
   * Commentaires du travail. Absent : aucun fil, aucune bulle. Il ne
   * dépend surtout pas de readOnly : commenter, c'est corriger.
   */
  comments?: CommentsAccess
  /** Crayon rouge : offert au prof en correction à deux, sinon absent. */
  onInkStroke?: (points: InkPoint[] | null) => void
}

/**
 * Vue MCD : sous-barre d'outils, canvas, et un panneau latéral
 * redimensionnable qui empile l'inspecteur et la validation.
 */
export function McdView({
  state,
  dispatch,
  selection,
  onSelectionChange,
  problems,
  onSelectElement,
  onGenerate,
  isActive,
  others,
  onPointerFlow,
  onDraftLink,
  teacherTag,
  banner,
  readOnly = false,
  comments,
  onInkStroke,
}: McdViewProps) {
  const [panelWidth, setPanelWidth] = useState(300)
  const [threadOpen, setThreadOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [pendingPosition, setPendingPosition] = useState<CommentPosition | null>(null)
  const [revealed, setRevealed] = useState<{ id: string; nonce: number } | null>(null)
  const [pencil, setPencil] = useState(false)
  const [annotating, setAnnotating] = useState<string | null>(null)

  // La relecture ne tourne que fil ouvert et vue affichée : sinon elle
  // continuerait depuis la vue SQL, pour personne.
  const thread = useComments({ access: comments ?? null, watching: threadOpen && isActive })
  const pins = useMemo(
    () =>
      (thread.comments ?? []).flatMap((comment, index) =>
        comment.position === null
          ? []
          : [
              {
                id: comment.id,
                index,
                position: comment.position,
                label: pinLabel(comment, index),
                resolved: comment.resolved,
              },
            ],
      ),
    [thread.comments],
  )

  /* Échap sort du mode bulle, sans voler l'Échap d'un champ de saisie. */
  useEffect(() => {
    if (!placing) {
      return
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !isEditableTarget(event.target)) {
        setPlacing(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [placing])

  /* Quitter la vue éteint le crayon et efface le trait en cours. */
  useEffect(() => {
    if (!isActive && pencil) {
      setPencil(false)
      onInkStroke?.(null)
    }
  }, [isActive, pencil, onInkStroke])

  /*
   * Un trait apparaît chez un autre : on le dit une fois, pas à chaque
   * geste. Une région live bavarde noierait l'information.
   */
  const inker = others?.find((other) => other.ink !== null) ?? null
  useEffect(() => {
    setAnnotating((current) => {
      if (inker === null) {
        return null
      }
      const name = displayName(inker.user) || 'Votre prof'
      return current === null ? `${name} annote le schéma.` : current
    })
  }, [inker])

  const onSeparatorPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    const separator = event.currentTarget
    separator.setPointerCapture(event.pointerId)
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      setPanelWidth(clampWidth(startWidth + (startX - moveEvent.clientX)))
    }
    const onUp = () => {
      separator.removeEventListener('pointermove', onMove)
    }
    separator.addEventListener('pointermove', onMove)
    separator.addEventListener('pointerup', onUp, { once: true })
  }

  const onSeparatorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Poignée à gauche du panneau : flèche gauche = panneau plus large.
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setPanelWidth((width) => clampWidth(width + PANEL_STEP))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setPanelWidth((width) => clampWidth(width - PANEL_STEP))
    }
  }

  return (
    <section
      aria-label="Vue MCD"
      className={isActive ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
    >
      <McdToolbar
        dispatch={dispatch}
        problems={problems}
        onGenerate={onGenerate}
        readOnly={readOnly}
        pencil={
          onInkStroke
            ? {
                active: pencil,
                onToggle: () => {
                  setPencil((active) => {
                    if (active) onInkStroke(null)
                    else setPlacing(false)
                    return !active
                  })
                },
              }
            : undefined
        }
      />
      <LiveAnnouncement message={annotating} />
      {banner}
      <div className="flex min-h-0 flex-1">
        <McdCanvas
          state={state}
          dispatch={dispatch}
          selection={selection}
          onSelectionChange={onSelectionChange}
          isActive={isActive}
          others={others}
          onPointerFlow={onPointerFlow}
          onDraftLink={onDraftLink}
          teacherTag={teacherTag}
          readOnly={readOnly}
          pins={pins}
          onOpenPin={(commentId) => {
            setThreadOpen(true)
            setRevealed({ id: commentId, nonce: Date.now() })
          }}
          revealedPin={revealed}
          placing={placing}
          onPlacePin={(position) => {
            setPendingPosition(position)
            setPlacing(false)
            setThreadOpen(true)
          }}
          ink={onInkStroke ? { active: pencil, onStroke: onInkStroke } : undefined}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner le panneau latéral"
          aria-valuemin={PANEL_MIN}
          aria-valuemax={PANEL_MAX}
          aria-valuenow={panelWidth}
          tabIndex={0}
          onPointerDown={onSeparatorPointerDown}
          onKeyDown={onSeparatorKeyDown}
          className="w-1.5 shrink-0 cursor-col-resize bg-line hover:bg-mark"
        />
        <div
          style={{ width: panelWidth, maxWidth: '60vw' }}
          className="flex shrink-0 flex-col overflow-y-auto bg-surface"
        >
          <Inspector mcd={state.mcd} selection={selection} dispatch={dispatch} readOnly={readOnly} />
          <ProblemsPanel problems={problems} mcd={state.mcd} onSelectElement={onSelectElement} />
          {comments && (
            <CommentsPanel
              thread={thread}
              me={comments.me}
              open={threadOpen}
              onToggleOpen={() => setThreadOpen((value) => !value)}
              placing={placing}
              onTogglePlacing={() => {
                setPlacing((value) => {
                  if (!value) {
                    setPencil(false)
                    setThreadOpen(true)
                  }
                  return !value
                })
              }}
              pendingPosition={pendingPosition}
              onClearPosition={() => setPendingPosition(null)}
              onReveal={(commentId) => setRevealed({ id: commentId, nonce: Date.now() })}
            />
          )}
        </div>
      </div>
    </section>
  )
}
