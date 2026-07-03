import type {
  Association,
  PropertyRef,
  Cardinality,
  Entity,
  Leg,
  Mcd,
  Property,
} from '../model/mcd'
import { ATTRIBUTE_TYPES } from '../model/mcd'
import type { McdLayout, Position } from '../model/layout'
import type { McdEditorState } from '../model/mcdReducer'

/**
 * Format de fichier Meriz : le modèle et ses positions, plus un champ
 * `format` et un champ `version` pour le contrôle de forme à
 * l'ouverture et les évolutions futures.
 *
 * Version 2 : dictionnaire central des propriétés (`properties`),
 * les entités et associations portent des références.
 * Version 1 (attributs définis en ligne) : encore ouvrable, migrée
 * automatiquement à la lecture.
 */
export const MERIZ_FORMAT = 'meriz-mcd'
export const MERIZ_VERSION = 2

export interface MerizFile {
  format: typeof MERIZ_FORMAT
  version: typeof MERIZ_VERSION
  mcd: Mcd
  layout: McdLayout
}

export type ParseResult =
  | { ok: true; state: McdEditorState }
  | { ok: false; error: string }

/** Sérialise l'état complet (modèle + positions) en JSON indenté. */
export function serializeModel(state: McdEditorState): string {
  const file: MerizFile = {
    format: MERIZ_FORMAT,
    version: MERIZ_VERSION,
    mcd: state.mcd,
    layout: state.layout,
  }
  return JSON.stringify(file, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAttributeType(value: unknown): boolean {
  return typeof value === 'string' && (ATTRIBUTE_TYPES as readonly string[]).includes(value)
}

function isProperty(value: unknown): value is Property {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isAttributeType(value.type) &&
    (value.size === undefined ||
      (typeof value.size === 'number' && Number.isInteger(value.size) && value.size > 0))
  )
}

function isPropertyRef(value: unknown): value is PropertyRef {
  return (
    isRecord(value) &&
    typeof value.propertyId === 'string' &&
    typeof value.isIdentifier === 'boolean'
  )
}

/**
 * Revérification à l'exécution de l'invariant sur les cardinalités :
 * seules (0,1), (1,1), (0,n), (1,n) sont acceptées à l'import.
 */
function isCardinality(value: unknown): value is Cardinality {
  return (
    isRecord(value) && (value.min === 0 || value.min === 1) && (value.max === 1 || value.max === 'n')
  )
}

function isLeg(value: unknown): value is Leg {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.entityId === 'string' &&
    isCardinality(value.cardinality) &&
    (value.role === undefined || typeof value.role === 'string')
  )
}

function isEntity(value: unknown): value is Entity {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.attributes) &&
    value.attributes.every(isPropertyRef)
  )
}

function isAssociation(value: unknown): value is Association {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.attributes) &&
    value.attributes.every(isPropertyRef) &&
    Array.isArray(value.legs) &&
    value.legs.every(isLeg)
  )
}

function isPosition(value: unknown): value is Position {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  )
}

function isLayout(value: unknown): value is McdLayout {
  return isRecord(value) && Object.values(value).every(isPosition)
}

/* ------------------------------------------------------------------ */
/* Version 1 : attributs définis en ligne, migrés vers le dictionnaire */

interface LegacyAttribute {
  id: string
  name: string
  type: Property['type']
  isIdentifier: boolean
}

function isLegacyAttribute(value: unknown): value is LegacyAttribute {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isAttributeType(value.type) &&
    typeof value.isIdentifier === 'boolean'
  )
}

interface LegacyOwner {
  id: string
  name: string
  attributes: LegacyAttribute[]
}

function isLegacyEntity(value: unknown): value is LegacyOwner {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.attributes) &&
    value.attributes.every(isLegacyAttribute)
  )
}

function isLegacyAssociation(value: unknown): value is LegacyOwner & { legs: Leg[] } {
  if (!isRecord(value)) {
    return false
  }
  const legs = value.legs
  return Array.isArray(legs) && legs.every(isLeg) && isLegacyEntity(value)
}

/**
 * Migration v1 → v2 : chaque attribut en ligne devient une propriété
 * du dictionnaire (id conservé) référencée par son porteur d'origine.
 * Deux attributs homonymes ne peuvent pas fusionner (une propriété se
 * place au plus une fois) : le second est suffixé du nom du porteur.
 */
