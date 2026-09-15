/**
 * Vrai quand l'événement clavier vise un champ de saisie : les
 * raccourcis globaux (tout sélectionner, annuler, rétablir) laissent
 * alors le navigateur gérer la frappe.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return (
    target.nodeName === 'INPUT' ||
    target.nodeName === 'TEXTAREA' ||
    target.nodeName === 'SELECT' ||
    target.isContentEditable
  )
}
