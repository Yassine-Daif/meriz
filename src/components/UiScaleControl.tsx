import { useEffect, useState } from 'react'

const UI_SCALE_KEY = 'meriz-ui-scale'

const UI_SCALES: readonly { id: string; label: string; fontSize: string }[] = [
  { id: 'small', label: 'Petite', fontSize: '87.5%' },
  { id: 'normal', label: 'Normale', fontSize: '100%' },
  { id: 'large', label: 'Grande', fontSize: '112.5%' },
  { id: 'xlarge', label: 'Très grande', fontSize: '125%' },
]

function loadScale(): string {
  try {
    const saved = localStorage.getItem(UI_SCALE_KEY)
    return UI_SCALES.some((s) => s.id === saved) ? (saved as string) : 'normal'
  } catch {
    return 'normal'
  }
}

/**
 * Réglage d'accessibilité : taille de l'interface et des textes.
 * Change la taille de police racine (tout ce qui est en rem suit),
 * mémorisé dans le navigateur. Utile sur les grands écrans comme sur
 * les petits.
 */
export function UiScaleControl() {
  const [scale, setScale] = useState(loadScale)

  useEffect(() => {
    const found = UI_SCALES.find((s) => s.id === scale)
    document.documentElement.style.fontSize = found?.fontSize ?? '100%'
    try {
      localStorage.setItem(UI_SCALE_KEY, scale)
    } catch {
      // Stockage indisponible : le réglage vaut pour la session.
    }
  }, [scale])

  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700">
      <span aria-hidden="true" className="font-semibold">
        Aa
      </span>
      <span className="sr-only">Taille de l'interface et des textes</span>
      <select
        value={scale}
        onChange={(event) => setScale(event.target.value)}
        className="rounded border border-zinc-300 bg-surface px-1.5 py-1 text-xs"
      >
        {UI_SCALES.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
