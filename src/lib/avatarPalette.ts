import { t } from "../i18n/runtime"
/**
 * Paires de couleurs prêtes pour la pastille d'initiales. Elles suivent
 * la palette du serveur (config/profile.php), que l'API n'expose pas.
 * Chaque paire porte un nom lisible, qui sert de libellé au choix.
 */

export interface AvatarPair {
  /** Nom lisible, annoncé aux lecteurs d'écran. */
  label: string
  background: string
  text: string
}

export const AVATAR_PALETTE: readonly AvatarPair[] = [
  { get label() { return t("Parme") }, background: '#e0e7ff', get text() { return "#1e1b4b" } },
  { get label() { return t("Rose") }, background: '#fee2e2', get text() { return "#7f1d1d" } },
  { get label() { return t("Vert") }, background: '#dcfce7', get text() { return "#14532d" } },
  { get label() { return t("Ambre") }, background: '#fef3c7', get text() { return "#78350f" } },
  { get label() { return t("Ciel") }, background: '#e0f2fe', get text() { return "#0c4a6e" } },
  { get label() { return t("Violet") }, background: '#f3e8ff', get text() { return "#4c1d95" } },
  { get label() { return t("Framboise") }, background: '#ffe4e6', get text() { return "#881337" } },
  { get label() { return t("Turquoise") }, background: '#ccfbf1', get text() { return "#134e4a" } },
  { get label() { return t("Indigo") }, background: '#ede9fe', get text() { return "#312e81" } },
  { get label() { return t("Orchidée") }, background: '#fae8ff', get text() { return "#701a75" } },
]
