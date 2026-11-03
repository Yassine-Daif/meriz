import { Select } from './Select'
import { useId } from 'react'
import { useLanguage } from '../../lib/useLanguage'
import { setLanguage, t } from '../../i18n/runtime'
export function LanguageControl() {
  const language = useLanguage()
  const id = useId()
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-medium">{t('Langue')}</label>
    <Select id={id} value={language} onValueChange={value => setLanguage(value === 'en' ? 'en' : 'fr')} className="min-h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink">
      <option value="fr" lang="fr">Français</option><option value="en" lang="en">English</option>
    </Select>
  </div>
}
