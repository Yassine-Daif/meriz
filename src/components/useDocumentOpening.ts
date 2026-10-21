import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AccountSpace } from '../lib/accountController'
import type { ApiError } from '../lib/apiClient'
import { createAssignmentSaver } from '../lib/assignmentSaver'
import { getAssignment } from '../lib/assignmentsApi'
import { createPoller } from '../lib/poller'
import type { AssignmentField } from '../lib/assignmentsApi'
import { createInertSaver } from '../lib/documentRepository'
import type { DocumentRepository } from '../lib/documentRepository'
import { importModelFile } from '../lib/importFile'
import { parseModelFile } from '../lib/persistence'
import { builtInExample } from '../i18n/builtInExample'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import type { MpdSettings } from '../model/mpd'
import type { McdEditorState } from '../model/mcdReducer'
import type { OpenedDocument } from '../model/document'
import { emptyEditorState } from '../model/document'
import type { LiveCoedition, ReadOnlyModel } from './assignments/types'
import type { EditorOrigin, EditorTarget, OpenedSession } from './editorTarget'

/** Délai laissé à un envoi en cours quand on quitte l'éditeur. */
const LEAVE_FLUSH_MS = 3000

interface DocumentOpeningOptions {
  /** Dépôt de l'espace courant : le compte connecté, ou cet appareil. */
  repository: DocumentRepository
  /** Clé de l'espace : un document ouvert ailleurs n'y survit pas. */
  spaceKey: string
  cloud: boolean
  account: AccountSpace
  /** D'où l'outil est ouvert, donc où le fermer ramènera. */
  editorOrigin: EditorOrigin
  /** Une ouverture efface le message d'accueil, qui ne vaut qu'une fois. */
  clearAnnouncement: () => void
  /** Changement de compte : la page revient à l'accueil. */
  onSpaceChange: () => void
}

/**
 * Tout ce qui ouvre, tient et referme le modèle travaillé.
 *
 * Onze chemins y mènent, du document personnel à la correction à deux,
 * et tous passent par le même geste : préparer le document et sa
 * sauvegarde, puis remplacer la session ouverte en libérant la
 * précédente. Ce qui change d'un chemin à l'autre, c'est d'où vient le
 * contenu et ce que la cible dit du retour.
 *
 * Le hook ne navigue jamais : il ferme, et c'est l'appelant qui décide
 * où aller, d'après returnTarget.
 */
