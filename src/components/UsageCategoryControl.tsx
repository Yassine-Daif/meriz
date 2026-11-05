import { useState } from 'react'
import { useSession } from './sessionContext'
import { parseUsageCategory } from '../lib/interfaceMode'
import { updateProfile } from '../lib/profileApi'
import { Select } from './ui/Select'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'

export function UsageCategoryControl(){
  useLanguage()
  const {session,account,updateUser}=useSession()
  const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null)
  if(session.status!=='signed-in'||account.kind!=='cloud')return null
  async function choose(value:string){const category=parseUsageCategory(value);if(!category||pending||account.kind!=='cloud')return;setPending(true);setError(null);try{const result=await updateProfile(account.client,{usageCategory:category});if(result.ok)updateUser(result.value);else setError(result.error.message)}finally{setPending(false)}}
  return <section className="my-6 space-y-3 rounded-card border border-line bg-surface p-5 sm:p-6">
    <label className="flex min-w-0 max-w-md flex-col gap-2 text-sm font-medium">{t('Vous utilisez Meriz en tant que')}<Select value={session.user.usageCategory??''} disabled={pending} onValueChange={value=>void choose(value)}><option value="" disabled>{t('Non précisé')}</option><optgroup label={t('École')}><option value="student">{t('Élève ou étudiant')}</option><option value="teacher">{t('Professeur')}</option></optgroup><optgroup label={t('Autre')}><option value="professional">{t('Professionnel')}</option><option value="individual">{t('Particulier')}</option></optgroup></Select></label>
    <p className="text-xs text-ink-soft">{t('Cette catégorie adapte votre parcours. Elle ne donne aucun droit supplémentaire et ne change pas votre niveau d’interface.')}</p>
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
  </section>
}