function migrateV1(entities: LegacyOwner[], associations: (LegacyOwner & { legs: Leg[] })[]): Mcd {
  const properties: Property[] = []
  const usedNames = new Set<string>()
  const uniquePropertyName = (name: string, ownerName: string): string => {
    let candidate = name
    if (usedNames.has(candidate.toLowerCase())) {
      candidate = `${name}_${ownerName}`
    }
    let n = 2
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${name}_${ownerName}${n}`
      n += 1
    }
    usedNames.add(candidate.toLowerCase())
    return candidate
  }
  const toRefs = (attributes: LegacyAttribute[], ownerName: string): PropertyRef[] =>
    attributes.map((attribute) => {
      properties.push({
        id: attribute.id,
        name: uniquePropertyName(attribute.name, ownerName),
        type: attribute.type,
      })
      return { propertyId: attribute.id, isIdentifier: attribute.isIdentifier }
    })

  const migratedEntities: Entity[] = entities.map((e) => ({
    id: e.id,
    name: e.name,
    attributes: toRefs(e.attributes, e.name),
  }))
  const migratedAssociations: Association[] = associations.map((a) => ({
    id: a.id,
    name: a.name,
    attributes: toRefs(a.attributes, a.name),
    legs: a.legs,
  }))

  return { properties, entities: migratedEntities, associations: migratedAssociations }
}

/* ------------------------------------------------------------------ */

/**
 * Contrôle de forme d'un fichier ouvert. Ne lève jamais d'exception :
 * retourne soit l'état prêt à charger, soit un message d'erreur clair.
 * La validation Merise (invariants) n'est pas faite ici : un modèle
 * bien formé mais invalide se charge, et le panneau de validation
 * affiche ses problèmes.
 */
export function parseModelFile(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "Ce fichier n'est pas un JSON lisible." }
  }

  if (!isRecord(raw)) {
    return { ok: false, error: "Ce fichier n'a pas la structure d'un modèle Meriz." }
  }
  if (raw.format !== MERIZ_FORMAT) {
    return {
      ok: false,
      error: `Ce fichier n'est pas un modèle Meriz (champ « format » attendu : « ${MERIZ_FORMAT} »).`,
    }
  }

  const rawMcd = raw.mcd
  if (!isRecord(rawMcd) || !Array.isArray(rawMcd.entities) || !Array.isArray(rawMcd.associations)) {
    return {
      ok: false,
      error: 'Le modèle du fichier est mal formé (entités ou associations manquantes).',
    }
  }
  if (!isLayout(raw.layout)) {
    return { ok: false, error: 'Les positions du fichier (layout) sont mal formées.' }
  }

  if (raw.version === 1) {
    // Ancien format : attributs en ligne, migrés vers le dictionnaire.
    const entities: LegacyOwner[] = []
    for (const value of rawMcd.entities) {
      if (!isLegacyEntity(value)) {
        return { ok: false, error: 'Le fichier (version 1) contient une entité mal formée.' }
      }
      entities.push(value)
    }
    const associations: (LegacyOwner & { legs: Leg[] })[] = []
    for (const value of rawMcd.associations) {
      if (!isLegacyAssociation(value)) {
        return { ok: false, error: 'Le fichier (version 1) contient une association mal formée.' }
      }
      associations.push(value)
    }
    return { ok: true, state: { mcd: migrateV1(entities, associations), layout: raw.layout } }
  }

  if (raw.version !== MERIZ_VERSION) {
    return {
      ok: false,
      error: `Version de fichier non prise en charge (attendu : ${MERIZ_VERSION} ou 1).`,
    }
  }

  if (!Array.isArray(rawMcd.properties)) {
    return { ok: false, error: 'Le dictionnaire des propriétés est manquant ou mal formé.' }
  }
  const properties: Property[] = []
  for (const value of rawMcd.properties) {
    if (!isProperty(value)) {
      return { ok: false, error: 'Le fichier contient une propriété mal formée.' }
    }
    properties.push(value)
  }

  const entities: Entity[] = []
  for (const value of rawMcd.entities) {
    if (!isEntity(value)) {
      return { ok: false, error: 'Le fichier contient une entité mal formée.' }
    }
    entities.push(value)
  }

  const associations: Association[] = []
  for (const value of rawMcd.associations) {
    if (!isAssociation(value)) {
      return {
        ok: false,
        error:
          'Le fichier contient une association mal formée (attributs, pattes ou cardinalités invalides).',
      }
    }
    associations.push(value)
  }

  return { ok: true, state: { mcd: { properties, entities, associations }, layout: raw.layout } }
}

/* ------------------------------------------------------------------ */
/* Sauvegarde automatique locale                                       */

const AUTOSAVE_KEY = 'meriz-autosave'

/** Écrit l'état courant dans le navigateur. Silencieux en cas d'échec. */
export function saveAutosave(state: McdEditorState): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeModel(state))
  } catch {
    // Stockage plein ou indisponible : la sauvegarde fichier reste possible.
  }
}

/**
 * Relit la sauvegarde automatique au démarrage. Réutilise le contrôle
 * de forme du format de fichier (migration v1 comprise). Retourne null
 * si absente ou illisible : l'appelant repart de l'exemple.
 */
export function loadAutosave(): McdEditorState | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY)
    if (text === null) {
      return null
    }
    const result = parseModelFile(text)
    return result.ok ? result.state : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Réglages MPD (dialecte + surcharges de types), mémorisés localement */

const MPD_SETTINGS_KEY = 'meriz-mpd-settings'

export function saveMpdSettings(settings: import('../model/mpd').MpdSettings): void {
  try {
    localStorage.setItem(MPD_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Stockage indisponible : les réglages ne survivront pas au rechargement.
  }
}

export function loadMpdSettings(): import('../model/mpd').MpdSettings | null {
  try {
    const text = localStorage.getItem(MPD_SETTINGS_KEY)
    if (text === null) {
      return null
    }
    const raw: unknown = JSON.parse(text)
    if (!isRecord(raw) || (raw.dialect !== 'mysql' && raw.dialect !== 'postgresql')) {
      return null
    }
    const overrides: Record<string, string> = {}
    if (isRecord(raw.overrides)) {
      for (const [key, value] of Object.entries(raw.overrides)) {
        if (typeof value === 'string') {
          overrides[key] = value
        }
      }
    }
    return { dialect: raw.dialect, overrides }
  } catch {
    return null
  }
}
