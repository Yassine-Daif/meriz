/**
 * L'aide d'accessibilité de React Flow, en français.
 *
 * Sans cela, une interface entièrement française fait dire « Press enter
 * or space to select a node » à un lecteur d'écran. La bibliothèque pose
 * ces textes sur la zone de dessin et dans sa région d'annonces ; elle
 * accepte qu'on les remplace depuis la version 12.
 */
export const ARIA_LABELS = {
  'node.a11yDescription.default':
    'Entrée ou Espace pour sélectionner un bloc. Suppr pour le retirer, Échap pour annuler.',
  'node.a11yDescription.keyboardDisabled':
    'Entrée ou Espace pour sélectionner un bloc. Les flèches le déplacent ensuite. Suppr pour le retirer, Échap pour annuler.',
  'node.a11yDescription.ariaLiveMessage': ({
    direction,
    x,
    y,
  }: {
    direction: string
    x: number
    y: number
  }) => `Bloc déplacé vers ${direction}. Nouvelle position, x : ${x}, y : ${y}`,
  'edge.a11yDescription.default':
    'Entrée ou Espace pour sélectionner une patte. Suppr pour la retirer, Échap pour annuler.',
  'controls.ariaLabel': 'Commandes de la zone de dessin',
  'controls.zoomIn.ariaLabel': 'Agrandir',
  'controls.zoomOut.ariaLabel': 'Réduire',
  'controls.fitView.ariaLabel': 'Ajuster à la fenêtre',
  'controls.interactive.ariaLabel': "Verrouiller ou déverrouiller l'interaction",
  'minimap.ariaLabel': 'Vue d’ensemble',
  'handle.ariaLabel': 'Point de liaison',
}
