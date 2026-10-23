import { useToast } from './ui/toastContext'
import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { Icon } from './ui/Icon'
import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { McdEditorState } from '../model/mcdReducer'
import type { MpdSettings } from '../model/mpd'
import { fileNameFor, serializeModel } from '../lib/persistence'
import { exportToPng } from '../lib/exportImage'
import { saveFileAs } from '../lib/download'
import { ImportFileButton } from './ImportFileButton'

interface FileActionsProps {
  state: McdEditorState
  /** Réglages MPD (dialecte, surcharges de types), enregistrés avec le modèle. */
  mpdSettings: MpdSettings
  /** Nom du document : il nomme le fichier exporté et y est enregistré. */
  documentName: string
  /** L'export PNG capture le DOM du canvas : il faut la vue MCD affichée. */
  mcdVisible: boolean
  /** Crée un nouveau document et l'ouvre. Absent hors de l'espace documents. */
  onNewDocument?: () => void
  /** Importe un fichier comme nouveau document : message d'erreur, ou null. */
  onImportFile?: (file: File) => Promise<string | null>
}

const buttonClass =
  'inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-2.5 py-1.5 text-sm hover:bg-shell'

/**
 * Actions fichier du document courant : Nouveau et Ouvrir créent un
 * autre document (le courant est déjà sauvegardé), Enregistrer exporte
 * le document en fichier, Exporter en image produit un PNG du MCD.
 */
export function FileActions({
  state,
  mpdSettings,
  documentName,
  mcdVisible,
  onNewDocument,
  onImportFile,
}: FileActionsProps) {
  useLanguage()
  const menu = useRef<HTMLDetailsElement>(null)
  const [menuAt, setMenuAt] = useState({ left: 12, top: 60, width: 260 })
  useEffect(() => {
    const closeOutside = (event: globalThis.PointerEvent) => { if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.removeAttribute('open') }
    const closeOnResize = () => menu.current?.removeAttribute('open')
    window.addEventListener('resize', closeOnResize)
    document.addEventListener('pointerdown', closeOutside)
    return () => { document.removeEventListener('pointerdown', closeOutside); window.removeEventListener('resize', closeOnResize) }
  }, [])
  const closeMenu = () => menu.current?.removeAttribute('open')
  const setStatus = useToast()
  const { getNodes } = useReactFlow()

  const handleSave = async () => {
    const blob = new Blob([serializeModel(state, mpdSettings, documentName)], {
      type: 'application/json',
    })
    const result = await saveFileAs(fileNameFor(documentName), blob, t("Modèle Meriz"), {
      'application/json': ['.json'],
    })
    if (result === 'cancelled') {
      setStatus({ kind: 'info', text: t("Enregistrement annulé.") })
    } else {
      setStatus({
        kind: 'info',
        text: result === 'saved' ? t("Document enregistré en fichier.") : t("Document téléchargé."),
      })
    }
  }

  const handleImport = async (file: File) => {
    if (!onImportFile) return
    const error = await onImportFile(file)
    if (error) {
      // Fichier invalide : message clair, le document courant reste ouvert.
      setStatus({ kind: 'error', text: t("Erreur : {0}", [error]) })
    }
  }

  const handleExport = async () => {
    if (!mcdVisible) {
      setStatus({ kind: 'error', text: t("Erreur : ouvrez la vue MCD pour exporter l'image.") })
      return
    }
    const nodes = getNodes()
    if (nodes.length === 0) {
      setStatus({ kind: 'error', text: t("Erreur : rien à exporter, le modèle est vide.") })
      return
    }
    const viewportElement = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewportElement) {
      setStatus({ kind: 'error', text: t("Erreur : la zone de dessin est introuvable.") })
      return
    }
    try {
      const dataUrl = await exportToPng(nodes, viewportElement)
      const blob = await (await fetch(dataUrl)).blob()
      const imageName = fileNameFor(documentName).replace(/\.meriz\.json$/, '.png')
      const result = await saveFileAs(imageName, blob, t("Image PNG"), { 'image/png': ['.png'] })
      if (result === 'cancelled') {
        setStatus({ kind: 'info', text: t("Export annulé.") })
      } else {
        setStatus({ kind: 'info', text: t("Image PNG exportée.") })
      }
    } catch {
      setStatus({ kind: 'error', text: t("Erreur : l'export de l'image a échoué.") })
    }
  }

  return (
    <div role="group" aria-label={t("Fichier")} className="editor-file-actions flex min-w-0 flex-wrap items-center gap-1.5">
      <details ref={menu} className="relative" onToggle={event => { if (event.currentTarget.open) { const bounds = event.currentTarget.getBoundingClientRect(); const width = Math.min(260, window.innerWidth - 24); setMenuAt({ left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)), top: bounds.bottom + 6, width }) } }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeMenu(); menu.current?.querySelector('summary')?.focus() } }}>
        <summary className={buttonClass + ' cursor-pointer list-none'}><Icon name="folder" /><span>{t("Fichier")}</span></summary>
        <div style={menuAt} className="editor-file-menu fixed z-50 flex max-w-[calc(100vw-24px)] flex-col gap-1 rounded-card border border-line-strong bg-surface p-2 shadow-soft">
          {onNewDocument && <button type="button" className={buttonClass + ' !justify-start'} onClick={() => { closeMenu(); onNewDocument() }}><Icon name="plus" />{t("Nouveau")}</button>}
          {onImportFile && <ImportFileButton className={buttonClass + ' !justify-start'} onFile={file => { closeMenu(); void handleImport(file) }}><Icon name="folder" />{t("Ouvrir")}</ImportFileButton>}
          <button type="button" className={buttonClass + ' !justify-start'} onClick={() => { closeMenu(); void handleSave() }}><Icon name="save" />{t("Enregistrer une copie en fichier")}</button>
          <button type="button" className={buttonClass + ' !justify-start'} disabled={!mcdVisible} onClick={() => { closeMenu(); void handleExport() }}><Icon name="image" />{t("Exporter le MCD en image PNG")}</button>
        </div>
      </details>
      <button type="button" className={buttonClass} title={t("Enregistrer une copie en fichier")} aria-label={t("Enregistrer une copie en fichier")} onClick={() => void handleSave()}><Icon name="save" /><span className="hidden md:inline">{t("Enregistrer")}</span></button>
      <button type="button" className={buttonClass} disabled={!mcdVisible} title={t("Exporter le MCD en image PNG")} aria-label={t("Exporter le MCD en image PNG")} onClick={() => void handleExport()}><Icon name="image" /><span className="hidden lg:inline">{t("Image")}</span></button>
    </div>
  )
}
