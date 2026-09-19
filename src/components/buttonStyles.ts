import { buttonClass } from './ui/buttonClass'

/**
 * Styles de boutons partagés par l'accueil et les écrans de compte,
 * tirés du composant Button. Chaque état de survol garde un texte
 * lisible sur son fond.
 */
export const primaryButtonClass = buttonClass({ variant: 'primary' })

export const secondaryButtonClass = buttonClass({ variant: 'secondary' })

export const smallButtonClass = buttonClass({ variant: 'secondary', size: 'sm' })
