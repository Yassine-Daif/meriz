import { t } from "../../i18n/runtime"
import { useLanguage } from "../../lib/useLanguage"
import { themeStore } from '../../lib/theme'
import type { ThemePreference } from '../../lib/theme'
import { useTheme } from '../../lib/useTheme'
import { Segmented } from './Segmented'

const OPTIONS = [
  { value: 'system', get label() { return t("Système") } },
  { value: 'light', get label() { return t("Clair") } },
  { value: 'dark', get label() { return t("Sombre") } },
] as const satisfies readonly { value: ThemePreference; label: string }[]

interface ThemeToggleProps {
  /** Libellé visible (page de profil) ou réservé aux lecteurs d'écran (en-tête). */
  showLegend?: boolean
  size?: 'sm' | 'md'
}

/** Choix du thème : Système, Clair ou Sombre. */
export function ThemeToggle({ showLegend = false, size = 'sm' }: ThemeToggleProps) {
  useLanguage()
  const { preference } = useTheme()
  return (
    <Segmented<ThemePreference>
      legend={t("Thème")}
      hideLegend={!showLegend}
      options={OPTIONS}
      value={preference}
      onChange={themeStore.setPreference}
      size={size}
    />
  )
}
