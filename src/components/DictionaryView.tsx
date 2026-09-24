import { useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import type { AttributeType, Mcd, Property } from '../model/mcd'
import { ATTRIBUTE_TYPES } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'
import { findPlacement } from '../model/queries'

interface DictionaryRow {
  property: Property
  used: boolean
  /** « Client (Entité) », « passer (Association) » ou « non placée ». */
  placementLabel: string
  isIdentifier: boolean
}

type SortKey = 'name' | 'type' | 'size' | 'used' | 'placement'
type SortDirection = 'asc' | 'desc'

const COLUMNS: readonly { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Propriété' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Taille' },
  { key: 'used', label: 'Utilisée' },
  { key: 'placement', label: 'Placement' },
]

function compareRows(a: DictionaryRow, b: DictionaryRow, key: SortKey): number {
  switch (key) {
    case 'name':
      return a.property.name.localeCompare(b.property.name, 'fr')
    case 'type':
      return a.property.type.localeCompare(b.property.type, 'fr')
    case 'size':
      return (a.property.size ?? 0) - (b.property.size ?? 0)
    case 'used':
      return Number(b.used) - Number(a.used)
    case 'placement':
      return a.placementLabel.localeCompare(b.placementLabel, 'fr')
  }
}

interface DictionaryViewProps {
  mcd: Mcd
  dispatch: Dispatch<McdAction>
  /** Consultation seule : la liste se lit et se trie, elle ne s'édite pas. */
  readOnly?: boolean
}

/**
 * Dictionnaire des données : la liste maîtresse des propriétés.
 * Chaque propriété est définie ici une seule fois ; les entités et
 * associations la référencent. Une propriété peut rester non placée.
 */
