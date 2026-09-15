import type { McdEditorState } from '../model/mcdReducer'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import type { MpdSettings } from '../model/mpd'
import { nameFromFileName, parseModelFile } from './persistence'

export type ImportResult =
  | { ok: true; name: string; state: McdEditorState; mpdSettings: MpdSettings }
  | { ok: false; error: string }

/**
 * Lit un fichier Meriz choisi par l'utilisateur, prêt à devenir un
 * document. Le nom vient du fichier lui-même s'il en porte un, sinon
 * du nom du fichier sur le disque.
 */
export async function importModelFile(file: File): Promise<ImportResult> {
  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: 'Impossible de lire ce fichier.' }
  }
  const result = parseModelFile(text)
  if (!result.ok) {
    return result
  }
  return {
    ok: true,
    name: result.name ?? nameFromFileName(file.name),
    state: result.state,
    mpdSettings: result.mpdSettings ?? DEFAULT_MPD_SETTINGS,
  }
}
