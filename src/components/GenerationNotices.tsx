import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { Notice } from './ui/Notice'

/** Invite affichée tant que le MCD ne contient aucune entité. */
export function EmptyGeneration({ viewName }: { viewName: string }) {
  useLanguage()
  return (
    <section aria-label={viewName} className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-card border border-line bg-surface p-6 text-center shadow-soft">
        <h2 className="text-lg font-semibold tracking-tight">{viewName}</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {t("Le MCD est vide : ajoutez une entité dans la vue MCD. Le MLD, le MPD et le SQL suivent le modèle en direct, sans rien avoir à relancer.")}</p>
      </div>
    </section>
  )
}

/**
 * Bandeau affiché quand le MCD contient des erreurs bloquantes.
 *
 * C'était un paragraphe nu : l'erreur apparaissait sans être annoncée.
 * Notice porte le rôle, le préfixe lu « Erreur : » et la pastille.
 */
export function ErrorsBanner() {
  useLanguage()
  return (
    <Notice tone="error" className="mb-4">
      {t("Le MCD contient des erreurs : le résultat ci-dessous peut être incomplet. Corrigez-les dans la vue MCD (bouton Vérifier).")}</Notice>
  )
}
