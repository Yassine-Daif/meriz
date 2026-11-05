import { periodLabel } from '../lib/collectionPeriod'
import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import type { ClassroomSummary } from '../lib/classroomsApi'
import {
  captureTeachingResource,
  listTeachingResources,
} from '../lib/teachingLibraryApi'
import type { TeachingResource } from '../lib/teachingLibraryApi'
import { fromLocalInput } from '../lib/assignmentsApi'
import { useCollections } from './useCollections'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './ui/toastContext'

export function TeachingLibraryPanel({
  client,
  classrooms,
}: {
  client: ApiClient
  classrooms: readonly ClassroomSummary[]
}) {
  useLanguage()
  const toast = useToast()
  const organizer = useCollections(client, 'classrooms')
  const [resources, setResources] = useState<TeachingResource[]>([]),
    [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState<TeachingResource | null>(null)
  const [targets, setTargets] = useState<string[]>([]),
    [publish, setPublish] = useState(false),
    [updateExisting, setUpdateExisting] = useState(false),
    [applySettings, setApplySettings] = useState(false),
    [dueAt, setDueAt] = useState('')
  const [pending, setPending] = useState(false),
    [revision, setRevision] = useState(0),
    [deleting, setDeleting] = useState<TeachingResource | null>(null)
  const reload = useCallback(() => setRevision((v) => v + 1), [])
  useEffect(() => {
    let active = true
    void listTeachingResources(client).then((result) => {
      if (!active) return
      if (result.ok) {
        setResources(result.value)
        setError(null)
      } else setError(result.error.message)
    })
    return () => {
      active = false
    }
  }, [client, revision])
  const owned = classrooms.filter((c) => c.myRole === 'teacher')
  const activeIds = organizer.filter(owned, '').map((c) => c.id)
  async function refresh(resource: TeachingResource) {
    if (pending) return
    setPending(true)
    try {
      const result = await captureTeachingResource(
        client,
        resource.kind,
        resource.sourceId,
        resource.id,
      )
      if (result.ok) {
        reload()
        toast(
          t(
            'Nouvelle version enregistrée dans la bibliothèque. Aucune classe n’a été modifiée.',
          ),
        )
      } else toast({ kind: 'error', text: result.error.message })
    } finally {
      setPending(false)
    }
  }
  async function distribute() {
    if (!selected || pending || targets.length === 0) return
    setPending(true)
    setError(null)
    try {
      const result = await client.request(
        'POST',
        '/teaching-resources/' +
          encodeURIComponent(selected.id) +
          '/distribution',
        {
          classroom_ids: targets,
          update_existing: updateExisting,
          publish,
          apply_settings: applySettings,
          due_at: fromLocalInput(dueAt),
        },
      )
      if (result.ok) {
        setSelected(null)
        reload()
        toast(
          t(
            'Diffusion terminée. Chaque classe conserve ses rendus et ses réglages.',
          ),
        )
      } else setError(result.error.message)
    } finally {
      setPending(false)
    }
  }
  async function remove() {
    if (!deleting || pending) return
    setPending(true)
    try {
      const result = await client.request(
        'DELETE',
        '/teaching-resources/' + encodeURIComponent(deleting.id),
      )
      if (result.ok) {
        setDeleting(null)
        reload()
        toast(
          t(
            'Ressource retirée de la bibliothèque. Les copies dans les classes sont conservées.',
          ),
        )
      } else toast({ kind: 'error', text: result.error.message })
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="font-semibold">{t('Bibliothèque pédagogique')}</h2>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-ink-soft">
          {t(
            'Ajoutez un cours ou un devoir depuis son écran d’édition, puis diffusez sa copie aux classes choisies. La bibliothèque conserve les médias même si la classe d’origine disparaît.',
          )}
        </p>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          {t('Rechercher une ressource')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
            <button type="button" onClick={reload} className="ml-2 underline">
              {t('Réessayer')}
            </button>
          </p>
        )}
        {resources.length === 0 && (
          <p className="text-sm text-ink-soft">
            {t('Votre bibliothèque est vide.')}
          </p>
        )}
        <ul className="space-y-3">
          {resources
            .filter((r) =>
              r.title
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase()),
            )
            .map((resource) => (
              <li
                key={resource.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line pb-3"
              >
                <div className="min-w-0 flex-1 basis-44">
                  <p className="break-words font-medium">{resource.title}</p>
                  <p className="text-xs text-ink-soft">
                    {t(resource.kind === 'lesson' ? 'Cours' : 'Devoir')} ·{' '}
                    {t('Version {0}', [resource.version])} ·{' '}
                    {t('Classes destinataires : {0}', [
                      resource.publications.length,
                    ])}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setSelected(resource)
                      setTargets([])
                      setPublish(false)
                      setUpdateExisting(false)
                      setApplySettings(false)
                      setDueAt('')
                      setError(null)
                    }}
                  >
                    {t('Diffuser')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => void refresh(resource)}
                  >
                    {t('Actualiser depuis l’original')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setDeleting(resource)}
                  >
                    {t('Supprimer')}
                  </Button>
                </div>
              </li>
            ))}
        </ul>
        {selected && (
          <section
            className="space-y-4 rounded-card border border-accent p-4"
            aria-label={t('Diffuser une ressource')}
          >
            <h3 className="break-words font-semibold">{selected.title}</h3>
            <div className="flex min-w-0 flex-wrap gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => setTargets(activeIds)}
              >
                {t('Toutes mes classes actives')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setTargets([])}
              >
                {t('Tout désélectionner')}
              </Button>
              <Select
                aria-label={t('Ajouter les classes d’un regroupement')}
                value=""
                disabled={pending}
                onValueChange={(id) => {
                  const c = organizer.collections.find((c) => c.id === id)
                  if (c)
                    setTargets((previous) =>
                      [...new Set([...previous, ...c.itemIds])].filter((id) =>
                        owned.some((item) => item.id === id),
                      ),
                    )
                }}
              >
                <option value="">{t('Ajouter un regroupement…')}</option>
                {organizer.collections
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.yearStart !== null ? periodLabel(c) + ' · ' : ''}
                      {c.name}
                    </option>
                  ))}
              </Select>
            </div>
            <fieldset
              disabled={pending}
              className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2"
            >
              <legend className="mb-2 text-sm">
                {t('Classes destinataires : {0}', [targets.length])}
              </legend>
              {owned.map((c) => (
                <label
                  key={c.id}
                  className="flex min-w-0 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={targets.includes(c.id)}
                    onChange={(e) =>
                      setTargets((previous) =>
                        e.target.checked
                          ? [...new Set([...previous, c.id])]
                          : previous.filter((id) => id !== c.id),
                      )
                    }
                  />
                  <span className="min-w-0 break-words">
                    {c.name}
                    <span className="block text-xs text-ink-soft">
                      {organizer.collections
                        .filter((collection) =>
                          collection.itemIds.includes(c.id),
                        )
                        .map(
                          (collection) =>
                            (collection.yearStart === null
                              ? ''
                              : periodLabel(collection) + ' · ') +
                            collection.name,
                        )
                        .join(', ')}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publish}
                disabled={pending}
                onChange={(e) => setPublish(e.target.checked)}
              />
              {t('Publier immédiatement les nouvelles copies')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={updateExisting}
                disabled={pending}
                onChange={(e) => setUpdateExisting(e.target.checked)}
              />
              {t('Appliquer cette version aux copies déjà diffusées')}
            </label>
            {selected.kind === 'assignment' && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={pending || !updateExisting}
                    checked={applySettings}
                    onChange={(e) => setApplySettings(e.target.checked)}
                  />
                  {t('Remplacer aussi leurs restrictions d’interface')}
                </label>
                <label className="flex max-w-sm flex-col gap-1 text-sm">
                  {t('Échéance des nouvelles copies')}
                  <input
                    type="datetime-local"
                    disabled={pending}
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"
                  />
                </label>
              </>
            )}
            <p className="text-xs text-ink-soft">
              {t(
                'Les copies existantes gardent leurs échéances, rendus et notes. Un corrigé remplacé est retenu jusqu’à une nouvelle décision de publication du corrigé.',
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={targets.length === 0}
                loading={pending}
                onClick={() => void distribute()}
              >
                {t('Confirmer la diffusion vers {0} classe(s)', [
                  targets.length,
                ])}
              </Button>
              <Button disabled={pending} onClick={() => setSelected(null)}>
                {t('Annuler')}
              </Button>
            </div>
          </section>
        )}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title={t('Supprimer cette ressource de la bibliothèque ?')}
        message={t(
          'Les copies déjà diffusées dans les classes seront conservées.',
        )}
        confirmLabel={t('Supprimer')}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}
