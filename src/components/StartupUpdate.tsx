import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import type { UpdateProgress } from '../lib/desktopUpdate'

export function StartupUpdate({ state }: { state: UpdateProgress }) {
  useLanguage()
  const text = state.phase === 'checking'
    ? t("Vérification des mises à jour…")
    : state.phase === 'installing'
      ? t("Installation de Meriz ")+state.version+'…'
      : t("Téléchargement de Meriz ")+state.version+'…'
  return (
    <main className="flex min-h-dvh items-center justify-center bg-shell p-6 text-ink">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">{t("Meriz")}</h1>
        <p role="status" className="mt-3 text-sm">{text}</p>
        {state.phase === 'downloading' && (
          <progress aria-label={t("Téléchargement de la mise à jour")} max={100}
            value={state.percent ?? undefined} className="mt-4 w-full" />
        )}
        <p className="mt-3 text-xs text-ink-soft">{t("Vos documents restent sur votre appareil.")}</p>
      </div>
    </main>
  )
}
