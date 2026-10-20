import { describe, expect, it, vi } from 'vitest'
import { updateBeforeStartup } from './desktopUpdate'
import type { StartupUpdate, UpdateProgress } from './desktopUpdate'

describe('mise à jour avant ouverture des documents', () => {
  it('démarre normalement quand la version est à jour', async () => {
    const relaunch = vi.fn()
    const states: UpdateProgress[] = []
    await updateBeforeStartup({ check: async () => null, relaunch }, (state) => states.push(state))
    expect(states).toEqual([{ phase: 'checking' }])
    expect(relaunch).not.toHaveBeenCalled()
  })

  it('attend la fin du téléchargement et de l’installation avant de redémarrer', async () => {
    const states: UpdateProgress[] = []
    const calls: string[] = []
    const update: StartupUpdate = {
      version: '1.1.1',
      downloadAndInstall: async (onEvent) => {
        calls.push('download')
        onEvent({ event: 'Started', data: { contentLength: 100 } })
        onEvent({ event: 'Progress', data: { chunkLength: 50 } })
        onEvent({ event: 'Progress', data: { chunkLength: 60 } })
        onEvent({ event: 'Finished' })
        calls.push('installed')
      },
    }
    await updateBeforeStartup({
      check: async () => update,
      relaunch: async () => { calls.push('relaunch') },
    }, (state) => states.push(state))
    expect(calls).toEqual(['download', 'installed', 'relaunch'])
    expect(states).toContainEqual({ phase: 'downloading', version: '1.1.1', percent: 50 })
    expect(states).toContainEqual({ phase: 'downloading', version: '1.1.1', percent: 100 })
    expect(states.at(-1)).toEqual({ phase: 'installing', version: '1.1.1' })
  })

  it('laisse ouvrir Meriz hors ligne', async () => {
    const relaunch = vi.fn()
    await expect(updateBeforeStartup({
      check: async () => { throw new Error('offline') }, relaunch,
    }, () => {})).resolves.toBeUndefined()
    expect(relaunch).not.toHaveBeenCalled()
  })

  it('ne redémarre pas si le téléchargement ou la signature sont refusés', async () => {
    const relaunch = vi.fn()
    await updateBeforeStartup({
      check: async () => ({
        version: '1.1.1',
        downloadAndInstall: async () => { throw new Error('invalid signature') },
      }),
      relaunch,
    }, () => {})
    expect(relaunch).not.toHaveBeenCalled()
  })

  it('accepte un téléchargement dont la taille n’est pas annoncée', async () => {
    const states: UpdateProgress[] = []
    await updateBeforeStartup({
      check: async () => ({
        version: '1.1.1',
        downloadAndInstall: async (notify) => {
          notify({ event: 'Started', data: {} })
          notify({ event: 'Progress', data: { chunkLength: 10 } })
        },
      }),
      relaunch: async () => {},
    }, (state) => states.push(state))
    expect(states.filter((state) => state.phase === 'downloading').every((state) => state.percent === null)).toBe(true)
  })
})
