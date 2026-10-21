import { t } from "../../i18n/runtime"
import { useLanguage } from "../../lib/useLanguage"
import { LanguageControl } from './LanguageControl'
import { useId, useRef } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { UiScaleControl } from '../UiScaleControl'
import { motionStore } from '../../lib/motion'
import { useMotion } from '../../lib/useMotion'
import { ToggleSwitch } from '../ToggleSwitch'
import { Button } from './Button'
import { Icon } from './Icon'
import { dialogClass } from './dialogClass'

export function PreferencesControl() {
  useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { preference, reduced } = useMotion()
  return <>
    <Button size="sm" variant="ghost" title={t("Préférences de l’interface")} aria-label={t("Préférences")} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <Icon name="settings" /><span className="hidden sm:inline">{t("Préférences")}</span><span className="sr-only sm:hidden">{t("Préférences")}</span>
    </Button>
    <dialog ref={dialog} aria-labelledby={titleId} className={dialogClass('sm')}>
      <div className="space-y-6 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 id={titleId} className="text-lg font-semibold">{t("Préférences")}</h2><Button size="sm" variant="ghost" aria-label={t("Fermer")} onClick={() => dialog.current?.close()}><Icon name="close" /></Button></div>
        <LanguageControl />
        <ThemeToggle showLegend size="md" />
        <div className="space-y-2"><p className="text-sm font-medium">{t("Taille des textes")}</p><UiScaleControl /></div>
        <ToggleSwitch label={t("Animer l’interface")} checked={preference} onChange={motionStore.setPreference} description={t("Des transitions courtes et des réactions discrètes. Votre choix est mémorisé sur cet appareil.")} />
        {reduced && <p role="status" className="text-sm text-ink-soft">{t("Votre système demande de réduire les mouvements : les animations restent désactivées.")}</p>}
        <p className="text-xs text-ink-soft">{t("Ces réglages s’appliquent à cet appareil, avec ou sans compte.")}</p>
      </div>
    </dialog>
  </>
}
