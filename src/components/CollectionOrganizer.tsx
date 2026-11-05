import { MoveCollectionDialog } from './MoveCollectionDialog'
import { useState } from 'react'
import type { FormEvent, DragEvent } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { saveCollection, saveCollectionSettings } from '../lib/collectionsApi'
import type {
  CollectionDraft,
  CollectionKind,
  WorkspaceCollection,
} from '../lib/collectionsApi'
import { periodLabel, currentAcademicYear } from '../lib/collectionPeriod'
import type { useCollections } from './useCollections'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { useToast } from './ui/toastContext'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ConfirmDialog'
import { CollectionPeriodField } from './CollectionPeriodField'
import { PrepareAcademicYearPanel } from './PrepareAcademicYearPanel'

type Move = { itemId: string; fromId: string | null; toId: string | null }
export function CollectionOrganizer({
  client,
  kind,
  organizer,
  items,
  onSpacesChanged,
  onOpen,
}: {
  client: ApiClient
  kind: CollectionKind
  organizer: ReturnType<typeof useCollections>
  items: readonly { id: string; name: string }[]
  onSpacesChanged?: () => void
  onOpen: (id: string) => void
}) {
  useLanguage()
  const toast = useToast()
  const [selectedId, updateSelectedId] = useState(
      organizer.selection === 'all' ? 'unassigned' : organizer.selection,
    ),
    [query, setQuery] = useState(''),
    [spaceQuery, setSpaceQuery] = useState(''),
    [showArchived, setShowArchived] = useState(
      organizer.collections.find((c) => c.id === organizer.selection)
        ?.archived ?? false,
    )
  const [draft, setDraft] = useState<CollectionDraft | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [draftSearch, setDraftSearch] = useState('')
  const [preparing, setPreparing] = useState<WorkspaceCollection | null>(null)
  const [confirm, setConfirm] = useState<{
    collection: WorkspaceCollection
    action: 'archive' | 'delete'
  } | null>(null)
  const [moveDialog, setMoveDialog] = useState<{
      itemId: string
      fromId: string | null
    } | null>(null),
    [destination, setDestination] = useState('unassigned')
  const [dragging, setDragging] = useState<{
      itemId: string
      fromId: string | null
    } | null>(null),
    [over, setOver] = useState<string | null>(null),
    [undo, setUndo] = useState<Move | null>(null)
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null)
  const setSelectedId = (id: string) => {
    updateSelectedId(id)
    organizer.setSelection(id)
    organizer.setYear('all')
    organizer.setArchive(
      organizer.collections.find((c) => c.id === id)?.archived
        ? 'archived'
        : 'active',
    )
  }
  const selected = organizer.collections.find((c) => c.id === selectedId)
  const grouped = new Set(organizer.collections.flatMap((c) => c.itemIds))
  const members = items.filter(
    (item) =>
      (selected ? selected.itemIds.includes(item.id) : !grouped.has(item.id)) &&
      item.name
        .toLocaleLowerCase()
        .includes(spaceQuery.trim().toLocaleLowerCase()),
  )
  const collections = organizer.collections.filter(
    (c) =>
      c.archived === showArchived &&
      [c.name, periodLabel(c)]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  )
  const title = (c: WorkspaceCollection) =>
    [periodLabel(c), c.name].filter(Boolean).join(' · ')
  const choose = (id: string) => {
    setSelectedId(id)
    setSpaceQuery('')
    setDraft(null)
    setPreparing(null)
    setError(null)
  }
  const start = (c: WorkspaceCollection | null) => {
    setEditing(c?.id ?? null)
    setDraftSearch('')
    setError(null)
    setPreparing(null)
    setDraft(
      c
        ? { ...c, itemIds: [...c.itemIds] }
        : {
            name: '',
            kind,
            yearStart: kind === 'classrooms' ? currentAcademicYear() : null,
            periodKind: 'academic',
            archived: false,
            itemIds: [],
          },
    )
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft || pending) return
    setPending(true)
    setError(null)
    try {
      const result = editing
        ? await saveCollectionSettings(client, editing, {
            name: draft.name.trim(),
            year_start: draft.yearStart,
            period_kind: draft.periodKind ?? 'academic',
          })
        : await saveCollection(client, null, {
            ...draft,
            name: draft.name.trim(),
          })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      await organizer.refresh()
      organizer.reload()
      setDraft(null)
      setSelectedId(result.value.id)
      setShowArchived(result.value.archived)
      setQuery('')
      setSpaceQuery('')
      toast(t('Regroupement enregistré.'))
    } finally {
      setPending(false)
    }
  }
  async function applyMove(move: Move, remember = true) {
    if (pending || move.fromId === move.toId) return
    setPending(true)
    setError(null)
    try {
      const result = await client.request('POST', '/collections/move', {
        kind,
        item_id: move.itemId,
        from_id: move.fromId,
        to_id: move.toId,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      await organizer.refresh()
      organizer.reload()
      if (remember) setUndo(move)
      else setUndo(null)
      toast(
        t('Espace déplacé. Les documents et les participants sont conservés.'),
      )
      setMoveDialog(null)
    } finally {
      setPending(false)
      setDragging(null)
      setOver(null)
    }
  }
  function drop(event: DragEvent, id: string | null) {
    event.preventDefault()
    if (dragging && !pending) void applyMove({ ...dragging, toId: id })
    setOver(null)
  }
  async function confirmAction() {
    if (!confirm || pending) return
    setPending(true)
    setError(null)
    try {
      const c = confirm.collection
      const result =
        confirm.action === 'delete'
          ? await client.request(
              'DELETE',
              '/collections/' + encodeURIComponent(c.id),
            )
          : await saveCollectionSettings(client, c.id, {
              archived: !c.archived,
            })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      await organizer.refresh()
      organizer.reload()
      setConfirm(null)
      if (confirm.action === 'delete') {
        choose('unassigned')
      } else {
        setShowArchived(!c.archived)
        setSelectedId(c.id)
        organizer.setArchive(c.archived ? 'active' : 'archived')
      }
      toast(
        confirm.action === 'delete'
          ? t(
              'Regroupement supprimé. Les espaces et leurs contenus sont conservés.',
            )
          : c.archived
            ? t('Regroupement restauré.')
            : t(
                'Regroupement archivé. Les espaces restent accessibles dans les archives.',
              ),
      )
    } finally {
      setPending(false)
    }
  }
  const targetProps = (id: string | null) => ({
    onDragOver: (event: DragEvent) => {
      if (dragging && !pending && dragging.fromId !== id) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(id ?? 'unassigned')
      }
    },
    onDragLeave: () => setOver(null),
    onDrop: (event: DragEvent) => drop(event, id),
  })
  return (
    <section aria-label={t('Gestion des regroupements')} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {t('Organiser mes espaces')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            {t(
              'Déplacez vos espaces entre les regroupements, ou utilisez le bouton Déplacer. Ce classement ne change pas les accès.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={pending || !undo}
            onClick={() => {
              if (undo)
                void applyMove(
                  { itemId: undo.itemId, fromId: undo.toId, toId: undo.fromId },
                  false,
                )
            }}
          >
            {t('Annuler le déplacement')}
          </Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => start(null)}
          >
            {t('Créer un regroupement')}
          </Button>
        </div>
      </div>
      {(error || organizer.error) && (
        <p
          role="alert"
          className="rounded-control border border-danger p-3 text-sm text-danger"
        >
          {error ?? organizer.error}
          <Button
            size="sm"
            onClick={() => {
              setError(null)
              organizer.reload()
            }}
          >
            {t('Actualiser')}
          </Button>
        </p>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
        <aside
          className="min-w-0 space-y-3 rounded-card border border-line bg-surface p-3"
          aria-label={t('Liste des regroupements')}
        >
          <label className="flex flex-col gap-1 text-xs">
            {t('Rechercher un regroupement')}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={!showArchived ? 'soft' : 'ghost'}
              onClick={() => {
                setShowArchived(false)
                choose(
                  organizer.collections.find((c) => !c.archived)?.id ??
                    'unassigned',
                )
              }}
            >
              {t('Actifs')}
            </Button>
            <Button
              size="sm"
              variant={showArchived ? 'soft' : 'ghost'}
              onClick={() => {
                setShowArchived(true)
                choose(
                  organizer.collections.find((c) => c.archived)?.id ??
                    'unassigned',
                )
              }}
            >
              {t('Archives')}
              {' (' +
                organizer.collections.filter((c) => c.archived).length +
                ')'}
            </Button>
          </div>
          <nav
            aria-label={t('Choisir un regroupement')}
            className="max-h-96 space-y-1 overflow-y-auto"
          >
            {!showArchived && (
              <button
                type="button"
                {...targetProps(null)}
                disabled={pending}
                aria-current={selectedId === 'unassigned' ? 'true' : undefined}
                onClick={() => choose('unassigned')}
                className={
                  'flex w-full items-center justify-between gap-2 rounded-control border p-3 text-left text-sm ' +
                  (selectedId === 'unassigned' || over === 'unassigned'
                    ? 'border-mark bg-accent-soft'
                    : 'border-transparent hover:bg-surface-soft')
                }
              >
                <span>{t('Sans regroupement')}</span>
                <span className="shrink-0 text-xs">
                  {items.filter((i) => !grouped.has(i.id)).length}
                </span>
              </button>
            )}
            {collections.map((c) => (
              <button
                type="button"
                key={c.id}
                {...(!c.archived ? targetProps(c.id) : {})}
                disabled={pending}
                onClick={() => choose(c.id)}
                aria-current={selectedId === c.id ? 'true' : undefined}
                className={
                  'flex w-full items-center justify-between gap-2 rounded-control border p-3 text-left text-sm ' +
                  (selectedId === c.id || over === c.id
                    ? 'border-mark bg-accent-soft'
                    : 'border-transparent hover:bg-surface-soft')
                }
              >
                <span className="min-w-0 break-words">
                  <span className="block font-medium">{c.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {periodLabel(c) || t('Sans période')}
                  </span>
                </span>
                <span className="shrink-0 text-xs">
                  {items.filter((i) => c.itemIds.includes(i.id)).length}
                </span>
              </button>
            ))}
            {collections.length === 0 && (
              <p className="px-3 py-2 text-xs text-ink-soft">
                {showArchived
                  ? t('Aucun regroupement archivé.')
                  : t('Aucun regroupement correspondant.')}
              </p>
            )}
          </nav>
        </aside>
        <div className="min-w-0 space-y-4">
          {draft ? (
            <form
              onSubmit={(event) => void submit(event)}
              className="space-y-4 rounded-card border border-line bg-surface p-4"
            >
              <h3 className="font-semibold">
                {editing
                  ? t('Modifier le regroupement')
                  : t('Créer un regroupement')}
              </h3>
              <label className="flex flex-col gap-1 text-sm">
                {t('Nom du regroupement')}
                <input
                  autoFocus
                  required
                  maxLength={100}
                  disabled={pending}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"
                />
              </label>
              <CollectionPeriodField
                disabled={pending}
                year={draft.yearStart}
                kind={draft.periodKind ?? 'academic'}
                onChange={(yearStart, periodKind) =>
                  setDraft({ ...draft, yearStart, periodKind })
                }
              />
              {!editing && (
                <fieldset disabled={pending} className="space-y-2">
                  <legend className="text-sm font-medium">
                    {t('Espaces à inclure')}
                  </legend>
                  <input
                    type="search"
                    value={draftSearch}
                    aria-label={t('Rechercher un espace')}
                    placeholder={t('Rechercher un espace')}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    className="w-full min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"
                  />
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {items
                      .filter((i) =>
                        i.name
                          .toLocaleLowerCase()
                          .includes(draftSearch.toLocaleLowerCase()),
                      )
                      .map((item) => (
                        <label
                          key={item.id}
                          className="flex min-w-0 items-center gap-2 rounded-control px-2 py-2 text-sm hover:bg-surface-soft"
                        >
                          <input
                            type="checkbox"
                            checked={draft.itemIds.includes(item.id)}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                itemIds: e.target.checked
                                  ? [...draft.itemIds, item.id]
                                  : draft.itemIds.filter(
                                      (id) => id !== item.id,
                                    ),
                              })
                            }
                          />
                          <span className="min-w-0 break-words">
                            {item.name}
                            <span className="block text-xs text-ink-soft">
                              {organizer.collections
                                .filter((c) => c.itemIds.includes(item.id))
                                .map(title)
                                .join(', ')}
                            </span>
                          </span>
                        </label>
                      ))}
                    {items.length === 0 && (
                      <p className="text-sm text-ink-soft">
                        {t('Vous pourrez ajouter des espaces plus tard.')}
                      </p>
                    )}
                  </div>
                </fieldset>
              )}
              <p className="text-xs text-ink-soft">
                {t(
                  'Ce classement vous est personnel. Il ne modifie ni les membres ni les permissions.',
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" loading={pending}>
                  {t('Enregistrer')}
                </Button>
                <Button disabled={pending} onClick={() => setDraft(null)}>
                  {t('Annuler')}
                </Button>
              </div>
            </form>
          ) : preparing ? (
            <div className="rounded-card border border-line bg-surface p-4">
              <PrepareAcademicYearPanel
                client={client}
                source={preparing}
                onCancel={() => setPreparing(null)}
                onDone={(c) => {
                  setPreparing(null)
                  setSelectedId(c.id)
                  setShowArchived(false)
                  setQuery('')
                  organizer.reload()
                  onSpacesChanged?.()
                  toast(
                    t(
                      'Nouvelle année préparée. Les ressources sont en brouillon.',
                    ),
                  )
                }}
              />
            </div>
          ) : showArchived && !selected ? (
            <p className="rounded-card border border-line bg-surface p-6 text-sm text-ink-soft">
              {t('Aucun regroupement archivé.')}
            </p>
          ) : (
            <section
              className="min-w-0 rounded-card border border-line bg-surface p-4"
              {...targetProps(selected?.id ?? null)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold">
                    {selected ? selected.name : t('Sans regroupement')}
                  </h3>
                  {selected && (
                    <p className="mt-1 text-xs text-ink-soft">
                      {periodLabel(selected) || t('Sans période')}
                      {selected.archived ? ' · ' + t('Archivé') : ''}
                    </p>
                  )}
                </div>
                {selected && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => start(selected)}
                    >
                      {t('Paramètres')}
                    </Button>
                    {kind === 'classrooms' && !selected.archived && (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => setPreparing(selected)}
                      >
                        {t('Préparer une nouvelle année')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        setConfirm({ collection: selected, action: 'archive' })
                      }
                    >
                      {selected.archived ? t('Restaurer') : t('Archiver')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        setConfirm({ collection: selected, action: 'delete' })
                      }
                    >
                      {t('Supprimer')}
                    </Button>
                  </div>
                )}
              </div>
              <label className="mt-4 flex flex-col gap-1 text-xs">
                {t('Rechercher un espace')}
                <input
                  type="search"
                  value={spaceQuery}
                  onChange={(e) => setSpaceQuery(e.target.value)}
                  className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"
                />
              </label>
              <ul className="mt-3 divide-y divide-line">
                {members.map((item) => (
                  <li
                    key={item.id}
                    draggable={!pending}
                    onDragStart={(event) => {
                      if (pending) return
                      const payload = {
                        itemId: item.id,
                        fromId: selected?.id ?? null,
                      }
                      setDragging(payload)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', item.id)
                    }}
                    onDragEnd={() => {
                      setDragging(null)
                      setOver(null)
                    }}
                    className="flex min-w-0 flex-wrap items-center gap-2 py-3"
                  >
                    <span
                      aria-hidden="true"
                      className="cursor-grab select-none px-1 text-ink-soft"
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpen(item.id)}
                      className="min-w-0 flex-1 basis-32 break-words text-left text-sm font-medium text-accent-ink underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </button>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setMoveDialog({
                          itemId: item.id,
                          fromId: selected?.id ?? null,
                        })
                        setDestination('')
                      }}
                    >
                      {t('Déplacer')}
                    </Button>
                  </li>
                ))}
              </ul>
              {members.length === 0 && (
                <p className="rounded-control border border-dashed border-line-strong px-3 py-8 text-center text-sm text-ink-soft">
                  {spaceQuery
                    ? t('Aucun espace correspondant.')
                    : t(
                        'Aucun espace ici. Déposez un espace depuis un autre regroupement.',
                      )}
                </p>
              )}
              <p className="mt-3 text-xs text-ink-soft">
                {t(
                  'Un déplacement retire uniquement le classement de départ. Les autres classements sont conservés.',
                )}
              </p>
            </section>
          )}
        </div>
      </div>
      {moveDialog && (
        <MoveCollectionDialog
          name={items.find((i) => i.id === moveDialog.itemId)?.name ?? ''}
          destination={destination}
          pending={pending}
          error={error}
          onDestination={setDestination}
          onCancel={() => setMoveDialog(null)}
          onConfirm={() =>
            void applyMove({
              ...moveDialog,
              toId: destination === 'unassigned' ? null : destination,
            })
          }
          options={[
            ...(moveDialog.fromId !== null
              ? [{ id: 'unassigned', name: t('Retirer de ce regroupement') }]
              : []),
            ...organizer.collections
              .filter((c) => !c.archived && c.id !== moveDialog.fromId)
              .map((c) => ({ id: c.id, name: title(c) })),
          ]}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.action === 'delete'
            ? t('Supprimer ce regroupement ?')
            : confirm?.collection.archived
              ? t('Restaurer ce regroupement ?')
              : t('Archiver ce regroupement ?')
        }
        message={
          confirm?.action === 'delete'
            ? t(
                'Les classes, groupes et contenus seront conservés. Seul votre classement sera supprimé.',
              )
            : t(
                'Les espaces et leurs contenus sont conservés. Les archives restent accessibles depuis leur onglet.',
              )
        }
        confirmLabel={
          confirm?.action === 'delete'
            ? t('Supprimer')
            : confirm?.collection.archived
              ? t('Restaurer')
              : t('Archiver')
        }
        onConfirm={() => void confirmAction()}
        onCancel={() => {
          if (!pending) setConfirm(null)
        }}
      />
    </section>
  )
}
