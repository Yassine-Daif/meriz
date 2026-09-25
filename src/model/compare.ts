import type { Association, Cardinality, Entity, Mcd } from './mcd'
import { resolveAttributes } from './queries'
import type { ResolvedAttribute } from './queries'

/**
 * Comparaison d'un modèle rendu avec un modèle de référence, pour aider
 * le prof à corriger.
 *
 * Principe, et il commande tout ce fichier : en Merise, un même énoncé
 * admet souvent plusieurs modèles corrects. Cette comparaison ne juge
 * donc rien. Elle relève des points à vérifier, le prof tranche. Aucune
 * formulation ne parle d'erreur ni de faute.
 *
 * L'appariement est souple : le nom est comparé sans casse, sans accents
 * et sans tenir compte de l'ordre des éléments. Les identifiants
 * techniques des deux modèles n'ont aucun rapport, ils sont ignorés.
 */

export type DifferenceKind =
  | 'entity-missing'
  | 'entity-extra'
  | 'attribute-missing'
  | 'attribute-extra'
  | 'attribute-type'
  | 'attribute-identifier'
  | 'association-missing'
  | 'association-extra'
  | 'association-legs'
  | 'cardinality'

/** Un point à vérifier, jamais une erreur affirmée. */
export interface Difference {
  kind: DifferenceKind
  /** Regroupement à l'écran : « Entité Client », « Association passer »... */
  scope: string
  message: string
}

export interface MatchedPair {
  /** Nom tel qu'il figure au corrigé. */
  expected: string
  /** Nom tel qu'il figure au rendu, parfois écrit autrement. */
  submitted: string
}

export interface ComparisonSummary {
  /** Éléments attendus au corrigé : entités, associations et attributs. */
  expectedPoints: number
  /** Parmi eux, ceux retrouvés dans le rendu. */
  matchedPoints: number
  /** Points à vérifier portant sur un élément retrouvé. */
  checks: number
  /** Éléments du rendu absents du corrigé : signalés, jamais décomptés. */
  extras: number
  /** Note sur 20, proposition ajustable. null quand le corrigé est vide. */
  suggestedGrade: number | null
}

export interface Comparison {
  matchedEntities: MatchedPair[]
  matchedAssociations: MatchedPair[]
  differences: Difference[]
  summary: ComparisonSummary
}

/* ------------------------------------------------------------------ */
/* Appariement des noms                                                */

/**
 * Nom ramené à sa forme comparable : accents et casse ignorés, et tout
 * ce qui ne sert qu'à séparer les mots retiré, pour que « codeCours »,
 * « code_cours » et « Code Cours » se retrouvent. Aucune tolérance au
 * pluriel en revanche : ce serait deviner à la place du prof.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** Nom affichable, même vide. */
function shown(name: string): string {
  return name.trim() === '' ? '(sans nom)' : name.trim()
}

function cardinalityLabel(cardinality: Cardinality): string {
  return `(${cardinality.min},${cardinality.max})`
}

const TYPE_LABEL = 'type'

/* ------------------------------------------------------------------ */
/* Comparaison                                                         */

interface Counter {
  expected: number
  matched: number
  checks: number
  extras: number
}

/** Entités reliées par une association, en noms normalisés et triés. */
function legEntityNames(mcd: Mcd, association: Association): string[] {
  return association.legs
    .map((leg) => {
      const entity = mcd.entities.find((candidate) => candidate.id === leg.entityId)
      return entity ? normalizeName(entity.name) : ''
    })
    .sort()
}

function sameEntitySet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index])
}

/**
 * Apparie deux listes nommées : d'abord les noms qui correspondent, le
 * reste étant attendu sans réponse d'un côté, en trop de l'autre.
 */
function pairByName<T>(
  expected: readonly T[],
  submitted: readonly T[],
  nameOf: (item: T) => string,
): { pairs: { expected: T; submitted: T }[]; missing: T[]; extra: T[] } {
  const remaining = [...submitted]
  const pairs: { expected: T; submitted: T }[] = []
  const missing: T[] = []

  for (const item of expected) {
    const key = normalizeName(nameOf(item))
    const found = remaining.findIndex((candidate) => normalizeName(nameOf(candidate)) === key)
    if (found === -1) {
      missing.push(item)
    } else {
      const match = remaining[found]
      if (match !== undefined) {
        pairs.push({ expected: item, submitted: match })
      }
      remaining.splice(found, 1)
    }
  }
  return { pairs, missing, extra: remaining }
}

