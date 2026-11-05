import { PrepareAcademicYearPanel } from './PrepareAcademicYearPanel'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { saveCollection } from '../lib/collectionsApi'
import type { CollectionDraft, CollectionKind, WorkspaceCollection } from '../lib/collectionsApi'
import type { useCollections } from './useCollections'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { useToast } from './ui/toastContext'
import { Select } from './ui/Select'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ConfirmDialog'

export function CollectionOrganizer({ client, kind, organizer, items, onSpacesChanged }: { client: ApiClient; kind: CollectionKind; organizer: ReturnType<typeof useCollections>; items: readonly { id: string; name: string }[]; onSpacesChanged?: () => void }) {
  useLanguage()
  const toast = useToast()
  const [preparing, setPreparing] = useState<WorkspaceCollection | null>(null)
  const [draft, setDraft] = useState<CollectionDraft | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<WorkspaceCollection | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null)
  const years = [...new Set(organizer.collections.flatMap(c => c.yearStart === null ? [] : [c.yearStart]))].sort((a,b) => b-a)
  const yearLabel = (year: number | null) => year === null ? t('Sans année') : year + '-' + (year + 1)
  const selected = organizer.collections.find(c => c.id === organizer.selection)
  const start = (collection: WorkspaceCollection | null) => {
    setEditing(collection?.id ?? null); setError(null)
    setDraft(collection ? { ...collection, itemIds: [...collection.itemIds] } : { name: '', kind, yearStart: new Date().getFullYear() - (new Date().getMonth() < 8 ? 1 : 0), archived: false, itemIds: [] })
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!draft || pending) return
    setPending(true); setError(null)
    try {
      const result = await saveCollection(client, editing, { ...draft, name: draft.name.trim() })
      if (result.ok) { setDraft(null); organizer.reload(); toast(t('Regroupement enregistré.')) } else setError(result.error.message)
    } finally { setPending(false) }
  }
  async function remove() {
    if (!deleting || pending) return
    setPending(true)
    try {
      const result = await client.request('DELETE', '/collections/' + encodeURIComponent(deleting.id))
      if (result.ok) { setDeleting(null); organizer.setSelection('all'); organizer.reload(); toast(t('Regroupement supprimé. Les espaces et leurs contenus sont conservés.')) } else toast({ kind: 'error', text: result.error.message })
    } finally { setPending(false) }
  }
  return <section className="mb-4 space-y-3 rounded-card border border-line bg-surface p-4" aria-label={t('Organisation des espaces')}>
    <div className="flex min-w-0 flex-wrap items-end gap-3">
      <label className="flex min-w-0 max-w-sm flex-1 basis-44 flex-col gap-1 text-xs">{t('Regroupement')}<Select value={organizer.selection} onValueChange={organizer.setSelection}>
        <option value="all">{t('Tous les regroupements')}</option><option value="unassigned">{t('Sans regroupement')}</option>
        {organizer.collections.filter(c => (organizer.year === 'all' || String(c.yearStart) === organizer.year) && (organizer.archive === 'all' || c.archived === (organizer.archive === 'archived'))).map(c => <option key={c.id} value={c.id}>{yearLabel(c.yearStart) + ' · ' + c.name + (c.archived ? ' (' + t('Archivé') + ')' : '')}</option>)}
      </Select></label>
      <label className="flex min-w-0 basis-48 flex-col gap-1 text-xs">{t('Année scolaire')}<Select value={organizer.year} onValueChange={value => { organizer.setYear(value); organizer.setSelection('all') }}><option value="all">{t('Toutes les années')}</option>{years.map(y => <option key={y} value={String(y)}>{yearLabel(y)}</option>)}<option value="null">{t('Sans année')}</option></Select></label>
      <label className="flex min-w-0 basis-32 flex-col gap-1 text-xs">{t('Afficher')}<Select value={organizer.archive} onValueChange={value => { organizer.setArchive(value); organizer.setSelection('all') }}><option value="active">{t('Actifs')}</option><option value="archived">{t('Archivés')}</option><option value="all">{t('Tout')}</option></Select></label>
      <Button size="sm" onClick={() => start(null)}>{t('Créer un regroupement')}</Button>
      {selected && kind === 'classrooms' && <Button size="sm" onClick={() => { setPreparing(selected); setDraft(null) }}>{t('Préparer une nouvelle année')}</Button>}
      {selected && <><Button size="sm" variant="ghost" onClick={() => start(selected)}>{t('Modifier')}</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(selected)}>{t('Supprimer')}</Button></>}
    </div>
    {organizer.error && <p role="alert" className="text-sm text-danger">{organizer.error}<button type="button" className="ml-2 underline" onClick={organizer.reload}>{t('Réessayer')}</button></p>}
    {preparing && <PrepareAcademicYearPanel key={preparing.id} client={client} source={preparing} onCancel={() => setPreparing(null)} onDone={collection => { setPreparing(null); organizer.setYear(String(collection.yearStart)); organizer.setArchive('active'); organizer.setSelection(collection.id); organizer.reload(); onSpacesChanged?.(); toast(t('Nouvelle année préparée. Les ressources sont en brouillon.')) }} />}
    {draft && <form className="space-y-4 border-t border-line pt-4" onSubmit={event => void submit(event)}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-1 text-sm">{t('Nom du regroupement')}<input autoFocus required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2" /></label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">{t('Année de début')}<input type="number" min={1900} max={2200} value={draft.yearStart ?? ''} placeholder={t('Facultative')} onChange={e => setDraft({ ...draft, yearStart: e.target.value === '' ? null : Number(e.target.value) })} className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2" /></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.archived} onChange={e => setDraft({ ...draft, archived: e.target.checked })} />{t('Archiver ce regroupement')}</label>
      <fieldset className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">{t('Espaces à inclure')}</legend>{items.map(item => <label key={item.id} className="flex min-w-0 items-center gap-2 text-sm"><input type="checkbox" value={item.id} checked={draft.itemIds.includes(item.id)} onChange={e => setDraft({ ...draft, itemIds: e.target.checked ? [...draft.itemIds, item.id] : draft.itemIds.filter(id => id !== item.id) })} /><span className="min-w-0 break-words">{item.name}<span className="block text-xs text-ink-soft">{organizer.collections.filter(c => c.itemIds.includes(item.id)).map(c => (c.yearStart === null ? '' : c.yearStart + '-' + (c.yearStart + 1) + ' · ') + c.name).join(', ')}</span></span></label>)}</fieldset>
      <p className="text-xs text-ink-soft">{t('Ce classement vous est personnel. Il ne modifie ni les membres ni les permissions.')}</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" variant="primary" loading={pending}>{t('Enregistrer')}</Button><Button disabled={pending} onClick={() => setDraft(null)}>{t('Annuler')}</Button></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>}
    <ConfirmDialog open={deleting !== null} title={t('Supprimer ce regroupement ?')} message={t('Les classes, groupes et contenus seront conservés. Seul votre classement sera supprimé.')} confirmLabel={t('Supprimer')} onConfirm={() => void remove()} onCancel={() => setDeleting(null)} />
  </section>
}
