/**
 * Un fichier prêt à copier dans un projet : son chemin de destination,
 * et son contenu. C'est tout ce que les générateurs ont à produire.
 */
export interface GeneratedFile {
  /** Chemin relatif à la racine du projet, par exemple `app/Models/Client.php`. */
  path: string
  content: string
}

export type FrameworkId = 'laravel' | 'symfony'

export const FRAMEWORKS: readonly { id: FrameworkId; label: string }[] = [
  { id: 'laravel', label: 'Laravel' },
  { id: 'symfony', label: 'Symfony' },
]
