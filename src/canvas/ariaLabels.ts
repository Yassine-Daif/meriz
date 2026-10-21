import { t } from "../i18n/runtime"
/**
 * L'aide d'accessibilité de React Flow, en français.
 *
 * Sans cela, une interface entièrement française fait dire « Press enter
 * or space to select a node » à un lecteur d'écran. La bibliothèque pose
 * ces textes sur la zone de dessin et dans sa région d'annonces ; elle
 * accepte qu'on les remplace depuis la version 12.
 */
export const ARIA_LABELS = {
  get 'node.a11yDescription.default'() { return t("Entrée ou Espace pour sélectionner un bloc. Suppr pour le retirer, Échap pour annuler.") },
  get 'node.a11yDescription.keyboardDisabled'() { return t("Entrée ou Espace pour sélectionner un bloc. Les flèches le déplacent ensuite. Suppr pour le retirer, Échap pour annuler.") },
  'node.a11yDescription.ariaLiveMessage': ({
    direction,
    x,
    y,
  }: {
    direction: string
    x: number
    y: number
  }) => t("Bloc déplacé vers {0}. Nouvelle position, x : {1}, y : {2}", [direction, x, y]),
  get 'edge.a11yDescription.default'() { return t("Entrée ou Espace pour sélectionner une patte. Suppr pour la retirer, Échap pour annuler.") },
  get 'controls.ariaLabel'() { return t("Commandes de la zone de dessin") },
  get 'controls.zoomIn.ariaLabel'() { return t("Agrandir") },
  get 'controls.zoomOut.ariaLabel'() { return t("Réduire") },
  get 'controls.fitView.ariaLabel'() { return t("Ajuster à la fenêtre") },
  get 'controls.interactive.ariaLabel'() { return t("Verrouiller ou déverrouiller l'interaction") },
  get 'minimap.ariaLabel'() { return t("Vue d’ensemble") },
  get 'handle.ariaLabel'() { return t("Point de liaison") },
}
