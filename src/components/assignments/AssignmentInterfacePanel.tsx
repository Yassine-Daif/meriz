import { useEffect, useState } from 'react'
import { useSession } from '../sessionContext'
import type { ApiClient } from '../../lib/apiClient'
import { updateAssignment } from '../../lib/assignmentsApi'
import type { Assignment } from '../../lib/assignmentsApi'
import { INTERFACE_PRESETS, WORK_VIEWS } from '../../lib/assignmentInterface'
import type { InterfaceMode } from '../../lib/interfaceMode'
import type { AssignmentInterface } from '../../lib/assignmentInterface'
import { t } from '../../i18n/runtime'
import { useLanguage } from '../../lib/useLanguage'
import { VIEWS } from '../views'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import type { OpenReadOnlyModel } from './types'

// Brouillons d'interface en mémoire, isolés par compte et devoir pendant l'aperçu.
const previewDrafts = new Map<string, { settings: AssignmentInterface | null; mode: InterfaceMode }>()

export function AssignmentInterfacePanel({ client, assignment, onSaved, onPreview }: { client: ApiClient; assignment: Assignment; onSaved: (assignment: Assignment) => void; onPreview: OpenReadOnlyModel }) {
  useLanguage()
  const { session } = useSession()
  const draftKey = (session.status === 'signed-in' ? session.user.id : 'local') + ':' + assignment.id
  const [settings, setSettings] = useState<AssignmentInterface | null>(() => { const draft = previewDrafts.get(draftKey); return draft ? draft.settings : assignment.interfaceSettings ?? null })
  useEffect(() => { previewDrafts.delete(draftKey) }, [draftKey])
  const [previewMode, setPreviewMode] = useState<InterfaceMode>(() => previewDrafts.get(draftKey)?.mode ?? 'beginner')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const value = settings ?? INTERFACE_PRESETS.complete!
  const preset = settings === null ? 'personal' : Object.keys(INTERFACE_PRESETS).find(key => JSON.stringify(INTERFACE_PRESETS[key]) === JSON.stringify(settings)) ?? 'custom'
  const change = (next: AssignmentInterface | null) => { setSettings(next); setSaved(false) }
  const save = async () => {
    if (pending) return
    setPending(true); setError(null); setSaved(false)
    try {
      const result = await updateAssignment(client, assignment.id, { interfaceSettings: settings })
      if (result.ok) { onSaved(result.value); setSaved(true) } else { setError(result.error.message) }
    } finally { setPending(false) }
  }
  const preview = () => {
    if (previewDrafts.size >= 100) previewDrafts.clear()
    previewDrafts.set(draftKey, { settings: settings ? structuredClone(settings) : null, mode: previewMode })
    onPreview({ classroomId: assignment.classroomId, assignmentId: assignment.id, submissionId: null, key: assignment.id + ':interface-preview', name: assignment.title, label: t('Prévisualisation élève'), content: assignment.baseContent ?? '{}', interfacePreview: settings, interfacePreviewMode: previewMode })
  }
  return <section className="max-w-3xl space-y-5">
    <h4 className="text-lg font-semibold">{t('Paramétrage de l’interface de l’exercice')}</h4>
    <p className="text-sm text-ink-soft">{t('Choisissez les outils proposés aux élèves pour ce devoir. Vous pourrez les débloquer pendant la séance. Leurs modèles restent conservés.')}</p>
    <label className="flex max-w-md flex-col gap-2 text-sm">{t('Préréglage')}<Select disabled={pending} value={preset} onValueChange={key => { if (key !== 'custom') change(key === 'personal' ? null : structuredClone(INTERFACE_PRESETS[key]!)) }}>
      <option value="personal">{t('Respecter le choix personnel')}</option><option value="mcd">{t('Dictionnaire et MCD')}</option><option value="mld">{t('Dictionnaire, MCD et MLD')}</option><option value="complete">{t('Complet')}</option><option value="custom" disabled>{t('Personnalisé')}</option>
    </Select></label>
    <fieldset disabled={pending} className="grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2"><legend className="px-2 text-sm font-medium">{t('Vues disponibles')}</legend>
      {WORK_VIEWS.map(view => <label key={view} className="flex min-w-0 items-center gap-2 text-sm"><input type="checkbox" checked={value.views.includes(view)} disabled={value.views.length === 1 && value.views.includes(view)} onChange={event => change({ ...value, views: WORK_VIEWS.filter(v => v === view ? event.target.checked : value.views.includes(v)) })} />{VIEWS.find(v => v.id === view)!.label}</label>)}
    </fieldset>
    <fieldset disabled={pending} className="space-y-3"><legend className="mb-2 text-sm font-medium">{t('Exports disponibles')}</legend>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.export_image} onChange={e => change({ ...value, export_image: e.target.checked })} />{t('Exporter le MCD en image PNG')}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.export_model} onChange={e => change({ ...value, export_model: e.target.checked })} />{t('Enregistrer une copie en fichier')}</label>
    </fieldset>
    <p className="text-xs text-ink-soft">{t('Ces réglages encadrent les outils dans Meriz. Ils ne bloquent pas les logiciels extérieurs. Les exports SQL et code restent accessibles lorsque leurs vues sont autorisées.')}</p>
    <label className="flex max-w-sm flex-col gap-1 text-sm">{t('Niveau personnel à prévisualiser')}<Select value={previewMode} onValueChange={value => setPreviewMode(value === 'complete' ? 'complete' : 'beginner')}><option value="beginner">{t('Débutant')}</option><option value="complete">{t('Complet')}</option></Select></label>
    <div className="flex flex-wrap gap-3"><Button variant="primary" loading={pending} onClick={() => void save()}>{t('Enregistrer')}</Button><Button disabled={pending} onClick={preview}>{t('Prévisualiser l’interface élève')}</Button></div>
    <p className="text-xs text-ink-soft">{t('La prévisualisation est en lecture seule et utilise les réglages affichés, même avant leur enregistrement.')}</p>
    {saved && <p role="status" className="text-sm text-ink-soft">{t('Réglages enregistrés. Les élèves connectés les recevront sous quelques secondes.')}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </section>
}