export function useDocumentOpening({
  repository,
  spaceKey,
  cloud,
  account,
  editorOrigin,
  clearAnnouncement,
  onSpaceChange,
}: DocumentOpeningOptions) {
  useLanguage()
  // Document ouvert, avec sa sauvegarde automatique, rattaché à l'espace
  // qui l'a ouvert.
  const [opened, setOpened] = useState<OpenedSession | null>(null)

  // Changement de compte : le document ouvert appartient à l'espace
  // précédent, il est refermé d'office.
  const current = opened && opened.spaceKey === spaceKey ? opened : null
  const trackedAssignmentId = current?.target.kind === 'work' || current?.target.kind === 'coedit'
    || (current?.target.kind === 'review' && current.target.live !== null) ? current.target.assignmentId : null
  useEffect(() => {
    if (account.kind !== 'cloud' || trackedAssignmentId === null) return
    let stopped = false
    const poller = createPoller({ delayMs: 10_000, run: async () => {
      const result = await getAssignment(account.client, trackedAssignmentId)
      if (stopped) return
      if (!result.ok && result.error.status !== 403 && result.error.status !== 404) return
      const live = result.ok && result.value.liveTracking
      setOpened((previous) => {
        if (previous?.spaceKey !== spaceKey) return previous
        const target = previous.target
        if (target.kind === 'work' && target.assignmentId === trackedAssignmentId) {
          return target.live === live ? previous : { ...previous, target: { ...target, live } }
        }
        if (!live && target.kind === 'coedit' && target.assignmentId === trackedAssignmentId) {
          return { ...previous, target: { kind: 'review', classroomId: target.classroomId,
            assignmentId: target.assignmentId, submissionId: null, label: t("Suivi arrêté"), labelMessage: { source: "Suivi arrêté", values: [] }, origin: target.origin,
            discussionDocumentId: target.documentId, live: null } }
        }
        if (!live && target.kind === 'review' && target.assignmentId === trackedAssignmentId && target.live) {
          return { ...previous, target: { ...target, discussionDocumentId: target.live.documentId, live: null } }
        }
        return previous
      })
    } })
    poller.start()
    return () => { stopped = true; poller.stop() }
  }, [account, trackedAssignmentId, spaceKey])
  useEffect(() => {
    // Nouveau compte : on repart de l'accueil, jamais d'un écran de l'ancien.
    onSpaceChange()
    setOpened((previous) => {
      if (previous && previous.spaceKey !== spaceKey) {
        previous.saver.dispose()
        return null
      }
      return previous
    })
  }, [spaceKey, onSpaceChange])

  /** Ouvre un document de l'espace, pour lui-même ou comme travail sur un devoir. */
  const openStoredDocument = useCallback(
    async (id: string, target: EditorTarget): Promise<ApiError | null> => {
      // Un document de groupe est partagé : il ne passe pas par le cache
      // personnel, sinon il s'afficherait dans « Mes documents » et
      // pourrait être recréé en document personnel.
      const result = await repository.open(id, target.kind === 'group')
      if (!result.ok) {
        return result.error
      }
      const saver = repository.createSaver(result.value)
      clearAnnouncement()
      setOpened((previous) => {
        previous?.saver.dispose()
        return { spaceKey, document: result.value.document, saver, cloud, target }
      })
      return null
    },
    [repository, spaceKey, cloud, clearAnnouncement],
  )

  const openDocument = useCallback(
    (id: string) => openStoredDocument(id, { kind: 'document' }),
    [openStoredDocument],
  )

  /** Un document partagé d'un groupe : co-édité entre pairs. */
  const openGroupDocument = useCallback(
    (groupId: string, groupName: string, documentId: string) => {
      void openStoredDocument(documentId, { kind: 'group', groupId, groupName, documentId })
    },
    [openStoredDocument],
  )

  /** Le document de travail d'un élève sur un devoir : retour au devoir en fermant. */
  const openWorkDocument = useCallback(
    (classroomId: string, assignmentId: string, documentId: string, live = false) =>
      openStoredDocument(documentId, {
        kind: 'work',
        classroomId,
        assignmentId,
        origin: editorOrigin,
        live,
      }),
    [openStoredDocument, editorOrigin],
  )

  const createAndOpen = useCallback(
    async (name: string, state?: McdEditorState, mpdSettings?: MpdSettings): Promise<ApiError | null> => {
      const created = await repository.create(name, state, mpdSettings)
      return created.ok ? openDocument(created.value.id) : created.error
    },
    [repository, openDocument],
  )

  const newDocument = useCallback(
    () => createAndOpen(repository.nextNewDocumentName()),
    [repository, createAndOpen],
  )

  const openExample = useCallback(
    () => { const example = builtInExample(); return createAndOpen(example.name, example.state) },
    [createAndOpen],
  )

  const importFile = useCallback(
    async (file: File): Promise<string | null> => {
      const result = await importModelFile(file)
      if (!result.ok) {
        return result.error
      }
      const error = await createAndOpen(result.name, result.state, result.mpdSettings)
      return error ? error.message : null
    },
    [createAndOpen],
  )

  /**
   * Ouvre l'outil MCD sur la base ou le corrigé d'un devoir. Le contenu
   * vient du serveur ; un contenu absent ou illisible donne un modèle
   * vide, pour que le prof puisse commencer.
   */
  const openAssignmentModel = useCallback(
    (assignment: { id: string; classroomId: string; title: string }, field: AssignmentField, content: string | null) => {
      if (account.kind !== 'cloud') return
      const parsed = content === null ? null : parseModelFile(content)
      const document: OpenedDocument = {
        meta: {
          id: `${assignment.id}:${field}`,
          name: assignment.title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        state: parsed && parsed.ok ? parsed.state : emptyEditorState(),
        mpdSettings: (parsed && parsed.ok ? parsed.mpdSettings : null) ?? DEFAULT_MPD_SETTINGS,
      }
      const saver = createAssignmentSaver({
        client: account.client,
        assignmentId: assignment.id,
        field,
        title: assignment.title,
        initialContent: content,
      })
      clearAnnouncement()
      setOpened((previous) => {
        previous?.saver.dispose()
        return {
          spaceKey,
          document,
          saver,
          cloud,
          target: {
            kind: 'assignment',
            classroomId: assignment.classroomId,
            assignmentId: assignment.id,
            field,
            title: assignment.title,
          },
        }
      })
    },
    [account, spaceKey, cloud, clearAnnouncement],
  )

  /**
   * Ouvre un modèle en consultation : le rendu d'un élève pour son prof,
   * ou un corrigé libéré. Rien n'est enregistré, rien ne se modifie.
   */
  const openReadOnlyModel = useCallback(
    (model: ReadOnlyModel) => {
      const parsed = parseModelFile(model.content)
      const now = new Date().toISOString()
      const document: OpenedDocument = {
        meta: { id: model.key, name: model.name, createdAt: now, updatedAt: now },
        state: parsed.ok ? parsed.state : emptyEditorState(),
        mpdSettings: (parsed.ok ? parsed.mpdSettings : null) ?? DEFAULT_MPD_SETTINGS,
      }
      // Point de départ de l'observation : ce contenu est déjà à l'écran.
      lastLiveContent.current = model.live ? model.content : null
      clearAnnouncement()
      setOpened((previous) => {
        previous?.saver.dispose()
        return {
          spaceKey,
          document,
          saver: createInertSaver(),
          cloud,
          target: {
            kind: 'review',
            classroomId: model.classroomId,
            assignmentId: model.assignmentId,
            submissionId: model.submissionId,
            label: model.label,
            labelMessage: model.labelMessage,
            origin: editorOrigin,
            live: model.live ?? null,
          },
        }
      })
    },
    [spaceKey, cloud, editorOrigin, clearAnnouncement],
  )

  /**
   * Corriger à deux le travail d'un élève. Le document part **vide** :
   * il se remplit par la synchronisation Yjs. Semer ici le contenu déjà
   * affiché doublerait tout le modèle à la fusion.
   *
   * Rien n'est enregistré de ce côté : c'est l'élève propriétaire qui
   * persiste l'état partagé, par sa route habituelle.
   */
  const openCollaboration = useCallback(
    (model: LiveCoedition) => {
      const now = new Date().toISOString()
      const document: OpenedDocument = {
        meta: { id: `${model.documentId}:coedit`, name: model.name, createdAt: now, updatedAt: now },
        state: emptyEditorState(),
        mpdSettings: DEFAULT_MPD_SETTINGS,
      }
      lastLiveContent.current = null
      clearAnnouncement()
      setOpened((previous) => {
        previous?.saver.dispose()
        return {
          spaceKey,
          // Le passage observation/correction garde le document Yjs et le cadrage.
          document: previous?.target.kind === 'review' && previous.target.live?.documentId === model.documentId
            ? previous.document : document,
          saver: createInertSaver(),
          cloud,
          target: {
            kind: 'coedit',
            classroomId: model.classroomId,
            assignmentId: model.assignmentId,
            studentId: model.studentId,
            documentId: model.documentId,
            label: model.label,
            labelMessage: model.labelMessage,
            origin: editorOrigin,
          },
        }
      })
    },
    [spaceKey, cloud, editorOrigin, clearAnnouncement],
  )

  const observeCollaboration = useCallback((state: McdEditorState) => {
    setOpened((previous) => {
      if (previous?.target.kind !== 'coedit') return previous
      const target = previous.target
      return { ...previous, document: { ...previous.document, state }, target: {
        kind: 'review', classroomId: target.classroomId, assignmentId: target.assignmentId,
        submissionId: null, label: target.label, labelMessage: target.labelMessage ? { ...target.labelMessage, source: "Travail de {0}, en direct" } : undefined, origin: target.origin,
        live: { studentId: target.studentId, documentId: target.documentId },
      } }
    })
  }, [])

  // Dernier contenu adopté, pour ne remplacer l'état que s'il a changé.
  const lastLiveContent = useRef<string | null>(null)

  /**
   * Adopte un modèle observé. Seul l'état est remplacé, jamais
   * l'identifiant du document : l'éditeur ne remonte pas, donc le
   * cadrage et la vue du prof sont gardés. Un contenu identique au
   * précédent ne change rien, un contenu illisible non plus : on garde
   * alors la dernière image bonne.
   */
  const adoptLiveContent = useCallback((content: string) => {
    if (content === lastLiveContent.current) {
      return
    }
    lastLiveContent.current = content
    const parsed = parseModelFile(content)
    if (!parsed.ok) {
      return
    }
    setOpened((previous) =>
      previous ? { ...previous, document: { ...previous.document, state: parsed.state } } : previous,
    )
  }, [])

  const rename = useCallback(
    async (name: string): Promise<boolean> => {
      if (!current) return false
      const renamed = await repository.rename(current.document.meta.id, name)
      if (!renamed.ok) return false
      setOpened((previous) =>
        previous ? { ...previous, document: { ...previous.document, meta: renamed.value } } : previous,
      )
      return true
    },
    [repository, current],
  )

  /**
   * Ferme le modèle ouvert : on laisse un instant à l'envoi, puis on
   * libère. Aucune navigation ici, elle appartient à l'appelant.
   */
  const closeDocument = useCallback(async () => {
    if (current) {
      // On laisse un instant à l'envoi ; hors ligne, le travail reste gardé.
      await Promise.race([
        current.saver.flush(),
        new Promise((resolve) => setTimeout(resolve, LEAVE_FLUSH_MS)),
      ])
      current.saver.dispose()
    }
    setOpened(null)
  }, [current])

  return {
    opened,
    current,
    openDocument,
    openGroupDocument,
    openWorkDocument,
    newDocument,
    openExample,
    importFile,
    openAssignmentModel,
    openReadOnlyModel,
    openCollaboration,
    observeCollaboration,
    rename,
    closeDocument,
    adoptLiveContent,
  }
}
