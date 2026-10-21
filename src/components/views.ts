import { t } from "../i18n/runtime"
/**
 * Les vues de l'éditeur, dans l'ordre pédagogique du rail :
 * dictionnaire des données, puis les trois niveaux Merise, le SQL et le
 * code de framework.
 * La vue active est un simple état d'interface, jamais une donnée
 * du modèle. L'accueil (liste des documents) est hors de l'éditeur.
 */
export type ViewId =
  | 'dictionnaire'
  | 'mcd'
  | 'mld'
  | 'mpd'
  | 'sql'
  | 'code'
  | 'apprendre'
  | 'apropos'

export interface ViewInfo {
  id: ViewId
  label: string
}

export const VIEWS: readonly ViewInfo[] = [
  { id: 'dictionnaire', get label() { return t("Dictionnaire") } },
  { id: 'mcd', get label() { return t("MCD") } },
  { id: 'mld', get label() { return t("MLD") } },
  { id: 'mpd', get label() { return t("MPD") } },
  { id: 'sql', get label() { return t("SQL") } },
  { id: 'code', get label() { return t("Code") } },
]

/** Pied du rail : contenus distincts des vues de travail. */
export const FOOTER_VIEWS: readonly ViewInfo[] = [
  { id: 'apprendre', get label() { return t("Apprendre") } },
  { id: 'apropos', get label() { return t("À propos") } },
]
