import { useEffect, useRef, useState } from 'react'
import type { Dispatch, DragEvent } from 'react'
import type { Mcd, Property } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'
import { findPlacement } from '../model/queries'
import { isIntegerType, parseSqlType } from '../model/sqlTypes'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/Button'
import { useToast } from './ui/toastContext'
import { SqlTypeControl } from './SqlTypeControl'
import { useSqlTypes } from './sqlTypesContext'

const DRAG_TYPE = 'application/x-meriz-property'
type Move = { propertyId: string; ownerId: string | null; beforeId?: string; sourceId: string | null }

/** Les groupes suivent les porteurs ; aucune copie de propriété ni tri implicite. */
export function DictionaryView({ mcd, dispatch, readOnly = false }: { mcd: Mcd; dispatch: Dispatch<McdAction>; readOnly?: boolean }) {
  const locale = useLanguage(), toast = useToast()
  const { settings, physicalType } = useSqlTypes()
  const [search, setSearch] = useState(''), [sort, setSort] = useState('placement')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<Move | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Property | null>(null)
  const previousIds = useRef(new Set(mcd.properties.map(p => p.id)))
  const adding = useRef(false)
  useEffect(() => {
    const added = mcd.properties.find(p => !previousIds.current.has(p.id))
    previousIds.current = new Set(mcd.properties.map(p => p.id))
    if (!added || !adding.current) return
    adding.current = false; setSearch(''); setSort('placement')
    const owner = findPlacement(mcd, added.id)?.owner.id ?? ''
    setCollapsed(value => { const next = new Set(value); next.delete(owner); return next })
    const frame = requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-property-id="${CSS.escape(added.id)}"] input[data-property-name]`)
      input?.scrollIntoView({ block: 'nearest' }); input?.focus(); input?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [mcd])
  const placed = new Set([...mcd.entities, ...mcd.associations].flatMap(o => o.attributes.map(a => a.propertyId)))
  const groups = [
    ...mcd.entities.map(owner => ({ id: owner.id, name: owner.name, kind: 'entity', properties: owner.attributes.flatMap(a => mcd.properties.filter(p => p.id === a.propertyId)) })),
    ...mcd.associations.map(owner => ({ id: owner.id, name: owner.name, kind: 'association', properties: owner.attributes.flatMap(a => mcd.properties.filter(p => p.id === a.propertyId)) })),
    { id: '', name: t('Propriétés non affectées'), kind: 'unplaced', properties: mcd.properties.filter(p => !placed.has(p.id)) },
  ]
  const add = (ownerId: string) => { adding.current = true; dispatch(ownerId ? { type: 'ADD_ATTRIBUTE', ownerId } : { type: 'ADD_PROPERTY' }) }
  const executeMove = (move: Move) => {
    if (readOnly) return
    const current = findPlacement(mcd, move.propertyId)?.owner.id ?? null
    if (current !== move.sourceId || (move.ownerId !== null && ![...mcd.entities, ...mcd.associations].some(owner => owner.id === move.ownerId))) { toast({ kind: 'error', text: t('Le placement a changé en direct. Recommencez le déplacement.') }); setPendingMove(null); return }
    dispatch({ type: 'MOVE_PROPERTY', propertyId: move.propertyId, ownerId: move.ownerId, beforeId: move.beforeId })
    setCollapsed(value => { const next = new Set(value); next.delete(move.ownerId ?? ''); return next })
    setPendingMove(null); toast(t('Propriété déplacée. Ctrl+Z permet d’annuler.'))
  }
  const requestMove = (propertyId: string, ownerId: string | null, beforeId?: string) => {
    if (readOnly || propertyId === beforeId || !mcd.properties.some(p => p.id === propertyId)) return
    const placement = findPlacement(mcd, propertyId), sourceId = placement?.owner.id ?? null
    if (sourceId === ownerId && !beforeId) return
    const move = { propertyId, ownerId, beforeId, sourceId }
    if (sourceId !== ownerId && placement?.owner.attributes.some(a => a.propertyId === propertyId && a.isIdentifier)) setPendingMove(move)
    else executeMove(move)
  }
  const acceptDrag = (event: DragEvent, id: string) => {
    if (readOnly || !event.dataTransfer.types.includes(DRAG_TYPE)) return
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(id)
  }
  const drop = (event: DragEvent, ownerId: string, beforeId?: string) => {
    if (readOnly || !event.dataTransfer.types.includes(DRAG_TYPE)) return
    event.preventDefault(); event.stopPropagation(); setDropTarget(null)
    requestMove(event.dataTransfer.getData(DRAG_TYPE), ownerId || null, beforeId)
  }
  const query = search.trim().toLocaleLowerCase(locale)
  return <section aria-label={t('Dictionnaire des données')} className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2">
      {!readOnly && <Button size="sm" onClick={() => add('')}>{t('Ajouter une propriété')}</Button>}
      <label className="flex min-w-0 basis-48 flex-1 items-center gap-2 text-xs">{t('Rechercher')}<input type="search" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2 py-1" /></label>
      <label className="flex min-w-0 items-center gap-2 text-xs">{t('Trier')}<select className="min-w-0 rounded-control border border-line-strong bg-surface px-2 py-1" value={sort} onChange={e => setSort(e.target.value)}><option value="placement">{t('Ordre du modèle')}</option><option value="name">{t('Nom')}</option><option value="type">{t('Type SQL')}</option></select></label>
      <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs">{t('Moteur SQL')}<select disabled={readOnly} value={settings.dialect} onChange={e => dispatch({ type: 'SET_DIALECT', dialect: e.target.value === 'postgresql' ? 'postgresql' : 'mysql' })} className="min-w-0 rounded-control border border-line-strong bg-surface px-2 py-1"><option value="mysql">MySQL</option><option value="postgresql">PostgreSQL</option></select></label>
    </div>
    <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-auto p-3 sm:p-4">
      {groups.map(group => {
        let properties = group.properties.filter(p => !query || group.name.toLocaleLowerCase(locale).includes(query) || p.name.toLocaleLowerCase(locale).includes(query))
        if (sort !== 'placement') properties = [...properties].sort((a, b) => (sort === 'name' ? a.name : physicalType(a.id, a.type, a.size)).localeCompare(sort === 'name' ? b.name : physicalType(b.id, b.type, b.size), locale))
        if (query && !properties.length) return null
        const closed = collapsed.has(group.id)
        return <section key={group.id} data-dictionary-group={group.id || 'unplaced'} onDragOver={e => acceptDrag(e, group.id)} onDrop={e => drop(e, group.id)} onDragLeave={e => { if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDropTarget(null) }}
          className={'min-w-0 rounded-card border bg-surface shadow-soft ' + (dropTarget === group.id ? 'border-accent-ink outline-2 outline-accent-ink' : 'border-line')}>
          <header className="flex min-w-0 flex-wrap items-center gap-2 rounded-t-card border-b border-line bg-shell px-3 py-2">
            <button type="button" aria-expanded={!closed} aria-controls={'dictionary-group-' + group.id} onClick={() => setCollapsed(value => { const next = new Set(value); if (closed) next.delete(group.id); else next.add(group.id); return next })} className="flex min-w-0 basis-full items-center gap-2 text-left font-semibold sm:basis-40 sm:flex-1 [overflow-wrap:anywhere]"><span aria-hidden="true">{closed ? '▸' : '▾'}</span><span className="min-w-0">{group.name}</span><span className="shrink-0 text-xs font-normal text-ink-soft">{group.properties.length}</span></button>
            <span className="text-xs text-ink-soft">{group.kind === 'entity' ? t('Entité') : group.kind === 'association' ? t('Association') : ''}</span>
            {!readOnly && <Button size="sm" variant="ghost" onClick={() => add(group.id)} aria-label={t('Ajouter une propriété dans {0}', [group.name])}>+ {t('Propriété')}</Button>}
          </header>
          {closed && <div id={'dictionary-group-' + group.id} hidden />}
          {!closed && <div id={'dictionary-group-' + group.id} className="min-w-0 divide-y divide-line">
            {!properties.length && <p className="p-3 text-sm text-ink-soft">{t('Aucune propriété dans ce groupe.')}</p>}
            {properties.map(property => {
              const placement = findPlacement(mcd, property.id), identifier = placement?.owner.attributes.some(a => a.propertyId === property.id && a.isIdentifier) ?? false
              const spec = parseSqlType(physicalType(property.id, property.type, property.size))
              return <div key={property.id} data-property-id={property.id} onDragOver={e => acceptDrag(e, group.id)} onDrop={e => drop(e, group.id, property.id)} className="grid min-w-0 gap-3 p-3 xl:grid-cols-[minmax(10rem,1fr)_minmax(15rem,1.4fr)_minmax(10rem,1fr)]">
                <div className="flex min-w-0 items-start gap-2">
                  {!readOnly && <button type="button" draggable aria-label={t('Déplacer {0}', [property.name])} title={t('Glisser vers un autre groupe')} className="shrink-0 cursor-grab rounded-control border border-line-strong px-2 py-1" onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, property.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDropTarget(null)}>⠿</button>}
                  <div className="min-w-0 flex-1"><input data-property-name disabled={readOnly} value={property.name} aria-label={t('Nom de la propriété {0}', [property.name])} onChange={e => dispatch({ type: 'UPDATE_PROPERTY', propertyId: property.id, patch: { name: e.target.value } })} className="w-full min-w-0 rounded-control border border-line-strong bg-surface px-2 py-1 font-mono text-sm" />
                    {placement?.kind === 'entity' && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" disabled={readOnly} checked={identifier} onChange={e => dispatch({ type: 'SET_ATTRIBUTE_IDENTIFIER', entityId: placement.owner.id, propertyId: property.id, isIdentifier: e.target.checked })} />{t('Identifiant')}</label>}
                  </div>
                </div>
                <div className="min-w-0"><SqlTypeControl property={property} />{identifier && spec && isIntegerType(spec.name) && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" disabled={readOnly || placement?.owner.attributes.filter(a => a.isIdentifier).length !== 1} checked={(placement?.owner.attributes.filter(a => a.isIdentifier).length === 1) && (settings.identity?.[property.id] ?? settings.overrides[property.id] === undefined)} onChange={e => dispatch({ type: 'SET_IDENTITY', propertyId: property.id, value: e.target.checked })} />{t('Auto-incrément')}</label>}</div>
                {!readOnly && <div className="flex min-w-0 items-start gap-2"><label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-soft">{t('Déplacer vers…')}<select className="w-full min-w-0 rounded-control border border-line-strong bg-surface px-2 py-1 text-ink" value={group.id} onChange={e => requestMove(property.id, e.target.value || null)}>{groups.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label><button type="button" className="mt-5 shrink-0 rounded-control border border-line-strong px-2 py-1 hover:bg-danger-soft" aria-label={t('Supprimer la propriété {0} du dictionnaire', [property.name])} onClick={() => { if (placement) setPendingDelete(property); else dispatch({ type: 'DELETE_PROPERTY', propertyId: property.id }) }}>×</button></div>}
              </div>
            })}
          </div>}
        </section>
      })}
      {query && !groups.some(g => g.name.toLocaleLowerCase(locale).includes(query) || g.properties.some(p => p.name.toLocaleLowerCase(locale).includes(query))) && <p className="text-sm text-ink-soft">{t('Aucun résultat.')}</p>}
    </div>
    <ConfirmDialog open={!!pendingMove} title={t('Déplacer un identifiant')} message={t('Cette propriété participe à un identifiant. Son déplacement peut modifier les clés étrangères. Vers une association ou les propriétés non affectées, elle perdra ce rôle. Vérifiez ensuite le rapport.')} confirmLabel={t('Déplacer')} onCancel={() => setPendingMove(null)} onConfirm={() => { if (pendingMove) executeMove(pendingMove) }} />
    <ConfirmDialog open={!!pendingDelete} title={t('Propriété utilisée dans le MCD')} message={t('Retirer cette propriété du modèle et du dictionnaire ? Ctrl+Z permet d’annuler.')} confirmLabel={t('Oui, supprimer')} onCancel={() => setPendingDelete(null)} onConfirm={() => { if (!readOnly && pendingDelete) dispatch({ type: 'DELETE_PROPERTY', propertyId: pendingDelete.id }); setPendingDelete(null) }} />
  </section>
}
