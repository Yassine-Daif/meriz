import type { DownloadEvent } from '@tauri-apps/plugin-updater'

export type UpdateProgress =
  | { phase: 'checking' }
  | { phase: 'downloading'; version: string; percent: number | null }
  | { phase: 'installing'; version: string }

export interface StartupUpdate {
  version: string
  downloadAndInstall: (onEvent: (event: DownloadEvent) => void, options?: { timeout: number }) => Promise<void>
}

export interface StartupUpdater {
  check: () => Promise<StartupUpdate | null>
  relaunch: () => Promise<void>
}

/**
 * S'exécute avant le montage de l'application : aucun document ouvert ne
 * peut être interrompu. Une panne réseau laisse démarrer Meriz normalement.
 */
export async function updateBeforeStartup(
  updater: StartupUpdater,
  progress: (state: UpdateProgress) => void,
): Promise<void> {
  progress({ phase: 'checking' })
  try {
    const update = await updater.check()
    if (!update) return
    await installUpdate(update, progress, updater.relaunch)
  } catch {
    // Hors ligne, téléchargement incomplet ou signature refusée :
    // la version installée reste disponible et le prochain démarrage réessaiera.
  }
}

/** Même installation signée au démarrage et depuis le bouton du logiciel. */
export async function installUpdate(update: StartupUpdate, progress: (state: UpdateProgress) => void, relaunch: () => Promise<void>): Promise<void> {
    let downloaded = 0
    let total: number | undefined
    progress({ phase: 'downloading', version: update.version, percent: null })
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') total = event.data.contentLength
      if (event.event === 'Progress') downloaded += event.data.chunkLength
      if (event.event === 'Finished') {
        progress({ phase: 'installing', version: update.version })
      } else {
        progress({
          phase: 'downloading', version: update.version,
          percent: total && total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : null,
        })
      }
    }, { timeout: 120_000 })
    await relaunch()
}
