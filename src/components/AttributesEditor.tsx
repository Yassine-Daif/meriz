import { useState } from 'react'
import type { AttributeType, Property } from '../model/mcd'
import { ATTRIBUTE_TYPES } from '../model/mcd'
import type { ResolvedAttribute } from '../model/queries'

interface AttributesEditorProps {
  /** Attributs du porteur, références résolues vers le dictionnaire. */
  attributes: ResolvedAttribute[]
  /** Propriétés du dictionnaire encore non placées, plaçables ici. */
  unplaced: Property[]
  /**
   * false côté association : la case « clé » n'est jamais rendue,
   * un attribut d'association ne peut pas être identifiant.
   */
  allowIdentifier: boolean
  onAdd: () => void
  onPlace: (propertyId: string) => void
  onRename: (propertyId: string, name: string) => void
  onChangeType: (propertyId: string, type: AttributeType) => void
  onToggleIdentifier?: (propertyId: string, isIdentifier: boolean) => void
  /** Retire le placement ; la propriété reste au dictionnaire. */
  onRemove: (propertyId: string) => void
}

/**
 * Liste éditable des attributs d'une entité ou d'une association.
 * Renommer ou retyper modifie la propriété au dictionnaire central ;
 * « Retirer » ne supprime que le placement. Chaque ligne tient sur
 * deux rangées pour ne jamais déborder du panneau, quelle que soit
 * sa largeur.
 */
export function AttributesEditor({
  attributes,
  unplaced,
  allowIdentifier,
  onAdd,
  onPlace,
  onRename,
  onChangeType,
  onToggleIdentifier,
  onRemove,
}: AttributesEditorProps) {
  const [propertyToPlace, setPropertyToPlace] = useState('')

  const handlePlace = () => {
    if (propertyToPlace !== '') {
      onPlace(propertyToPlace)
      setPropertyToPlace('')
    }
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-xs font-medium text-zinc-600">Attributs</legend>

      {/* Le dictionnaire d'abord : on place une propriété existante
          au lieu de la réécrire. */}
      {unplaced.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1.5 rounded border border-indigo-200 bg-indigo-50/50 p-1.5">
          <select
            aria-label="Propriété du dictionnaire à placer ici"
            value={propertyToPlace}
            onChange={(event) => setPropertyToPlace(event.target.value)}
            className="w-full min-w-0 rounded border border-zinc-300 bg-surface px-1.5 py-1 text-xs"
          >
            <option value="">Placer depuis le dictionnaire</option>
            {unplaced.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name} ({property.type})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handlePlace}
            disabled={propertyToPlace === ''}
            className="self-end rounded border border-zinc-300 bg-surface px-2 py-1 text-xs hover:bg-shell disabled:cursor-not-allowed disabled:opacity-50"
          >
            Placer
          </button>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Aucune propriété libre au dictionnaire : elles sont toutes placées.
        </p>
      )}

      {attributes.length === 0 && <p className="text-xs text-zinc-500">Aucun attribut.</p>}
      <ul className="flex min-w-0 flex-col gap-1.5">
        {attributes.map((attribute, index) => (
          <li
            key={attribute.propertyId}
            className="min-w-0 rounded border border-line bg-shell/60 p-1.5"
          >
            <input
              type="text"
              aria-label={`Nom de l'attribut ${index + 1}`}
              value={attribute.name}
              onChange={(event) => onRename(attribute.propertyId, event.target.value)}
              className="w-full min-w-0 rounded border border-zinc-300 bg-surface px-2 py-1 text-sm"
            />
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <select
                aria-label={`Type de l'attribut ${index + 1}`}
                value={attribute.type}
                onChange={(event) =>
                  onChangeType(attribute.propertyId, event.target.value as AttributeType)
                }
                className="min-w-0 flex-1 rounded border border-zinc-300 bg-surface px-1.5 py-1 font-mono text-xs"
              >
                {ATTRIBUTE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {allowIdentifier && onToggleIdentifier && (
                <label
                  className="flex shrink-0 items-center gap-1 text-xs"
                  title="Fait partie de l'identifiant"
                >
                  <input
                    type="checkbox"
                    checked={attribute.isIdentifier}
                    onChange={(event) =>
                      onToggleIdentifier(attribute.propertyId, event.target.checked)
                    }
                  />
                  clé
                </label>
              )}
              <button
                type="button"
                aria-label={`Retirer l'attribut ${index + 1} (la propriété reste au dictionnaire)`}
                title="Retirer (la propriété reste au dictionnaire)"
                onClick={() => onRemove(attribute.propertyId)}
                className="shrink-0 rounded border border-zinc-300 bg-surface px-1.5 py-0.5 text-sm hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="self-start rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
      >
        Nouvelle propriété
      </button>
    </fieldset>
  )
}
