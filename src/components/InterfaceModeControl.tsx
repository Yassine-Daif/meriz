import { useRef, useState } from 'react'
import { useInterfaceMode } from './useInterfaceMode'
import type { InterfaceMode } from '../lib/interfaceMode'
import { recommendedMode } from '../lib/interfaceMode'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { Button } from './ui/Button'

export function InterfaceModeControl({ initial = false, onBack }: { initial?: boolean; onBack?: () => void }) {
  useLanguage()
  const { mode, choose, category } = useInterfaceMode()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  async function select(next: InterfaceMode) {
    if (busy.current) return
    busy.current = true; setPending(true); setError(null)
    try { setError(await choose(next)) } catch { setError(t('Impossible d’enregistrer votre choix. Réessayez.')) }
    finally { busy.current = false; setPending(false) }
  }
  const descriptions: Record<InterfaceMode, string[]> = {
    beginner: ['Dictionnaire simplifié avec les vrais noms des types.', 'MCD, cardinalités, vérification et MLD.', 'Enregistrement, image et collaboration.'],
    complete: ['Tous les outils de l’interface Débutant.', 'MPD, SQL et réglages des moteurs de base de données.', 'Génération de code Laravel et Symfony.'],
  }
  const content = <>
    <div className="space-y-2"><h2 className="text-lg font-semibold" id={initial ? 'interface-choice-title' : undefined}>{t(initial ? 'Quelle interface souhaitez-vous utiliser ?' : 'Niveau de l’interface')}</h2>
      <p className="text-sm text-ink-soft">{t('Le même Meriz, avec les outils adaptés à votre pratique. Vos documents et la collaboration restent compatibles.')}</p></div>
    <div className={initial ? "grid min-w-0 gap-3 sm:grid-cols-2" : "grid min-w-0 gap-3"}>
      {(['beginner', 'complete'] as const).map(value => <div key={value} className={'flex min-w-0 flex-col gap-3 rounded-card border p-4 ' + (mode === value ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}>
        <h3 className="font-semibold">{t(value === 'beginner' ? 'Débutant' : 'Complet')}{initial && recommendedMode(category) === value && <span className="ml-2 text-xs font-normal text-ink-soft">{t('Conseillé pour votre usage')}</span>}</h3>
        <ul className="flex-1 list-disc space-y-2 pl-4 text-sm text-ink-soft">{descriptions[value].map(text => <li key={text}>{t(text)}</li>)}</ul>
        {value === 'beginner' && <p className="text-xs text-ink-soft">{t('MPD, SQL et code sont masqués. Les données existantes sont conservées.')}</p>}
        <Button variant={mode === value ? 'soft' : 'primary'} disabled={pending || mode === value} aria-pressed={mode === value} onClick={() => void select(value)}>{t(mode === value ? 'Interface actuelle' : value === 'beginner' ? 'Choisir Débutant' : 'Choisir Complet')}</Button>
      </div>)}
    </div>
    <p className="text-sm text-ink-soft">{t('Vous pourrez changer ce choix dans votre profil ou les préférences. Les réglages d’un exercice restent prioritaires.')}</p>
    {pending && <p role="status" className="text-sm">{t('Enregistrement…')}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </>
  return initial ? <main className="min-h-dvh overflow-y-auto bg-shell px-4 py-8 text-ink sm:py-12" aria-labelledby="interface-choice-title">
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6"><p className="text-xl font-semibold">Meriz</p>{content}{onBack && <Button variant="ghost" onClick={onBack}>{t('Retour')}</Button>}</div>
  </main> : <section className="space-y-4">{content}</section>
}