/** Compare les attributs d'un porteur retrouvé (entité ou association). */
function compareAttributes(
  scope: string,
  expected: ResolvedAttribute[],
  submitted: ResolvedAttribute[],
  differences: Difference[],
  counter: Counter,
): void {
  counter.expected += expected.length
  const { pairs, missing, extra } = pairByName(expected, submitted, (attribute) => attribute.name)

  for (const attribute of missing) {
    differences.push({
      kind: 'attribute-missing',
      scope,
      message: `L'attribut « ${shown(attribute.name)} » du corrigé ne se retrouve pas dans le rendu. À vérifier.`,
    })
  }
  for (const attribute of extra) {
    counter.extras += 1
    differences.push({
      kind: 'attribute-extra',
      scope,
      message: `L'attribut « ${shown(attribute.name)} » du rendu n'est pas au corrigé. Peut-être un choix volontaire.`,
    })
  }

  for (const { expected: want, submitted: got } of pairs) {
    counter.matched += 1
    if (want.type !== got.type) {
      counter.checks += 1
      differences.push({
        kind: 'attribute-type',
        scope,
        message: `« ${shown(got.name)} » : ${TYPE_LABEL} ${want.type} au corrigé, ${got.type} au rendu. À vérifier.`,
      })
    }
    if (want.isIdentifier !== got.isIdentifier) {
      counter.checks += 1
      differences.push({
        kind: 'attribute-identifier',
        scope,
        message: want.isIdentifier
          ? `« ${shown(got.name)} » fait partie de l'identifiant au corrigé, pas au rendu. À vérifier.`
          : `« ${shown(got.name)} » fait partie de l'identifiant au rendu, pas au corrigé. À vérifier.`,
      })
    }
  }
}

/**
 * Compare les cardinalités de deux associations retrouvées. Les pattes
 * s'apparient par entité reliée, puis par rôle, et à défaut de rôle par
 * ordre d'apparition : une association réflexive garde ainsi ses deux
 * pattes distinctes.
 */
function compareLegs(
  scope: string,
  expectedMcd: Mcd,
  expectedAsso: Association,
  submittedMcd: Mcd,
  submittedAsso: Association,
  differences: Difference[],
  counter: Counter,
): void {
  const submittedLegs = submittedAsso.legs.map((leg) => {
    const entity = submittedMcd.entities.find((candidate) => candidate.id === leg.entityId)
    return { leg, entityName: entity ? entity.name : '' }
  })
  const used = new Set<string>()

  for (const leg of expectedAsso.legs) {
    const entity = expectedMcd.entities.find((candidate) => candidate.id === leg.entityId)
    const entityName = entity ? entity.name : ''
    const key = normalizeName(entityName)
    const role = normalizeName(leg.role ?? '')

    const candidates = submittedLegs.filter(
      (candidate) => normalizeName(candidate.entityName) === key && !used.has(candidate.leg.id),
    )
    const byRole =
      role === '' ? undefined : candidates.find((candidate) => normalizeName(candidate.leg.role ?? '') === role)
    const chosen = byRole ?? candidates[0]
    if (!chosen) {
      continue
    }
    used.add(chosen.leg.id)

    const want = leg.cardinality
    const got = chosen.leg.cardinality
    if (want.min !== got.min || want.max !== got.max) {
      counter.checks += 1
      const side = leg.role ? `côté ${shown(entityName)} (${leg.role})` : `côté ${shown(entityName)}`
      differences.push({
        kind: 'cardinality',
        scope,
        message: `${side} : ${cardinalityLabel(want)} au corrigé, ${cardinalityLabel(got)} au rendu. À vérifier.`,
      })
    }
  }
}

/**
 * Compare un rendu au corrigé. Fonction pure : mêmes modèles, même
 * résultat, aucun effet de bord.
 */
