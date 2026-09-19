import { useEffect, useRef, useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import { becomeTeacher } from '../lib/profileApi'
import { useSession } from './sessionContext'
import { FormAlert } from './FormAlert'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'

interface TeacherModeSectionProps {
  user: ApiUser
  /** Client lié au compte connecté. */
  client: ApiClient
  onShowClasses: () => void
}

/**
 * Passage en mode prof. L'application ne refait pas la règle : elle lit
 * le rôle et le statut scolaire donnés par le serveur, et affiche son
 * refus éventuel tel quel.
 */
export function TeacherModeSection({ user, client, onShowClasses }: TeacherModeSectionProps) {
  const { updateUser } = useSession()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [activated, setActivated] = useState(false)
  const successRef = useRef<HTMLParagraphElement>(null)

  // Le bouton disparaît au succès : le focus va au message de confirmation.
  useEffect(() => {
    if (activated) successRef.current?.focus()
  }, [activated])

  const activate = async () => {
    if (pending) return
    setPending(true)
    setError(null)
    const outcome = await becomeTeacher(client)
    setPending(false)
    if (outcome.ok) {
      updateUser(outcome.value)
      setActivated(true)
      return
    }
    setError(outcome.error.message)
    setAttempt((count) => count + 1)
  }

  let content
  if (user.role === 'teacher') {
    content = (
      <>
        {activated ? (
          <p ref={successRef} tabIndex={-1} role="status" className="text-sm text-zinc-800">
            <span aria-hidden="true">✓ </span>
            Mode prof activé. Vous pouvez maintenant créer des classes.
          </p>
        ) : (
          <p className="text-sm text-zinc-700">
            Le mode prof est actif : vous pouvez créer des classes, partager leur code et gérer
            leurs membres.
          </p>
        )}
        <button type="button" onClick={onShowClasses} className={`${secondaryButtonClass} mt-3`}>
          Aller à mes classes
        </button>
      </>
    )
  } else if (user.isAcademic) {
    content = (
      <>
        <p className="text-sm leading-6 text-zinc-700">
          Le mode prof vous permet de créer des classes, d'obtenir un code à partager avec vos
          élèves et de gérer leurs membres. Vos documents et les classes que vous avez rejointes
          ne changent pas. Le mode prof reste actif ensuite.
        </p>
        <div className="mt-3">
          <FormAlert message={error} attempt={attempt} />
        </div>
        <button
          type="button"
          onClick={() => void activate()}
          disabled={pending}
          className={`${primaryButtonClass} mt-3`}
        >
          {pending ? 'Activation…' : 'Activer le mode prof'}
        </button>
      </>
    )
  } else {
    content = (
      <p className="text-sm leading-6 text-zinc-700">
        Le mode prof est réservé aux adresses email scolaires ou universitaires. Votre adresse de
        connexion n'en fait pas partie.
      </p>
    )
  }

  return (
    <section aria-labelledby="mode-prof-titre" className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h2 id="mode-prof-titre" className="text-sm font-semibold">
        {user.role === 'teacher' ? 'Mode prof' : 'Devenir enseignant'}
      </h2>
      <div className="mt-2">{content}</div>
    </section>
  )
}
