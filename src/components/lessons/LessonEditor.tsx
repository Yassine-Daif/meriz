import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import type { BlockType, LessonBlock } from '../../lib/lessonBlocks'
import {
  blockLabel,
  emptyBlock,
  mediaIdOf,
  moveBlock,
  parseBlocks,
  serializeBlocks,
} from '../../lib/lessonBlocks'
import { newId } from '../../lib/id'
import { createLessonSaver } from '../../lib/lessonSaver'
import type { LessonSaver } from '../../lib/lessonSaver'
import type { SaveStatus } from '../../lib/documentRepository'
import {
  deleteLesson,
  deleteLessonMedium,
  lessonStateLabel,
  publishLesson,
  unpublishLesson,
} from '../../lib/lessonsApi'
import type { Lesson, LessonMedium } from '../../lib/lessonsApi'
import { ConfirmDialog } from '../ConfirmDialog'
import { FormField } from '../FormField'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { LiveAnnouncement } from '../ui/LiveAnnouncement'
import { AddBlockBar } from './AddBlockBar'
import { BlockCard } from './BlockCard'

interface LessonEditorProps {
  client: ApiClient
  classroomName: string
  lesson: Lesson
  /** Retour à la liste, avec un message à annoncer. */
  onDone: (message: string | null) => void
  /** Cours changé côté serveur : la liste suit. */
  onChanged: (lesson: Lesson) => void
}

/** Un bloc et son identifiant d'édition, qui ne part jamais au serveur. */
interface EditorBlock {
  id: string
  block: LessonBlock
}

/** Retrait demandé : un bloc média détruit un fichier, on confirme. */
interface PendingRemoval {
  index: number
  mediumId: string | null
  label: string
}

