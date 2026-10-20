import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { Update } from '@tauri-apps/plugin-updater'
import { getVersion } from '@tauri-apps/api/app'
import { Button } from './ui/Button'
import { dialogClass } from './ui/dialogClass'
import { prepareDesktopUpdate } from '../lib/updateSafety'
import { installUpdate } from '../lib/desktopUpdate'
import type { UpdateProgress } from '../lib/desktopUpdate'

interface UpdateControl { checking: boolean; message: string; version: string; check: () => void }
const Context = createContext<UpdateControl | null>(null)

export function DesktopUpdateButton() {
  const control = useContext(Context)
  if (!control) return null
  return <Button type="button" size="sm" disabled={control.checking} onClick={control.check}
    title={'Meriz '+control.version+' — '+control.message}>
    {control.checking ? 'Vérification…' : control.message === 'Votre version est à jour' ? 'À jour' : 'Mise à jour'}
  </Button>
}

export function DesktopUpdates({ children }: { children: ReactNode }) {
  return isTauri() ? <NativeUpdates>{children}</NativeUpdates> : children
}

function NativeUpdates({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('Vérifier les mises à jour')
  const [update, setUpdate] = useState<Update | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const lastCheck = useRef(Date.now())
  const dialog = useRef<HTMLDialogElement>(null)
  const currentUpdate = useRef<Update | null>(null)

  useEffect(() => { void getVersion().then(setVersion).catch(() => {}) }, [])
  const check = useCallback(async (manual = false) => {
    if (busy.current || currentUpdate.current || (!manual && Date.now()-lastCheck.current < 60_000)) return
    busy.current = true
    lastCheck.current = Date.now()
    setChecking(true)
    try {
      const { check: findUpdate } = await import('@tauri-apps/plugin-updater')
      const found = await findUpdate({ timeout: 10_000 })
      currentUpdate.current = found
      setUpdate(found)
      setError(null)
      setMessage(found ? 'Nouvelle version disponible' : 'Votre version est à jour')
    } catch {
      setMessage('Vérification impossible. Réessayez avec une connexion Internet.')
    } finally {
      busy.current = false
      setChecking(false)
    }
  }, [])
  useEffect(() => {
    const automatic = () => { if (document.visibilityState === 'visible') void check() }
    const timer = window.setInterval(automatic, 5*60_000)
    window.addEventListener('focus', automatic)
    document.addEventListener('visibilitychange', automatic)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', automatic)
      document.removeEventListener('visibilitychange', automatic)
    }
  }, [check])
  useEffect(() => {
    if (update && !dialog.current?.open) dialog.current?.showModal()
  }, [update])

  const install = async () => {
    if (!update || busy.current) return
    busy.current = true
    setError(null)
    setSaving(true)
    try {
      await prepareDesktopUpdate()
      setSaving(false)
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await installUpdate(update, setProgress, relaunch)
    } catch (reason) {
      setSaving(false)
      setProgress(null)
      setError(reason instanceof Error ? reason.message : 'Installation impossible. Vos documents sont conservés ; réessayez.')
    } finally { busy.current = false }
  }
  const working = saving || progress !== null
  return <Context.Provider value={{ checking, message, version, check: () => { void check(true) } }}>
    {children}
    <span role="status" className="sr-only">{message}</span>
    {update && <dialog ref={dialog} aria-labelledby="desktop-update-title" aria-describedby="desktop-update-message"
      onCancel={(event) => event.preventDefault()} className={dialogClass('md')}>
      <div className="p-6">
        <h2 id="desktop-update-title" className="text-lg font-semibold">Meriz {update.version} est disponible</h2>
        <p id="desktop-update-message" className="mt-3 text-sm leading-6 text-ink-soft">
          Cette mise à jour est nécessaire pour continuer avec une version compatible.
          Votre document sera enregistré avant l’installation, puis Meriz redémarrera. Vous n’avez rien à désinstaller.
        </p>
        {saving && <p role="status" className="mt-4 text-sm">Enregistrement du travail…</p>}
        {progress && <p role="status" className="mt-4 text-sm">{progress.phase === 'installing' ? 'Installation et redémarrage…' : 'Téléchargement de la mise à jour…'}</p>}
        {progress?.phase === 'downloading' && <progress className="mt-3 w-full" aria-label="Téléchargement" max={100} value={progress.percent ?? undefined} />}
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {error && <Button type="button" onClick={() => { dialog.current?.close(); currentUpdate.current = null; void update.close(); setUpdate(null); setError(null) }}>Reprendre le travail</Button>}
          <Button type="button" variant="primary" disabled={working} onClick={() => void install()}>{working ? 'Mise à jour en cours…' : error ? 'Réessayer' : 'Enregistrer et mettre à jour'}</Button>
        </div>
      </div>
    </dialog>}
  </Context.Provider>
}
