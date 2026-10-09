/**
 * Allure d'une fenêtre modale : le `<dialog>` natif, centré, posé sur un
 * voile sombre. Le voile reprend `--c-shadow`, la teinte des ombres, donc
 * il se réchauffe en clair et reste noir en sombre.
 *
 * Deux dialogues l'emploient, avec deux largeurs. Le reste est commun, et
 * tenu ici pour qu'une retouche de forme ne se fasse pas à deux endroits.
 */
const DIALOG_BASE =
  'm-auto w-[calc(100%-2rem)] rounded-card border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-[rgb(var(--c-shadow)/0.45)]'

/** Classes du `<dialog>`, pour une largeur maximale donnée. */
export function dialogClass(width: 'sm' | 'md'): string {
  return `${DIALOG_BASE} ${width === 'sm' ? 'max-w-sm' : 'max-w-md'}`
}
