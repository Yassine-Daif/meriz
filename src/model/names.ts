/**
 * Noms de code : passage d'un nom du MCD aux conventions d'un
 * framework. Une entité « Ligne commande » devient la classe
 * `LigneCommande`, la table `ligne_commandes`, la propriété
 * `ligneCommande`.
 *
 * Deux limites, assumées et dites à l'utilisateur. On ne singularise
 * jamais : deviner le singulier français d'un mot écrit par l'auteur du
 * modèle est bien plus risqué que le pluriel, donc une entité nommée
 * « Clients » garde sa classe `Clients`. Et la mise au pluriel suit les
 * règles courantes du français, sans dictionnaire : elle rate les
 * irréguliers rares.
 */

/** Retire les accents, sans toucher au reste. */
export function deburr(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Découpe un nom en mots. Les séparateurs et les majuscules comptent,
 * les chiffres restent collés au mot qui précède : « adresse2 » reste un
 * seul mot.
 */
export function words(name: string): string[] {
  return deburr(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word !== '')
}

/**
 * Mots réservés de PHP qui ne peuvent pas nommer une classe. La liste
 * est fermée : on préfixe d'un tiret bas plutôt que de produire un
 * fichier qui ne compile pas.
 */
const PHP_RESERVED = new Set([
  'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone',
  'const', 'continue', 'declare', 'default', 'do', 'echo', 'else', 'elseif', 'empty',
  'enddeclare', 'endfor', 'endforeach', 'endif', 'endswitch', 'endwhile', 'enum', 'extends',
  'final', 'finally', 'fn', 'for', 'foreach', 'function', 'global', 'goto', 'if', 'implements',
  'include', 'instanceof', 'insteadof', 'interface', 'isset', 'list', 'match', 'namespace',
  'new', 'or', 'print', 'private', 'protected', 'public', 'readonly', 'require', 'return',
  'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use', 'var', 'while', 'xor', 'yield',
  'bool', 'float', 'int', 'iterable', 'mixed', 'never', 'null', 'object', 'parent', 'self',
  'string', 'true', 'false', 'void',
])

/** Un identifiant PHP ne commence pas par un chiffre, ni par rien. */
function guard(name: string, fallback: string): string {
  if (name === '') return fallback
  if (/^[0-9]/.test(name)) return `_${name}`
  return PHP_RESERVED.has(name.toLowerCase()) ? `_${name}` : name
}

export function toSnakeCase(name: string): string {
  return guard(words(name).join('_').toLowerCase(), 'sans_nom')
}

export function toCamelCase(name: string): string {
  const parts = words(name)
  const joined = parts
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
  return guard(joined, 'sansNom')
}

export function toPascalCase(name: string): string {
  const joined = words(name)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
  return guard(joined, 'SansNom')
}

/* ------------------------------------------------------------------ */
/* Pluriel français                                                    */

/** En « eu » et « au » mais pluriel en « s ». */
const PLURAL_S_EU = new Set(['pneu', 'bleu', 'landau', 'sarrau', 'emeu'])
/** En « al » mais pluriel en « s ». */
const PLURAL_S_AL = new Set([
  'bal', 'carnaval', 'festival', 'recital', 'chacal', 'regal', 'cal', 'narval', 'aval', 'serval',
])
/** En « ail » et pluriel en « aux ». La liste est fermée. */
const PLURAL_AUX_AIL = new Set(['travail', 'bail', 'corail', 'vitrail', 'soupirail', 'vantail', 'email_ancien'])
/** En « ou » et pluriel en « oux ». La liste est fermée. */
const PLURAL_OUX = new Set(['bijou', 'caillou', 'chou', 'genou', 'hibou', 'joujou', 'pou'])

/**
 * Met un mot au pluriel, selon les règles courantes du français. Le mot
 * est déjà sans accent et en minuscules.
 *
 * Un mot qui finit par « s », « x » ou « z » ne bouge pas : cela couvre
 * « cours », « prix », et les noms déjà écrits au pluriel.
 */
export function pluralize(word: string): string {
  if (word === '') return word
  if (/[sxz]$/.test(word)) return word
  if (PLURAL_OUX.has(word)) return `${word}x`
  if (PLURAL_AUX_AIL.has(word)) return `${word.slice(0, -3)}aux`
  if (word.endsWith('al') && !PLURAL_S_AL.has(word)) return `${word.slice(0, -2)}aux`
  if (/(eau|au|eu)$/.test(word) && !PLURAL_S_EU.has(word)) return `${word}x`
  return `${word}s`
}

/** Nom de table d'une entité : au pluriel, en snake_case. */
export function toPluralSnakeCase(name: string): string {
  const parts = words(name).map((word) => word.toLowerCase())
  if (parts.length === 0) return 'sans_noms'
  const last = parts[parts.length - 1] as string
  return guard([...parts.slice(0, -1), pluralize(last)].join('_'), 'sans_noms')
}

/** Nom libre dans un jeu déjà pris : suffixe numérique au besoin. */
export function uniqueName(base: string, used: Set<string>): string {
  const key = base.toLowerCase()
  if (!used.has(key)) {
    used.add(key)
    return base
  }
  let index = 2
  while (used.has(`${key}${index}`)) {
    index += 1
  }
  used.add(`${key}${index}`)
  return `${base}${index}`
}
