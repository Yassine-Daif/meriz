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
  { id: 'dictionnaire', label: 'Dictionnaire' },
  { id: 'mcd', label: 'MCD' },
  { id: 'mld', label: 'MLD' },
  { id: 'mpd', label: 'MPD' },
  { id: 'sql', label: 'SQL' },
  { id: 'code', label: 'Code' },
]

/** Pied du rail : contenus distincts des vues de travail. */
export const FOOTER_VIEWS: readonly ViewInfo[] = [
  { id: 'apprendre', label: 'Apprendre' },
  { id: 'apropos', label: 'À propos' },
]