export function compareMcd(submitted: Mcd, expected: Mcd): Comparison {
  const differences: Difference[] = []
  const counter: Counter = { expected: 0, matched: 0, checks: 0, extras: 0 }

  /* ----------------------------- Entités ----------------------------- */

  counter.expected += expected.entities.length
  const entities = pairByName(expected.entities, submitted.entities, (entity: Entity) => entity.name)

  for (const entity of entities.missing) {
    differences.push({
      kind: 'entity-missing',
      scope: `Entité ${shown(entity.name)}`,
      message: `L'entité « ${shown(entity.name)} » du corrigé ne se retrouve pas dans le rendu. À vérifier.`,
    })
  }
  for (const entity of entities.extra) {
    counter.extras += 1
    differences.push({
      kind: 'entity-extra',
      scope: `Entité ${shown(entity.name)}`,
      message: `L'entité « ${shown(entity.name)} » du rendu n'est pas au corrigé. Peut-être un découpage différent, à regarder.`,
    })
  }

  const matchedEntities: MatchedPair[] = []
  for (const { expected: want, submitted: got } of entities.pairs) {
    counter.matched += 1
    matchedEntities.push({ expected: shown(want.name), submitted: shown(got.name) })
    compareAttributes(
      `Entité ${shown(want.name)}`,
      resolveAttributes(expected, want.attributes),
      resolveAttributes(submitted, got.attributes),
      differences,
      counter,
    )
  }

  /* --------------------------- Associations --------------------------- */

  counter.expected += expected.associations.length
  // Premier tour : le nom et les entités reliées correspondent.
  const remaining = [...submitted.associations]
  const pairs: { expected: Association; submitted: Association; sameEntities: boolean }[] = []
  const unmatchedExpected: Association[] = []

  for (const want of expected.associations) {
    const key = normalizeName(want.name)
    const wantEntities = legEntityNames(expected, want)
    const exact = remaining.findIndex(
      (candidate) =>
        normalizeName(candidate.name) === key && sameEntitySet(wantEntities, legEntityNames(submitted, candidate)),
    )
    if (exact === -1) {
      unmatchedExpected.push(want)
      continue
    }
    const got = remaining[exact]
    if (got) {
      pairs.push({ expected: want, submitted: got, sameEntities: true })
    }
    remaining.splice(exact, 1)
  }

  // Second tour : le nom seul suffit, l'écart d'entités reliées devient
  // un point à vérifier plutôt que deux lignes contradictoires.
  const stillMissing: Association[] = []
  for (const want of unmatchedExpected) {
    const key = normalizeName(want.name)
    const found = remaining.findIndex((candidate) => normalizeName(candidate.name) === key)
    if (found === -1) {
      stillMissing.push(want)
      continue
    }
    const got = remaining[found]
    if (got) {
      pairs.push({ expected: want, submitted: got, sameEntities: false })
    }
    remaining.splice(found, 1)
  }

  for (const association of stillMissing) {
    differences.push({
      kind: 'association-missing',
      scope: `Association ${shown(association.name)}`,
      message: `L'association « ${shown(association.name)} » du corrigé ne se retrouve pas dans le rendu. À vérifier.`,
    })
  }
  for (const association of remaining) {
    counter.extras += 1
    differences.push({
      kind: 'association-extra',
      scope: `Association ${shown(association.name)}`,
      message: `L'association « ${shown(association.name)} » du rendu n'est pas au corrigé. Peut-être une lecture différente de l'énoncé.`,
    })
  }

  const matchedAssociations: MatchedPair[] = []
  for (const { expected: want, submitted: got, sameEntities } of pairs) {
    counter.matched += 1
    const scope = `Association ${shown(want.name)}`
    matchedAssociations.push({ expected: shown(want.name), submitted: shown(got.name) })

    if (!sameEntities) {
      counter.checks += 1
      const wantNames = want.legs
        .map((leg) => shown(expected.entities.find((entity) => entity.id === leg.entityId)?.name ?? ''))
        .join(', ')
      const gotNames = got.legs
        .map((leg) => shown(submitted.entities.find((entity) => entity.id === leg.entityId)?.name ?? ''))
        .join(', ')
      differences.push({
        kind: 'association-legs',
        scope,
        message: `Entités reliées : ${wantNames} au corrigé, ${gotNames} au rendu. À vérifier.`,
      })
    }

    compareAttributes(
      scope,
      resolveAttributes(expected, want.attributes),
      resolveAttributes(submitted, got.attributes),
      differences,
      counter,
    )
    compareLegs(scope, expected, want, submitted, got, differences, counter)
  }

  /* ------------------------------ Résumé ------------------------------ */

  // Un élément en trop n'entre pas dans la note : un modèle plus riche que
  // le corrigé peut être un choix valable, c'est au prof d'en juger.
  const suggestedGrade =
    counter.expected === 0
      ? null
      : Math.max(0, Math.round((20 * Math.max(0, counter.matched - counter.checks / 2)) / counter.expected * 10) / 10)

  return {
    matchedEntities,
    matchedAssociations,
    differences,
    summary: {
      expectedPoints: counter.expected,
      matchedPoints: counter.matched,
      checks: counter.checks,
      extras: counter.extras,
      suggestedGrade,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Textes partageables                                                 */

/** « 17,5 » : virgule décimale, entier sans décimale inutile. */
export function formatGrade(grade: number): string {
  return Number.isInteger(grade) ? String(grade) : grade.toFixed(1).replace('.', ',')
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`
}

/**
 * Résumé chiffré, à partager sans dévoiler le corrigé : il ne nomme
 * aucun élément attendu.
 */
export function comparisonSummaryText(comparison: Comparison): string {
  const { expectedPoints, matchedPoints, checks, extras } = comparison.summary
  const lines = [
    `Comparaison au corrigé : ${matchedPoints} éléments attendus retrouvés sur ${expectedPoints}.`,
  ]
  if (checks > 0) {
    lines.push(`${plural(checks, 'point à vérifier', 'points à vérifier')} sur ces éléments.`)
  }
  if (extras > 0) {
    lines.push(`${plural(extras, 'élément', 'éléments')} en plus du corrigé, ce qui peut être un choix valable.`)
  }
  lines.push('Ce relevé est indicatif : une différence n’est pas forcément une faute.')
  return lines.join('\n')
}

/** Relevé détaillé : il nomme les différences, donc une part du corrigé. */
export function comparisonDetailText(comparison: Comparison): string {
  const lines = [comparisonSummaryText(comparison), '']
  if (comparison.differences.length === 0) {
    lines.push('Aucune différence relevée avec le corrigé.')
    return lines.join('\n')
  }
  lines.push('Points à regarder :')
  let current = ''
  for (const difference of comparison.differences) {
    if (difference.scope !== current) {
      current = difference.scope
      lines.push(`${current} :`)
    }
    lines.push(`- ${difference.message}`)
  }
  return lines.join('\n')
}
