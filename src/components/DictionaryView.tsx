import { Select } from './ui/Select'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { Dispatch, DragEvent } from 'react'
import type { Mcd, Property } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'
import { findPlacement } from '../model/queries'
import { isIntegerType, parseSqlType } from '../model/sqlTypes'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Segmented } from './ui/Segmented'
import { useToast } from './ui/toastContext'
import { SqlTypeControl } from './SqlTypeControl'
import { useSqlTypes } from './sqlTypesContext'

const DRAG_TYPE = 'application/x-meriz-property'
type DictionaryTab = 'tables' | 'associations' | 'unplaced'
type Move = { propertyId: string; ownerId: string | null; beforeId?: string; sourceId: string | null }
const cell = 'min-w-0 lg:px-3 lg:py-1.5 lg:align-middle'
const control = 'min-h-8 min-w-0 max-w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-line-strong focus:border-line-strong'

/** Tableau compact : les porteurs restent distincts et le document partagé reste inchangé. */
export function DictionaryView({ mcd, dispatch, readOnly = false }: { mcd: Mcd; dispatch: Dispatch<McdAction>; readOnly?: boolean }) {
  const locale = useLanguage(), toast = useToast()
  const { settings, physicalType } = useSqlTypes()
  const [tab, setTab] = useState<DictionaryTab>('tables')
  const [search, setSearch] = useState(''), [sort, setSort] = useState('placement')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<Move | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Property | null>(null)
  const [pendingTable, setPendingTable] = useState<string | null>(null)
  const previousIds = useRef(new Set(mcd.properties.map(p => p.id)))
  const adding = useRef(false)
  const ownerTab = (ownerId: string | null): DictionaryTab => !ownerId ? 'unplaced' : mcd.entities.some(e => e.id === ownerId) ? 'tables' : 'associations'
  useEffect(() => {
    const added = mcd.properties.find(p => !previousIds.current.has(p.id))
    previousIds.current = new Set(mcd.properties.map(p => p.id))
    if (!added || !adding.current) return
    adding.current = false; setSearch(''); setSort('placement')
    const owner = findPlacement(mcd, added.id)?.owner.id ?? ''
    setCollapsed(value => { const next = new Set(value); next.delete(owner); return next })
    const frame = requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>('[data-property-id="' + CSS.escape(added.id) + '"] input[data-property-name]')
      input?.scrollIntoView({ block: 'nearest' }); input?.focus(); input?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [mcd])
  const placed = new Set([...mcd.entities, ...mcd.associations].flatMap(o => o.attributes.map(a => a.propertyId)))
  const groups = [
    ...mcd.entities.map(owner => ({ id: owner.id, name: owner.name, kind: 'tables' as const, properties: owner.attributes.flatMap(a => mcd.properties.filter(p => p.id === a.propertyId)) })),
    ...mcd.associations.map(owner => ({ id: owner.id, name: owner.name, kind: 'associations' as const, properties: owner.attributes.flatMap(a => mcd.properties.filter(p => p.id === a.propertyId)) })),
    { id: '', name: t('Propriétés non affectées'), kind: 'unplaced' as const, properties: mcd.properties.filter(p => !placed.has(p.id)) },
  ]
  const add = (ownerId: string) => { adding.current = true; setTab(ownerTab(ownerId)); dispatch(ownerId ? { type: 'ADD_ATTRIBUTE', ownerId } : { type: 'ADD_PROPERTY' }) }
  const executeMove = (move: Move) => {
    if (readOnly) return
    const current = findPlacement(mcd, move.propertyId)?.owner.id ?? null
    if (current !== move.sourceId || (move.ownerId !== null && ![...mcd.entities, ...mcd.associations].some(owner => owner.id === move.ownerId))) {
      toast({ kind: 'error', text: t('Le placement a changé en direct. Recommencez le déplacement.') }); setPendingMove(null); return
    }
    dispatch({ type: 'MOVE_PROPERTY', propertyId: move.propertyId, ownerId: move.ownerId, beforeId: move.beforeId })
    setTab(ownerTab(move.ownerId))
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
  const visibleGroups = groups.filter(g => g.kind === tab && (tab !== 'associations' || g.properties.length > 0)).flatMap(group => {
    let properties = group.properties.filter(p => !query || group.name.toLocaleLowerCase(locale).includes(query) || p.name.toLocaleLowerCase(locale).includes(query))
    if (sort !== 'placement') properties = [...properties].sort((a, b) => (sort === 'name' ? a.name : physicalType(a.id, a.type, a.size)).localeCompare(sort === 'name' ? b.name : physicalType(b.id, b.type, b.size), locale))
    return query && !properties.length ? [] : [{ ...group, properties }]
  })
  const tableToDelete = mcd.entities.find(e => e.id === pendingTable)
  const deleteTable = (withProperties: boolean) => {
    if (!readOnly && tableToDelete) {
      dispatch(withProperties ? { type: 'DELETE_DICTIONARY_TABLE', id: tableToDelete.id } : { type: 'DELETE_ENTITY', id: tableToDelete.id })
      toast(t('Table supprimée. Ctrl+Z permet d’annuler.'))
    }
    setPendingTable(null)
  }
  return <section aria-label={t('Dictionnaire des données')} className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2">
      <Segmented<DictionaryTab> legend={t('Contenu du dictionnaire')} hideLegend size="sm" value={tab} onChange={setTab}
        options={[{ value: 'tables', label: t('Tables') + ' (' + mcd.entities.length + ')' }, { value: 'associations', label: t('Associations') + ' (' + mcd.associations.filter(a => a.attributes.length).length + ')' }, { value: 'unplaced', label: t('Non affectées') + ' (' + groups[groups.length - 1]!.properties.length + ')' }]} />
      {!readOnly && <Button size="sm" variant="ghost" onClick={() => add('')}><Icon name="plus" size={15} />{t('Ajouter une propriété')}</Button>}
    </div>
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2">
      <label className="flex min-w-0 max-w-sm basis-48 flex-1 items-center gap-2 text-xs">{t('Rechercher')}<input type="search" value={search} onChange={e => setSearch(e.target.value)} className="min-h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-1" /></label>
      <label className="flex min-w-0 items-center gap-2 text-xs">{t('Trier')}<Select className={control + ' border-line-strong bg-surface'} value={sort} onValueChange={value => setSort(value)}><option value="placement">{t('Ordre du modèle')}</option><option value="name">{t('Nom')}</option><option value="type">{t('Type SQL')}</option></Select></label>
      <label className="flex min-w-0 items-center gap-2 text-xs lg:ml-auto">{t('Moteur SQL')}<Select disabled={readOnly} value={settings.dialect} onValueChange={value => dispatch({ type: 'SET_DIALECT', dialect: value === 'postgresql' ? 'postgresql' : 'mysql' })} className={control + ' border-line-strong bg-surface'}><option value="mysql">MySQL</option><option value="postgresql">PostgreSQL</option></Select></label>
    </div>
    <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4" data-dictionary-scroll>
      {tab === 'associations' && <p className="mb-3 text-xs leading-relaxed text-ink-soft">{t('Propriétés portées par les associations. Les associations sans propriété et leurs liaisons restent dans le MCD.')}</p>}
      {visibleGroups.length === 0 ? <p className="p-3 text-sm text-ink-soft">{query ? t('Aucun résultat.') : tab === 'associations' ? t('Aucune propriété portée par une association.') : t('Aucune table. Ajoutez une entité dans le MCD.')}</p> :
      <table className="block w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border border-line bg-surface text-sm lg:table">
        <caption className="sr-only">{t('Propriétés regroupées par porteur, types SQL, paramètres, clés et placement.')}</caption>
        <colgroup className="hidden lg:table-column-group"><col className="w-[24%]" /><col className="w-[20%]" /><col className="w-[23%]" /><col className="w-[12%]" /><col className="w-[17%]" /><col className="w-[4%]" /></colgroup>
        <thead className="hidden lg:table-header-group"><tr>{['Propriété', 'Type SQL', 'Paramètres', 'Clé', 'Placement', 'Actions'].map(label => <th key={label} scope="col" className={'border-b border-line bg-shell px-3 py-2 text-left text-xs font-medium text-ink-soft ' + (label === 'Actions' ? 'px-1' : '')}><span className={label === 'Actions' ? 'sr-only' : ''}>{t(label)}</span></th>)}</tr></thead>
        {visibleGroups.map(group => {
          const closed = !query && collapsed.has(group.id)
          return <Fragment key={group.id}>
            <tbody className="block lg:table-row-group" data-dictionary-group={group.id || 'unplaced'}
              onDragOver={e => acceptDrag(e, group.id)} onDrop={e => drop(e, group.id)}
              onDragLeave={e => { if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDropTarget(null) }}>
              <tr className="block lg:table-row" data-group-header><th colSpan={6} scope="rowgroup" className={'block border-b border-line bg-shell px-3 py-1.5 text-left lg:table-cell ' + (dropTarget === group.id ? 'ring-2 ring-inset ring-accent-ink' : '')}>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <button type="button" aria-expanded={!closed} aria-label={t('Afficher les propriétés de {0}', [group.name])}
                    onClick={() => setCollapsed(value => { const next = new Set(value); if (closed) next.delete(group.id); else next.add(group.id); return next })}
                    className="flex min-h-8 min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold">
                    <span className="w-3 shrink-0 text-xs text-ink-soft" aria-hidden="true">{closed ? '▸' : '▾'}</span><span className="min-w-0 break-words [overflow-wrap:anywhere]">{group.name}</span><span className="shrink-0 text-xs font-normal text-ink-soft">{group.properties.length}</span>
                  </button>
                  {!readOnly && <><Button size="sm" variant="ghost" onClick={() => add(group.id)} aria-label={t('Ajouter une propriété dans {0}', [group.name])}><Icon name="plus" size={14} /><span className="hidden sm:inline">{t('Propriété')}</span></Button>
                    {group.kind === 'tables' && <button type="button" onClick={() => setPendingTable(group.id)} className="inline-flex min-h-8 shrink-0 items-center rounded-lg px-2 text-ink-soft hover:bg-danger-soft hover:text-danger"
                      aria-label={t('Supprimer la table {0}', [group.name])} title={t('Supprimer la table {0}', [group.name])}><Icon name="trash" size={16} /></button>}</>}
                </div>
              </th></tr>
              {!closed && !group.properties.length && <tr className="block lg:table-row"><td colSpan={6} className="block border-b border-line px-4 py-3 text-xs text-ink-soft lg:table-cell">{t('Aucune propriété dans ce groupe.')}</td></tr>}
              {!closed && group.properties.map(property => {
                const placement = findPlacement(mcd, property.id), identifier = placement?.owner.attributes.some(a => a.propertyId === property.id && a.isIdentifier) ?? false
                const spec = parseSqlType(physicalType(property.id, property.type, property.size))
                return <tr key={property.id} data-property-id={property.id} onDragOver={e => acceptDrag(e, group.id)} onDrop={e => drop(e, group.id, property.id)}
                  className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-b border-line p-3 hover:bg-surface-soft lg:table-row lg:border-0 lg:p-0 [&>td]:lg:border-b [&>td]:lg:border-line">
                  <td className={cell + ' col-span-2'}><div className="flex min-w-0 items-center gap-1">
                    {!readOnly && <button type="button" draggable aria-label={t('Déplacer {0}', [property.name])} title={t('Glisser vers un autre groupe')} className="min-h-8 shrink-0 cursor-grab rounded-lg px-1 text-ink-soft hover:bg-accent-soft"
                      onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, property.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDropTarget(null)}>⠿</button>}
                    <input data-property-name disabled={readOnly} value={property.name} aria-label={t('Nom de la propriété {0}', [property.name])} onChange={e => dispatch({ type: 'UPDATE_PROPERTY', propertyId: property.id, patch: { name: e.target.value } })} className={control + ' w-full font-mono text-code'} />
                  </div></td>
                  <td className={cell}><span className="mb-1 block text-xs text-ink-soft lg:hidden">{t('Type SQL')}</span><SqlTypeControl property={property} part="type" /></td>
                  <td className={cell}><span className="mb-1 block text-xs text-ink-soft lg:hidden">{t('Paramètres')}</span><SqlTypeControl property={property} part="parameters" /></td>
                  <td className={cell + ' col-span-2'}><div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {placement?.kind === 'entity' ? <>
                      <label className="inline-flex min-h-8 items-center gap-1.5 text-xs" title={t('Identifiant')}><input type="checkbox" disabled={readOnly} checked={identifier} aria-label={t('Identifiant de {0}', [property.name])} onChange={e => dispatch({ type: 'SET_ATTRIBUTE_IDENTIFIER', entityId: placement.owner.id, propertyId: property.id, isIdentifier: e.target.checked })} /><span className="lg:sr-only">{t('Identifiant')}</span><span aria-hidden="true" className="hidden font-mono text-accent-ink lg:inline">{t('clé')}</span></label>
                      {identifier && spec && isIntegerType(spec.name) && <label className="inline-flex min-h-8 items-center gap-1 text-xs" title={t('Auto-incrément')}><input type="checkbox" disabled={readOnly || placement.owner.attributes.filter(a => a.isIdentifier).length !== 1} checked={(placement.owner.attributes.filter(a => a.isIdentifier).length === 1) && (settings.identity?.[property.id] ?? settings.overrides[property.id] === undefined)} aria-label={t('Auto-incrément de {0}', [property.name])} onChange={e => dispatch({ type: 'SET_IDENTITY', propertyId: property.id, value: e.target.checked })} />{t('Auto')}</label>}
                    </> : <span className="hidden text-xs text-ink-soft lg:inline">—</span>}
                  </div></td>
                  <td className={cell}><Select data-property-placement aria-label={t('Déplacer {0} vers', [property.name])} disabled={readOnly} className={control + ' w-full border-line-strong bg-surface'} value={group.id} onValueChange={value => requestMove(property.id, value || null)}>
                    <optgroup label={t('Tables')}>{groups.filter(g => g.kind === 'tables').map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</optgroup>
                    <optgroup label={t('Associations')}>{groups.filter(g => g.kind === 'associations').map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</optgroup>
                    <option value="">{t('Non affectées')}</option>
                  </Select></td>
                  <td className={cell + ' flex items-center justify-end lg:table-cell lg:px-1 lg:text-center'}>{!readOnly && <button type="button" className="inline-flex min-h-8 items-center justify-center rounded-lg px-2 text-ink-soft hover:bg-danger-soft hover:text-danger" aria-label={t('Supprimer la propriété {0} du dictionnaire', [property.name])} onClick={() => { if (placement) setPendingDelete(property); else dispatch({ type: 'DELETE_PROPERTY', propertyId: property.id }) }}><Icon name="close" size={14} /></button>}</td>
                </tr>
              })}
            </tbody>
          </Fragment>
        })}
      </table>}
    </div>
    <ConfirmDialog open={!!pendingMove} title={t('Déplacer un identifiant')} message={t('Cette propriété participe à un identifiant. Son déplacement peut modifier les clés étrangères. Vers une association ou les propriétés non affectées, elle perdra ce rôle. Vérifiez ensuite le rapport.')} confirmLabel={t('Déplacer')} onCancel={() => setPendingMove(null)} onConfirm={() => { if (pendingMove) executeMove(pendingMove) }} />
    <ConfirmDialog open={!!pendingDelete} title={t('Propriété utilisée dans le MCD')} message={t('Retirer cette propriété du modèle et du dictionnaire ? Ctrl+Z permet d’annuler.')} confirmLabel={t('Oui, supprimer')} onCancel={() => setPendingDelete(null)} onConfirm={() => { if (!readOnly && pendingDelete) dispatch({ type: 'DELETE_PROPERTY', propertyId: pendingDelete.id }); setPendingDelete(null) }} />
    <ConfirmDialog open={!!tableToDelete} title={t('Supprimer la table « {0} » ?', [tableToDelete?.name ?? ''])}
      message={t('La table, ses propriétés et ses liaisons seront retirées du modèle pour tous les participants. Vous pouvez aussi garder ses propriétés dans « Non affectées ». Ctrl+Z permet d’annuler.')}
      confirmLabel={t('Supprimer la table et ses propriétés')} onConfirm={() => deleteTable(true)} onCancel={() => setPendingTable(null)}
      secondaryLabel={t('Supprimer en gardant les propriétés')} onSecondary={() => deleteTable(false)} />
  </section>
}
