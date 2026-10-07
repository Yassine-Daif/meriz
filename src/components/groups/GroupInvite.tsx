import { useId, useMemo } from 'react'
import { copyText } from '../../lib/clipboard'
import { discordMessage, invitationMailto, invitationMessage } from '../../lib/groupInvite'
import { Button } from '../ui/Button'
import { buttonClass } from '../ui/buttonClass'

interface GroupInviteProps {
  groupName: string
  joinCode: string
  onStatus: (text: string) => void
}

/** L'adresse de l'application telle qu'elle est ouverte, sans le fichier. */
function appUrl(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.location.origin + window.location.pathname.replace(/[^/]*$/, '')
}

/**
 * Partager l'invitation d'un groupe. Trois chemins, et aucune promesse
 * en trop : on copie le message, on ouvre un courrier prérempli, ou on
 * copie la version Discord. Depuis un navigateur, rien ne peut être
 * publié dans Discord à notre place, et c'est écrit noir sur blanc.
 */
export function GroupInvite({ groupName, joinCode, onStatus }: GroupInviteProps) {
  const titleId = useId()
  const messageId = useId()
  const params = useMemo(() => ({ groupName, joinCode, appUrl: appUrl() }), [groupName, joinCode])
  const message = invitationMessage(params)

  const copy = async (text: string, succes: string) => {
    const copied = await copyText(text)
    onStatus(copied ? succes : 'Copie impossible dans ce navigateur : sélectionnez le message affiché.')
  }

  return (
    <section aria-labelledby={titleId} className="mt-4 border-t border-line pt-4">
      <h4 id={titleId} className="text-sm font-semibold text-ink">
        Partager l’invitation
      </h4>
      <label htmlFor={messageId} className="mt-2 block text-xs font-medium text-ink-soft">
        Message d’invitation, prêt à coller
      </label>
      <textarea
        id={messageId}
        readOnly
        rows={6}
        value={message}
        className="mt-1 w-full rounded-control border border-line-strong bg-surface px-3 py-2 font-mono text-xs leading-5 text-ink"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={() => void copy(message, 'Invitation copiée.')}>
          Copier l’invitation
        </Button>
        <a href={invitationMailto(params)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          Ouvrir un mail prérempli
        </a>
        <Button
          size="sm"
          onClick={() => void copy(discordMessage(params), 'Invitation Discord copiée : collez-la dans votre salon.')}
        >
          Copier pour Discord
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Discord ne peut pas recevoir de message depuis un site web. Le bouton copie l’invitation, vous la collez
        dans votre salon.
      </p>
    </section>
  )
}
