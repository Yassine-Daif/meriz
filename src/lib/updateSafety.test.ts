import { describe, expect, it, vi } from 'vitest'
import { prepareDesktopUpdate, registerUpdateGuard } from './updateSafety'
import { installUpdate } from './desktopUpdate'

describe('protection des documents avant mise à jour', () => {
  it('attend la sauvegarde puis autorise le téléchargement et le redémarrage', async () => {
    const order: string[] = []
    const remove = registerUpdateGuard(async () => { await Promise.resolve(); order.push('saved'); return true })
    try {
      await prepareDesktopUpdate()
      await installUpdate({ version: '1.2.0', downloadAndInstall: async () => { order.push('installed') } }, () => {}, async () => { order.push('restart') })
      expect(order).toEqual(['saved', 'installed', 'restart'])
    } finally { remove() }
  })
  it('refuse de continuer si un devoir ou un document reste non enregistré', async () => {
    const remove = registerUpdateGuard(async () => false)
    const install = vi.fn()
    try {
      await expect((async () => { await prepareDesktopUpdate(); install() })()).rejects.toThrow('sauvegarde')
      expect(install).not.toHaveBeenCalled()
    } finally { remove() }
  })
  it('ne garde pas le document fermé comme obstacle à une mise à jour', async () => {
    const guard = vi.fn(async () => false)
    const remove = registerUpdateGuard(guard)
    remove()
    await expect(prepareDesktopUpdate()).resolves.toBeUndefined()
    expect(guard).not.toHaveBeenCalled()
  })
})
