import { plural } from './plural'

/**
 * Recherche par nom dans une liste, en direct, sans appel au serveur :
 * les classes comme les groupes arrivent entiers, sans pagination.
 *
 * Le pli retire les accents, passe en minuscules et réduit les suites
 * d'espaces à une seule. Il garde les séparateurs, contrairement à
 * `normalizeName` du modèle, qui les supprime tous pour apparier des
 * noms Merise : là-bas « a b c » vaut « abc », ce qui serait faux ici.
 * Une classe « BUT 2 SI » se trouve donc en tapant « but 2 », mais pas
 * en tapant « but2 ».
 */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Le nom contient-il la recherche ? Par inclusion, pas par préfixe : on
 * se souvient souvent d'un mot du milieu, « seconde » dans « Groupe de
 * seconde B ». Une recherche vide accepte tout.
 */
export function matchesName(name: string, query: string): boolean {
  const wanted = foldForSearch(query)
  return wanted === '' || foldForSearch(name).includes(wanted)
}

/**
 * Les entrées dont le nom correspond, dans leur ordre d'origine. Le
 * tableau reçu n'est jamais modifié.
 */
export function filterByName<T extends { name: string }>(items: readonly T[], query: string): T[] {
  return items.filter((item) => matchesName(item.name, query))
}

/** « 3 classes sur 12 », ou le compte seul quand rien n'est filtré. */
export function searchCountLabel(shown: number, total: number, one: string, many: string): string {
  if (shown >= total) {
    return `${total} ${plural(total, one, many)}`
  }
  return `${shown} ${plural(shown, one, many)} sur ${total}`
}