/** État de l'enregistrement, dit au plus juste pour un cours. */
function SaveLine({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const retry = (
    <button
      type="button"
      onClick={onRetry}
      className="rounded-lg border border-line-strong bg-surface px-1.5 py-0.5 text-xs text-ink hover:bg-surface-soft"
    >
      Réessayer
    </button>
  )
  let content = (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-soft px-2 py-1 text-xs text-ink-soft">
      <span aria-hidden="true">✓</span>
      Enregistré
    </span>
  )
  if (status.kind === 'saving') {
    content = (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-soft px-2 py-1 text-xs text-ink-soft">
        Enregistrement…
      </span>
    )
  } else if (status.kind === 'offline') {
    content = (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-warning bg-warning-soft px-2 py-1 text-xs text-ink">
        <span aria-hidden="true">⚠</span>
        Serveur injoignable : nouvel essai en cours, ne fermez pas cette page.
        {retry}
      </span>
    )
  } else if (status.kind === 'error') {
    content = (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-danger/50 bg-danger-soft px-2 py-1 text-xs text-ink">
        <span aria-hidden="true">✕</span>
        {status.message}
        {retry}
      </span>
    )
  }
  return (
    <p role="status" aria-live="polite" className="min-w-0 text-xs">
      {content}
    </p>
  )
}

/**
 * Composition d'un cours : son titre et sa page de blocs, enregistrés
 * tout seuls, puis sa diffusion. Un média envoyé est donc lié au cours
 * sans attendre, jamais laissé orphelin.
 */
export function LessonEditor({ client, classroomName, lesson, onDone, onChanged }: LessonEditorProps) {
  const lessonId = lesson.id
  const [title, setTitle] = useState(lesson.title)
  const [blocks, setBlocks] = useState<EditorBlock[]>(() =>
    parseBlocks(lesson.blocks).map((block) => ({ id: newId(), block })),
  )
  const [media, setMedia] = useState<readonly LessonMedium[]>(lesson.media)
  const [state, setState] = useState(lesson)
  const [status, setStatus] = useState<SaveStatus>({ kind: 'saved' })
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [removal, setRemoval] = useState<PendingRemoval | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // La sauvegarde naît et meurt avec l'effet, jamais dans un état : React
  // monte les effets deux fois en développement, et une sauvegarde créée
  // une seule fois serait fermée dès le premier démontage simulé.
  const [saver, setSaver] = useState<LessonSaver | null>(null)
  const initial = useRef({ title: lesson.title, blocks: lesson.blocks })

  useEffect(() => {
    const created = createLessonSaver({
      client,
      lessonId,
      initialTitle: initial.current.title,
      initialBlocks: initial.current.blocks,
    })
    setSaver(created)
    setStatus(created.getStatus())
    const stopStatus = created.subscribe(setStatus)
    const stopSaved = created.onSaved((saved) => {
      setState(saved)
      onChangedRef.current(saved)
    })
    return () => {
      stopStatus()
      stopSaved()
      created.dispose()
    }
  }, [client, lessonId])

  // Le bouton de déplacement garde le focus après le déplacement : sans
  // cela, la navigation au clavier repart du début de la page.
  const focusAfterMove = useRef<{ blockId: string; direction: 'up' | 'down' } | null>(null)
  const moveButtons = useRef(new Map<string, HTMLButtonElement>())

  // Le rappel du parent peut changer à chaque rendu : on garde le dernier.
  const onChangedRef = useRef(onChanged)
  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  // Toute modification du titre ou de la page part au serveur, en différé.
  useEffect(() => {
    saver?.save(title, serializeBlocks(blocks.map((entry) => entry.block)))
  }, [title, blocks, saver])

  useEffect(() => {
    const target = focusAfterMove.current
    if (!target) return
    focusAfterMove.current = null
    const pressed = moveButtons.current.get(`${target.blockId}:${target.direction}`)
    // Le bloc peut être arrivé à une extrémité : le bouton actionné est
    // alors désactivé, on passe le focus à l'autre sens.
    if (pressed && !pressed.disabled) {
      pressed.focus()
      return
    }
    const opposite = target.direction === 'up' ? 'down' : 'up'
    moveButtons.current.get(`${target.blockId}:${opposite}`)?.focus()
  }, [blocks])

  const addBlock = (type: BlockType) => {
    setBlocks((current) => [...current, { id: newId(), block: emptyBlock(type) }])
    setAnnouncement(`Bloc ${blockLabel(type)} ajouté en position ${blocks.length + 1}.`)
  }

  const changeBlock = (index: number, block: LessonBlock) => {
    setBlocks((current) => current.map((entry, position) => (position === index ? { ...entry, block } : entry)))
  }

  const move = (index: number, direction: 'up' | 'down') => {
    const entry = blocks[index]
    const target = direction === 'up' ? index - 1 : index + 1
    if (!entry || target < 0 || target >= blocks.length) return
    focusAfterMove.current = { blockId: entry.id, direction }
    setBlocks(moveBlock(blocks, index, direction))
    setAnnouncement(`Bloc ${blockLabel(entry.block.type)} déplacé en position ${target + 1} sur ${blocks.length}.`)
  }

  const askRemoval = (index: number) => {
    const entry = blocks[index]
    if (!entry) return
    const mediumId = mediaIdOf(entry.block)
    const label = blockLabel(entry.block.type)
    if (mediumId === null) {
      // Rien à détruire : le bloc part sans confirmation.
      setBlocks((current) => current.filter((_, position) => position !== index))
      setAnnouncement(`Bloc ${label} retiré.`)
      return
    }
    setRemoval({ index, mediumId, label })
  }

  const confirmRemoval = async () => {
    const target = removal
    setRemoval(null)
    if (!target) return
    setActionError(null)
    if (target.mediumId !== null) {
      const removed = await deleteLessonMedium(client, lesson.id, target.mediumId)
      if (!removed.ok && removed.error.kind !== 'not_found') {
        setActionError(removed.error.message)
        return
      }
      const goneId = target.mediumId
      setMedia((current) => current.filter((item) => item.id !== goneId))
    }
    setBlocks((current) => current.filter((_, position) => position !== target.index))
    setAnnouncement(`Bloc ${target.label} et son fichier retirés.`)
  }

  /** Action sur le cours : publication, dépublication. */
  const run = async (action: () => Promise<{ ok: true; value: Lesson } | { ok: false; error: { message: string } }>) => {
    if (pending) return
    setPending(true)
    setActionError(null)
    const result = await action()
    setPending(false)
    if (result.ok) {
      setState(result.value)
      onChanged(result.value)
    } else {
      setActionError(result.error.message)
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    if (pending) return
    setPending(true)
    // Le travail en attente n'a plus d'objet : le cours va disparaître.
    saver?.dispose()
    const result = await deleteLesson(client, lesson.id)
    setPending(false)
    if (result.ok) onDone(`Cours « ${state.title} » supprimé.`)
    else setActionError(result.error.message)
  }

  const registerMoveButton = useCallback((key: string, element: HTMLButtonElement | null) => {
    if (element) moveButtons.current.set(key, element)
    else moveButtons.current.delete(key)
  }, [])

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => onDone(null)} className="-ml-3 mb-3">
        <span aria-hidden="true">←</span>
        Retour aux cours
      </Button>

      <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Cours</p>
      <h3 className="text-xl font-semibold tracking-tight text-ink">
        {title.trim() === '' ? 'Cours sans titre' : title}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">Classe {classroomName}.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={state.status === 'published' ? 'sage' : 'neutral'}>{lessonStateLabel(state)}</Badge>
        <SaveLine status={status} onRetry={() => saver?.retry()} />
      </div>

      <LiveAnnouncement message={announcement} />

      {actionError && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          <span aria-hidden="true">✕ </span>
          {actionError}
        </p>
      )}

      <div className="mt-5">
        <FormField
          label="Titre du cours"
          type="text"
          value={title}
          onChange={setTitle}
          autoComplete="off"
          maxLength={200}
          hint="Ce que vos élèves verront dans la liste."
        />
      </div>

      <section aria-labelledby="page-titre" className="mt-6">
        <h4 id="page-titre" className="text-base font-semibold text-ink">
          La page du cours
          {blocks.length > 0 && <span className="font-normal text-ink-soft"> ({blocks.length} blocs)</span>}
        </h4>
        <p className="mt-1 text-sm text-ink-soft">
          Ajoutez des blocs, remplissez-les, et rangez-les avec les flèches Monter et Descendre.
        </p>

        {blocks.length === 0 ? (
          <p className="mt-3 rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
            Page vide : commencez par un titre de section ou un texte.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {blocks.map((entry, index) => (
              <BlockCard
                key={entry.id}
                client={client}
                lessonId={lesson.id}
                block={entry.block}
                index={index}
                total={blocks.length}
                media={media}
                onChange={(block) => changeBlock(index, block)}
                onMove={(direction) => move(index, direction)}
                onRegisterMoveButton={(direction, button) =>
                  registerMoveButton(`${entry.id}:${direction}`, button)
                }
                onRemove={() => askRemoval(index)}
                onUploaded={(medium) => {
                  setMedia((current) => [...current, medium])
                  const block = entry.block
                  if (block.type === 'image') changeBlock(index, { ...block, mediaId: medium.id })
                  else if (block.type === 'audio') changeBlock(index, { ...block, mediaId: medium.id })
                }}
                onMediumGone={(mediumId) => setMedia((current) => current.filter((item) => item.id !== mediumId))}
              />
            ))}
          </ul>
        )}

        <div className="mt-4">
          <AddBlockBar onAdd={addBlock} />
        </div>
      </section>

      <section
        aria-labelledby="diffusion-cours-titre"
        className="mt-6 rounded-card border border-line bg-surface p-5 shadow-soft"
      >
        <h4 id="diffusion-cours-titre" className="text-base font-semibold text-ink">
          Diffusion
        </h4>
        <p className="mt-1 text-sm text-ink-soft">
          {state.status === 'published'
            ? 'Ce cours est visible par les élèves de la classe.'
            : 'Ce cours est un brouillon : personne d’autre ne le voit.'}
        </p>
        <div className="mt-3">
          {state.status === 'published' ? (
            <Button onClick={() => void run(() => unpublishLesson(client, lesson.id))} disabled={pending}>
              Dépublier
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void run(() => publishLesson(client, lesson.id))} disabled={pending}>
              Publier
            </Button>
          )}
        </div>
      </section>

      <div className="mt-6 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
          className="inline-flex min-h-10 items-center rounded-control border border-danger bg-surface px-4 py-2 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
        >
          Supprimer le cours
        </button>
      </div>

      <ConfirmDialog
        open={removal !== null}
        title={`Retirer le bloc ${removal?.label ?? ''}`}
        message="Le bloc et son fichier seront supprimés du cours. Cette action est définitive."
        confirmLabel="Retirer le bloc"
        onConfirm={() => void confirmRemoval()}
        onCancel={() => setRemoval(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer le cours"
        message={`Supprimer « ${state.title} » ? Sa page et tous ses fichiers seront supprimés. Cette action est définitive.`}
        confirmLabel="Supprimer le cours"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