export function DictionaryView({ mcd, dispatch, readOnly = false }: DictionaryViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const rows = useMemo(() => {
    const all: DictionaryRow[] = mcd.properties.map((property) => {
      const placement = findPlacement(mcd, property.id)
      if (!placement) {
        return { property, used: false, placementLabel: 'non placée', isIdentifier: false }
      }
      const kindLabel = placement.kind === 'entity' ? 'Entité' : 'Association'
      const isIdentifier = placement.owner.attributes.some(
        (ref) => ref.propertyId === property.id && ref.isIdentifier,
      )
      return {
        property,
        used: true,
        placementLabel: `${placement.owner.name} (${kindLabel})`,
        isIdentifier,
      }
    })
    const direction = sortDirection === 'asc' ? 1 : -1
    return all.sort((a, b) => direction * compareRows(a, b, sortKey))
  }, [mcd, sortKey, sortDirection])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  // Suppression protégée : une propriété placée ne se supprime pas
  // sans prévenir, on propose de la retirer puis de la supprimer.
  const [pendingDelete, setPendingDelete] = useState<DictionaryRow | null>(null)

  const deleteProperty = (row: DictionaryRow) => {
    if (row.used) {
      setPendingDelete(row)
      return
    }
    dispatch({ type: 'DELETE_PROPERTY', propertyId: row.property.id })
  }

  const confirmPendingDelete = () => {
    if (pendingDelete) {
      dispatch({ type: 'DELETE_PROPERTY', propertyId: pendingDelete.property.id })
    }
    setPendingDelete(null)
  }

  const updateSize = (propertyId: string, raw: string) => {
    const parsed = Number.parseInt(raw, 10)
    dispatch({
      type: 'UPDATE_PROPERTY',
      propertyId,
      // Champ vidé ou valeur invalide → retour au défaut (pas de taille).
      patch: { size: Number.isInteger(parsed) && parsed > 0 ? parsed : undefined },
    })
  }

  return (
    <section aria-label="Dictionnaire des données" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
        {!readOnly && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_PROPERTY' })}
            className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell"
          >
            Ajouter une propriété
          </button>
        )}
        <p className="text-xs text-ink-soft">
          {rows.length} propriété{rows.length > 1 ? 's' : ''} au dictionnaire
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">
            {readOnly
              ? 'Aucune propriété au dictionnaire de ce modèle.'
              : 'Aucune propriété. Ajoutez-en une ici ou construisez le MCD, chaque attribut créé entre au dictionnaire.'}
          </p>
        ) : (
          <table className="w-full border-separate border-spacing-0 rounded-card border border-line bg-surface text-sm shadow-soft">
            <caption className="sr-only">
              La liste maîtresse des propriétés : nom, type conceptuel, taille, utilisation
              dans le MCD et placement
            </caption>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sortKey === column.key
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className="border-b border-line bg-shell px-3 py-2 text-left first:rounded-tl-lg"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="flex items-center gap-1 text-xs font-semibold text-ink-soft"
                    >
                      {column.label}
                      <span aria-hidden="true" className="text-ink-soft">
                        {sortKey === column.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="rounded-tr-lg border-b border-line bg-shell px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.property.id}>
                  <td className="border-b border-line px-3 py-1.5">
                    <input
                      type="text"
                      aria-label={`Nom de la propriété ${row.property.name}`}
                      value={row.property.name}
                      disabled={readOnly}
                      onChange={(event) =>
                        dispatch({
                          type: 'UPDATE_PROPERTY',
                          propertyId: row.property.id,
                          patch: { name: event.target.value },
                        })
                      }
                      className="w-full min-w-24 rounded-lg border border-transparent px-1 py-0.5 font-mono text-[13px] hover:border-line-strong focus:border-line-strong"
                    />
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    <select
                      aria-label={`Type de la propriété ${row.property.name}`}
                      value={row.property.type}
                      disabled={readOnly}
                      onChange={(event) =>
                        dispatch({
                          type: 'UPDATE_PROPERTY',
                          propertyId: row.property.id,
                          patch: { type: event.target.value as AttributeType },
                        })
                      }
                      className="rounded-lg border border-line-strong px-1 py-0.5 font-mono text-xs"
                    >
                      {ATTRIBUTE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    <input
                      type="number"
                      min={1}
                      placeholder="défaut"
                      aria-label={`Taille de la propriété ${row.property.name} (nombre de caractères, vide = défaut)`}
                      value={row.property.size ?? ''}
                      disabled={readOnly}
                      onChange={(event) => updateSize(row.property.id, event.target.value)}
                      className="w-20 rounded-lg border border-transparent px-1 py-0.5 text-right font-mono text-[13px] hover:border-line-strong focus:border-line-strong"
                    />
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    {row.used ? (
                      <span className="text-sage">
                        <span aria-hidden="true">✓ </span>oui
                      </span>
                    ) : (
                      <span className="text-ink-soft">non</span>
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    {row.used ? (
                      <>
                        {row.placementLabel}
                        {row.isIdentifier && (
                          <span className="ml-1.5 rounded-sm border border-line bg-accent-soft px-1 font-mono text-[11px] font-medium text-accent-ink">
                            clé
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-soft">non placée</span>
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-1.5 text-right">
                    {!readOnly && (
                    <button
                      type="button"
                      aria-label={`Supprimer la propriété ${row.property.name} du dictionnaire`}
                      title={
                        row.used
                          ? 'Placée dans le MCD : demandera confirmation pour la retirer puis la supprimer'
                          : 'Supprimer du dictionnaire'
                      }
                      onClick={() => deleteProperty(row)}
                      className="rounded-lg border border-line-strong px-1.5 py-0.5 text-sm hover:bg-surface-soft"
                    >
                      ✕
                    </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Propriété utilisée dans le MCD"
        message={`« ${pendingDelete?.property.name ?? ''} » est placée dans ${pendingDelete?.placementLabel ?? ''}. La retirer puis la supprimer du dictionnaire ? Vous pourrez annuler avec Ctrl+Z.`}
        confirmLabel="Oui, supprimer"
        onConfirm={confirmPendingDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
