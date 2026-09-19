/**
 * Initiales d'une personne, pour sa pastille : première lettre du
 * prénom et première lettre du nom. Sans prénom, les deux premières
 * lettres du nom. Sans rien de lisible, un point d'interrogation.
 */

/** Premiers caractères lisibles, accents et écritures non latines compris. */
function letters(value: string | null | undefined, count: number): string[] {
  const trimmed = (value ?? '').trim()
  if (trimmed === '') return []
  // Array.from découpe par caractère Unicode, jamais au milieu d'un
  // couple de substitution.
  return Array.from(trimmed)
    .filter((letter) => letter.trim() !== '')
    .slice(0, count)
}

export function initials(person: { firstName: string | null; name: string }): string {
  const first = letters(person.firstName, 1)
  const last = letters(person.name, first.length === 0 ? 2 : 1)
  const chosen = [...first, ...last].slice(0, 2)
  return chosen.length === 0 ? '?' : chosen.join('').toLocaleUpperCase('fr-FR')
}
