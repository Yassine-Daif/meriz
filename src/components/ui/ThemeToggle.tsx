import { themeStore } from '../../lib/theme'
import type { ThemePreference } from '../../lib/theme'
import { useTheme } from '../../lib/useTheme'
import { Segmented } from './Segmented'

const OPTIONS = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
] as const satisfies readonly { value: ThemePreference; label: string }[]

interface ThemeToggleProps {
  /** Libellé visible (page de profil) ou réservé aux lecteurs d'écran (en-tête). */
  showLegend?: boolean
  size?: 'sm' | 'md'
}

/** Choix du thème : Système, Clair ou Sombre. */
export function ThemeToggle({ showLegend = false, size = 'sm' }: ThemeToggleProps) {
  const { preference } = useTheme()
  return (
    <Segmented<ThemePreference>
      legend="Thème"
      hideLegend={!showLegend}
      options={OPTIONS}
      value={preference}
      onChange={themeStore.setPreference}
      size={size}
    />
  )
}
