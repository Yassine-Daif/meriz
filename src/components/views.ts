/**
 * Les vues de l'application, dans l'ordre pédagogique du rail :
 * dictionnaire des données, puis les trois niveaux Merise et le SQL.
 * La vue active est un simple état d'interface, jamais une donnée
 * du modèle.
 */
export type ViewId =
  | 'accueil'
  | 'dictionnaire'
  | 'mcd'
  | 'mld'
  | 'mpd'
  | 'sql'
  | 'apprendre'
  | 'apropos'

export interface ViewInfo {
  id: ViewId
  label: string
}

export const VIEWS: readonly ViewInfo[] = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'dictionnaire', label: 'Dictionnaire' },
  { id: 'mcd', label: 'MCD' },
  { id: 'mld', label: 'MLD' },
  { id: 'mpd', label: 'MPD' },
  { id: 'sql', label: 'SQL' },
]

/** Pied du rail : contenus distincts des vues de travail. */
export const FOOTER_VIEWS: readonly ViewInfo[] = [
  { id: 'apprendre', label: 'Apprendre' },
  { id: 'apropos', label: 'À propos' },
]
