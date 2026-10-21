import { t } from "../../i18n/runtime"
import { useLanguage } from "../../lib/useLanguage"
import { useCallback, useEffect, useId, useRef, useState } from 'react'
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
import { plural } from '../../lib/plural'
import { ConfirmDialog } from '../ConfirmDialog'
import { FormField } from '../FormField'
import { BackButton } from '../ui/BackButton'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { FormSection } from '../ui/FormSection'
import { LiveAnnouncement } from '../ui/LiveAnnouncement'
import { TabPanel, Tabs } from '../ui/Tabs'
import { AddBlockBar } from './AddBlockBar'
import { BlockCard } from './BlockCard'
import { LessonPage } from './LessonPage'

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
  useLanguage()
  const retry = (
    <button
      type="button"
      onClick={onRetry}
      className="rounded-lg border border-line-strong bg-surface px-1.5 py-0.5 text-xs text-ink hover:bg-surface-soft"
    >
      {t("Réessayer")}</button>
  )
  let content = (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-soft px-2 py-1 text-xs text-ink-soft">
      <span aria-hidden="true">✓</span>
      {t("Enregistré")}</span>
  )
  if (status.kind === 'saving') {
    content = (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-soft px-2 py-1 text-xs text-ink-soft">
        {t("Enregistrement…")}</span>
    )
  } else if (status.kind === 'offline') {
    content = (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-warning bg-warning-soft px-2 py-1 text-xs text-ink">
        <span aria-hidden="true">⚠</span>
        {t("Serveur injoignable : nouvel essai en cours, ne fermez pas cette page.")}{retry}
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
  useLanguage()
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
  const [tab, setTab] = useState<'ecrire' | 'apercu'>('ecrire')
  const tabsId = useId()
  const diffusionAction = useRef<HTMLDivElement>(null)

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
  // Même principe pour l'ajout et le retrait : la carte neuve prend le
  // focus dans son premier champ, et après un retrait il va sur la carte
  // qui prend la place, ou sur la barre d'ajout si la page se vide.
  const cards = useRef(new Map<string, HTMLLIElement>())
  const addBar = useRef<HTMLDivElement>(null)
  const [addedId, setAddedId] = useState<string | null>(null)
  const focusAfterRemoval = useRef<number | null>(null)

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

  useEffect(() => {
    const index = focusAfterRemoval.current
    if (index === null) return
    focusAfterRemoval.current = null
    // La carte qui prend la place, sinon la dernière, sinon la barre
    // d'ajout quand il ne reste plus rien à cibler.
    const entry = blocks[index] ?? blocks[blocks.length - 1]
    const card = entry ? cards.current.get(entry.id) : undefined
    if (card) card.focus()
    else addBar.current?.querySelector('button')?.focus()
  }, [blocks])

  const addBlock = (type: BlockType) => {
    const id = newId()
    setBlocks((current) => [...current, { id, block: emptyBlock(type) }])
    setAddedId(id)
    // Un bloc s'ajoute en écriture : si l'aperçu est ouvert, on y revient.
    setTab('ecrire')
    setAnnouncement(t("Bloc {0} ajouté en position {1}.", [blockLabel(type), blocks.length + 1]))
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
    setAnnouncement(t("Bloc {0} déplacé en position {1} sur {2}.", [blockLabel(entry.block.type), target + 1, blocks.length]))
  }

  const askRemoval = (index: number) => {
    const entry = blocks[index]
    if (!entry) return
    const mediumId = mediaIdOf(entry.block)
    const label = blockLabel(entry.block.type)
    if (mediumId === null) {
      // Rien à détruire : le bloc part sans confirmation.
      focusAfterRemoval.current = index
      setBlocks((current) => current.filter((_, position) => position !== index))
      setAnnouncement(t("Bloc {0} retiré.", [label]))
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
    focusAfterRemoval.current = target.index
    setBlocks((current) => current.filter((_, position) => position !== target.index))
    setAnnouncement(t("Bloc {0} et son fichier retirés.", [target.label]))
  }

  /** Action sur le cours : publication, dépublication. */
  const focusDiffusion = useRef(false)

  useEffect(() => {
    if (!focusDiffusion.current) return
    focusDiffusion.current = false
    diffusionAction.current?.querySelector('button')?.focus()
  }, [state.status])

  const run = async (action: () => Promise<{ ok: true; value: Lesson } | { ok: false; error: { message: string } }>) => {
    if (pending) return
    setPending(true)
    setActionError(null)
    const result = await action()
    setPending(false)
    if (result.ok) {
      focusDiffusion.current = true
      setState(result.value)
      onChanged(result.value)
      setAnnouncement(
        result.value.status === 'published'
          ? t("Cours publié : vos élèves le voient.")
          : t("Cours dépublié : vos élèves ne le voient plus."),
      )
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
    if (result.ok) onDone(t("Cours « {0} » supprimé.", [state.title]))
    else setActionError(result.error.message)
  }

  const registerMoveButton = useCallback((key: string, element: HTMLButtonElement | null) => {
    if (element) moveButtons.current.set(key, element)
    else moveButtons.current.delete(key)
  }, [])

  const pageBlocks = blocks.map((entry) => entry.block)

  const liste =
    blocks.length === 0 ? (
      <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
        {t("Page vide : commencez par un titre de section ou un texte.")}</p>
    ) : (
      <ul className="flex flex-col gap-3">
        {blocks.map((entry, index) => (
          <BlockCard
            key={entry.id}
            client={client}
            lessonId={lesson.id}
            block={entry.block}
            index={index}
            total={blocks.length}
            media={media}
            focusOnMount={entry.id === addedId}
            onChange={(block) => changeBlock(index, block)}
            onMove={(direction) => move(index, direction)}
            onRegisterMoveButton={(direction, button) =>
              registerMoveButton(`${entry.id}:${direction}`, button)
            }
            onRegisterCard={(card) => {
              if (card) cards.current.set(entry.id, card)
              else cards.current.delete(entry.id)
            }}
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
    )

  return (
    <div className="flex flex-col gap-5">
      <BackButton label={t("Retour aux cours")} onClick={() => onDone(null)} className="-ml-3" />

      <header>
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t("Cours")}</p>
        <h3 className="text-xl font-semibold tracking-tight text-ink">
          {title.trim() === '' ? t("Cours sans titre") : title}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">{t("Classe ")}{classroomName}.</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={state.status === 'published' ? 'sage' : 'neutral'}>{lessonStateLabel(state)}</Badge>
          <SaveLine status={status} onRetry={() => saver?.retry()} />
        </div>
      </header>

      <LiveAnnouncement message={announcement} />

      {actionError && (
        <p role="alert" className="text-sm font-medium text-danger">
          <span aria-hidden="true">✕ </span>
          {actionError}
        </p>
      )}

      <FormField
        label={t("Titre du cours")}
        type="text"
        value={title}
        onChange={setTitle}
        autoComplete="off"
        maxLength={200}
        hint={t("Ce que vos élèves verront dans la liste.")}
      />

      {/*
        * Écrire et Aperçu plutôt que deux colonnes : chaque mode prend
        * toute la largeur, donc les blocs respirent, et l'aperçu monte
        * la page de l'élève telle quelle, sans adaptation.
        */}
      <div>
        <Tabs
          label={t("Modes du cours")}
          idBase={tabsId}
          size="sm"
          items={[
            { value: 'ecrire', label: t("Écrire"), count: blocks.length },
            { value: 'apercu', label: t("Aperçu") },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'ecrire' && (
          <TabPanel idBase={tabsId} value="ecrire">
            <FormSection
              title={t("La page du cours")}
              level="h4"
              description={t("Ajoutez des blocs, remplissez-les, et rangez-les avec les flèches Monter et Descendre.")}
            >
              {liste}
              <div ref={addBar} className="mt-4">
                <AddBlockBar onAdd={addBlock} />
              </div>
            </FormSection>
          </TabPanel>
        )}

        {tab === 'apercu' && (
          <TabPanel idBase={tabsId} value="apercu">
            <FormSection
              title={t("Ce que verra la classe")}
              level="h4"
              tone="soft"
              description={t("Votre page telle qu'elle s'affichera, {0} {1}.", [blocks.length, plural(blocks.length, 'bloc', 'blocs')])}
            >
              <LessonPage client={client} lessonId={lesson.id} blocks={pageBlocks} />
            </FormSection>
          </TabPanel>
        )}
      </div>

      <FormSection
        title={t("Diffusion")}
        level="h4"
        description={
          state.status === 'published'
            ? t("Ce cours est visible par les élèves de la classe.")
            : t("Ce cours est un brouillon : personne d’autre ne le voit.")
        }
      >
        {/*
          * Publier remplace le bouton par Dépublier : sans cette
          * enveloppe, le focus tomberait sur le corps du document. On le
          * rend au bouton qui prend la place.
          */}
        <div ref={diffusionAction}>
          {state.status === 'published' ? (
            <Button
              loading={pending}
              loadingLabel={t("Un instant…")}
              onClick={() => void run(() => unpublishLesson(client, lesson.id))}
            >
              {t("Dépublier")}</Button>
          ) : (
            <Button
              variant="primary"
              loading={pending}
              loadingLabel={t("Un instant…")}
              onClick={() => void run(() => publishLesson(client, lesson.id))}
            >
              {t("Publier")}</Button>
          )}
        </div>
      </FormSection>

      <div className="border-t border-line pt-4">
        <Button variant="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
          {t("Supprimer le cours")}</Button>
      </div>

      <ConfirmDialog
        open={removal !== null}
        title={t("Retirer le bloc {0}", [removal?.label ?? ''])}
        message={t("Le bloc et son fichier seront supprimés du cours. Cette action est définitive.")}
        confirmLabel={t("Retirer le bloc")}
        onConfirm={() => void confirmRemoval()}
        onCancel={() => setRemoval(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t("Supprimer le cours")}
        message={t("Supprimer « {0} » ? Sa page et tous ses fichiers seront supprimés. Cette action est définitive.", [state.title])}
        confirmLabel={t("Supprimer le cours")}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
