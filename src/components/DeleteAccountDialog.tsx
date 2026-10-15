import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiUser } from '../lib/authApi'
import { FormField } from './FormField'
import { useSession } from './sessionContext'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'
import { dialogClass } from './ui/dialogClass'

interface DeleteAccountDialogProps {
  open: boolean
  user: ApiUser
  onCancel: () => void
  /** Compte supprimé : la session est déjà fermée quand on arrive ici. */
  onDeleted: () => void
}

/**
 * Suppression définitive du compte.
 *
 * La confirmation demande deux gestes de nature différente : le mot de
 * passe courant, que le serveur vérifie avant d'effacer quoi que ce
 * soit, et une case à cocher. Un clic distrait ne suffit pas, et le
 * bouton reste inerte tant que les deux manquent.
 */
export function DeleteAccountDialog({ open, user, onCancel, onDeleted }: DeleteAccountDialogProps) {
  const { deleteOwnAccount } = useSession()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const checkboxId = useId()
  const [password, setPassword] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
      setPassword('')
      setUnderstood(false)
      setError(null)
      setFieldError(undefined)
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || password === '' || !understood) {
      return
    }
    setPending(true)
    setError(null)
    setFieldError(undefined)
    const outcome = await deleteOwnAccount(password)
    setPending(false)
    if (outcome.ok) {
      onDeleted()
      return
    }
    const refus = outcome.error.fieldErrors.password?.[0]
    if (refus === undefined) {
      setError(outcome.error.message)
    } else {
      setFieldError(refus)
    }
    passwordRef.current?.focus()
  }

  const teacher = user.role === 'teacher'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Échap : même chemin que le bouton Annuler, jamais la suppression.
        event.preventDefault()
        onCancel()
      }}
      className={dialogClass('md')}
    >
      <form onSubmit={(event) => void submit(event)} className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          Supprimer mon compte
        </h2>

        <div className="mt-3 flex flex-col gap-2 text-sm leading-6 text-ink-soft">
          <p>
            <span className="font-semibold text-ink">Ce qui disparaît.</span> Vos informations
            personnelles, vos documents personnels et vos inscriptions aux classes et aux groupes.
          </p>
          <p>
            <span className="font-semibold text-ink">Ce qui reste, sans votre nom.</span> Un rendu
            déjà noté, un commentaire dans un fil, un document de groupe : ils appartiennent aussi
            aux autres, donc ils restent, signés « Compte supprimé ».
          </p>
          {teacher && (
            <p>
              <span className="font-semibold text-ink">Vos classes partent avec vous.</span> Vos
              classes, leurs devoirs et leurs cours sont supprimés, et vos élèves en perdent
              l'accès. Prévenez-les avant.
            </p>
          )}
          <p>Cette suppression est définitive : rien ne se récupère ensuite.</p>
        </div>

        <div className="mt-4">
          <FormField
            label="Mot de passe actuel"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            error={fieldError}
            hint="Il confirme que c'est bien vous."
            inputRef={passwordRef}
          />
        </div>

        <label htmlFor={checkboxId} className="mt-3 flex items-start gap-2 text-sm leading-6 text-ink">
          <input
            id={checkboxId}
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            className="mt-1.5"
          />
          Je comprends que la suppression est définitive.
        </label>

        {error !== null && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={password === '' || !understood}
            loading={pending}
            loadingLabel="Suppression…"
          >
            Supprimer définitivement
          </Button>
        </div>
      </form>
    </dialog>
  )
}
