/**
 * Déclenche le téléchargement d'un fichier côté navigateur,
 * depuis un Blob ou une data URL, via un lien temporaire.
 */
export function downloadFile(filename: string, source: Blob | string): void {
  const isBlob = source instanceof Blob
  const href = isBlob ? URL.createObjectURL(source) : source
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  if (isBlob) {
    URL.revokeObjectURL(href)
  }
}

/** Minimum de l'API File System Access utilisé (absente du lib DOM). */
interface SaveFilePickerHandle {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: { description?: string; accept: Record<string, string[]> }[]
    }) => Promise<SaveFilePickerHandle>
  }
}

export type SaveResult = 'saved' | 'cancelled' | 'downloaded'

/**
 * Enregistre un fichier en laissant l'utilisateur choisir le nom et
 * l'emplacement (API File System Access). Navigateur non compatible
 * ou API refusée : repli sur le téléchargement classique.
 */
export async function saveFileAs(
  suggestedName: string,
  blob: Blob,
  description: string,
  accept: Record<string, string[]>,
): Promise<SaveResult> {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      // API indisponible dans ce contexte : téléchargement classique.
    }
  }
  downloadFile(suggestedName, blob)
  return 'downloaded'
}
