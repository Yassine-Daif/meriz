import { useId } from 'react'
import { AVATAR_PALETTE } from '../lib/avatarPalette'
import { contrastRatio, formatContrast, normalizeHex, READABLE_CONTRAST } from '../lib/color'
import { Avatar } from './ui/Avatar'
import type { AvatarPerson } from './ui/Avatar'

interface AvatarPickerProps {
  /** Nom en cours de saisie, pour que l'aperçu suive le formulaire. */
  person: AvatarPerson
  onChange: (colors: { avatarBg: string; avatarFg: string }) => void
  /** Message de refus (contraste trop faible, erreur du serveur). */
  error?: string
}

/**
 * Choix des deux couleurs de la pastille : dix paires prêtes, ou une
 * couleur libre pour chacune. L'aperçu et le rapport de contraste
 * suivent le choix en direct.
 */
export function AvatarPicker({ person, onChange, error }: AvatarPickerProps) {
  const name = useId()
  const bgId = useId()
  const fgId = useId()
  const errorId = useId()
  const ratio = contrastRatio(person.avatarBg, person.avatarFg)
  const readable = ratio >= READABLE_CONTRAST

  const setBackground = (value: string) => {
    const hex = normalizeHex(value)
    if (hex) onChange({ avatarBg: hex, avatarFg: person.avatarFg })
  }
  const setText = (value: string) => {
    const hex = normalizeHex(value)
    if (hex) onChange({ avatarBg: person.avatarBg, avatarFg: hex })
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex flex-col items-center gap-2">
        <Avatar person={person} size="lg" />
        <p className="text-xs text-ink-soft">Aperçu</p>
      </div>

      <div className="min-w-0 flex-1">
        <fieldset aria-describedby={error ? errorId : undefined}>
          <legend className="text-sm font-medium text-ink">Paires prêtes</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {AVATAR_PALETTE.map((pair) => {
              const checked = pair.background === person.avatarBg && pair.text === person.avatarFg
              return (
                <label
                  key={pair.label}
                  title={pair.label}
                  className={`cursor-pointer rounded-full p-0.5 transition-shadow duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                    checked ? 'ring-2 ring-mark' : 'ring-1 ring-line hover:ring-line-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name={name}
                    checked={checked}
                    onChange={() => onChange({ avatarBg: pair.background, avatarFg: pair.text })}
                    className="sr-only"
                  />
                  <span className="sr-only">{pair.label}</span>
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: pair.background, color: pair.text }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                  >
                    {checked ? '✓' : 'Aa'}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <label htmlFor={bgId} className="block text-sm font-medium text-ink">
              Couleur de fond
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id={bgId}
                type="color"
                value={person.avatarBg}
                onChange={(event) => setBackground(event.target.value)}
                className="h-10 w-14 cursor-pointer rounded-control border border-line-strong bg-surface p-1"
              />
              <span className="font-mono text-xs text-ink-soft">{person.avatarBg}</span>
            </div>
          </div>
          <div>
            <label htmlFor={fgId} className="block text-sm font-medium text-ink">
              Couleur du texte
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id={fgId}
                type="color"
                value={person.avatarFg}
                onChange={(event) => setText(event.target.value)}
                className="h-10 w-14 cursor-pointer rounded-control border border-line-strong bg-surface p-1"
              />
              <span className="font-mono text-xs text-ink-soft">{person.avatarFg}</span>
            </div>
          </div>
        </div>

        <p role="status" aria-live="polite" className="mt-3 text-sm text-ink-soft">
          <span aria-hidden="true" className={readable ? 'text-sage' : 'text-warning'}>
            {readable ? '✓ ' : '⚠ '}
          </span>
          Contraste {formatContrast(ratio)} :{' '}
          {readable ? 'lisible' : 'trop faible, il faut au moins 4,5 sur 1 pour enregistrer'}
        </p>

        {error && (
          <p id={errorId} className="mt-2 text-sm font-medium text-danger">
            <span aria-hidden="true">✕ </span>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
