import { useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { listGroups } from '../../lib/groupsApi'
import type { GroupSummary } from '../../lib/groupsApi'
import { useCollections } from '../useCollections'
import { t } from '../../i18n/runtime'
import { useLanguage } from '../../lib/useLanguage'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'

export function GroupTemplatePanel({ client, sourceId, sourceGroup, name, onClose, onDone }: { client: ApiClient; sourceId: string; sourceGroup: string; name: string; onClose: () => void; onDone: () => void }) {
  useLanguage()
  const organizer = useCollections(client, 'groups')
  const [groups,setGroups] = useState<GroupSummary[]>([]), [targets,setTargets] = useState<string[]>([])
  const [requestKey] = useState(() => crypto.randomUUID())
  const [pending,setPending] = useState(false), [error,setError] = useState<string | null>(null)
  useEffect(() => { let active=true; void listGroups(client).then(result=>{ if(active) { if(result.ok) setGroups(result.value.filter(g=>g.id!==sourceGroup)); else setError(result.error.message) } }); return ()=>{ active=false } },[client,sourceGroup])
  async function distribute() {
    if(pending || targets.length===0) return
    setPending(true);setError(null)
    try { const result=await client.request('POST','/documents/'+encodeURIComponent(sourceId)+'/group-distribution',{group_ids:targets,request_key:requestKey}); if(result.ok) onDone(); else setError(result.error.message) } finally { setPending(false) }
  }
  return <section className="mt-4 space-y-4 rounded-card border border-accent bg-surface p-4" aria-label={t('Diffuser un modèle aux groupes')}>
    <h4 className="break-words font-semibold">{name}</h4><p className="text-sm text-ink-soft">{t('Chaque groupe recevra une copie indépendante. Les sessions en direct et les documents existants ne seront pas reliés ni remplacés.')}</p>
    <Select value="" aria-label={t('Ajouter un regroupement')} disabled={pending} onValueChange={id=>{ const c=organizer.collections.find(c=>c.id===id); if(c)setTargets(previous=>[...new Set([...previous,...c.itemIds])].filter(id=>groups.some(g=>g.id===id))) }}><option value="">{t('Ajouter un regroupement…')}</option>{organizer.collections.filter(c=>!c.archived).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
    <fieldset disabled={pending} className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2"><legend className="mb-2 text-sm">{t('Groupes destinataires : {0}',[targets.length])}</legend>{groups.map(g=><label key={g.id} className="flex min-w-0 items-center gap-2 text-sm"><input type="checkbox" checked={targets.includes(g.id)} onChange={e=>setTargets(previous=>e.target.checked?[...new Set([...previous,g.id])]:previous.filter(id=>id!==g.id))}/><span className="min-w-0 break-words">{g.name}</span></label>)}</fieldset>
    <div className="flex flex-wrap gap-2"><Button variant="primary" loading={pending} disabled={targets.length===0 || targets.length>20} onClick={()=>void distribute()}>{t('Confirmer la diffusion')}</Button><Button disabled={pending} onClick={onClose}>{t('Annuler')}</Button></div>
    <p className="text-xs text-ink-soft">{t('Sélectionnez au maximum 20 groupes par diffusion.')}</p>
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
  </section>
}
