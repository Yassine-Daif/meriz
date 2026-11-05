import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { parseCollection } from '../lib/collectionsApi'
import type { WorkspaceCollection } from '../lib/collectionsApi'
import { listTeachingResources } from '../lib/teachingLibraryApi'
import type { TeachingResource } from '../lib/teachingLibraryApi'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { Button } from './ui/Button'

export function PrepareAcademicYearPanel({ client, source, onDone, onCancel }: { client: ApiClient; source: WorkspaceCollection; onDone: (collection: WorkspaceCollection) => void; onCancel: () => void }) {
  useLanguage()
  const [name,setName]=useState(source.name), [year,setYear]=useState((source.yearStart ?? new Date().getFullYear())+1)
  const [resources,setResources]=useState<TeachingResource[]>([]),[selected,setSelected]=useState<string[]>([])
  const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null)
  const [requestKey]=useState(()=>crypto.randomUUID())
  useEffect(()=>{let active=true;void listTeachingResources(client).then(result=>{if(active){if(result.ok)setResources(result.value);else setError(result.error.message)}});return()=>{active=false}},[client])
  async function submit(event:FormEvent){event.preventDefault();if(pending)return;setPending(true);setError(null);try{const result=await client.request('POST','/collections/'+encodeURIComponent(source.id)+'/academic-year',{name:name.trim(),year_start:year,resource_ids:selected,request_key:requestKey});if(!result.ok){setError(result.error.message);return}const collection=parseCollection(result.data);if(collection)onDone(collection);else setError(t('Réponse inattendue du serveur. Réessayez plus tard.'))}finally{setPending(false)}}
  return <form onSubmit={event=>void submit(event)} className="space-y-4 border-t border-line pt-4">
    <h3 className="font-semibold">{t('Préparer une nouvelle année')}</h3><p className="text-sm text-ink-soft">{t('Les classes seront recréées avec de nouveaux codes. Les anciens élèves, rendus, notes et sessions ne seront pas copiés. Les ressources sélectionnées seront ajoutées en brouillon.')}</p>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-1 text-sm">{t('Nom du regroupement')}<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"/></label><label className="flex min-w-0 flex-col gap-1 text-sm">{t('Année de début')}<input type="number" required min={1900} max={2200} value={year} onChange={e=>setYear(Number(e.target.value))} className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"/></label></div>
    <fieldset disabled={pending} className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2"><legend className="mb-2 text-sm">{t('Ressources à reprendre dans chaque nouvelle classe')}</legend>{resources.map(r=><label key={r.id} className="flex min-w-0 items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(r.id)} onChange={e=>setSelected(previous=>e.target.checked?[...previous,r.id]:previous.filter(id=>id!==r.id))}/><span className="min-w-0 break-words">{r.title}</span></label>)}</fieldset>
    <div className="flex flex-wrap gap-2"><Button type="submit" variant="primary" loading={pending}>{t('Créer les nouvelles classes')}</Button><Button disabled={pending} onClick={onCancel}>{t('Annuler')}</Button></div>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}
  </form>
}
