import type { BlockType } from '../../lib/lessonBlocks'
import { BLOCK_TYPES, blockLabel } from '../../lib/lessonBlocks'

/*
 * Le texte visible tient en un mot, « Texte », « Image ». Le nom lu,
 * lui, porte le verbe : le groupe le dit déjà, mais tous les lecteurs
 * d'écran n'annoncent pas le groupe avant chaque bouton.
 */
const ADD_LABELS: Record<BlockType, string> = {
  heading: 'Ajouter un titre de section',
  text: 'Ajouter un texte',
  link: 'Ajouter un lien',
  video: 'Ajouter une vidéo',
  image: 'Ajouter une image',
  audio: 'Ajouter un audio',
}

function addLabel(type: BlockType): string {
  return ADD_LABELS[type]
}
import { Button } from '../ui/Button'

interface AddBlockBarProps {
  onAdd: (type: BlockType) => void
}

/** Ajout d'un bloc, un bouton par type, dans l'ordre de la page. */
export function AddBlockBar({ onAdd }: AddBlockBarProps) {
  return (
    <div role="group" aria-label="Ajouter un bloc" className="flex flex-wrap gap-2">
      {BLOCK_TYPES.map((type) => (
        <Button key={type} size="sm" aria-label={addLabel(type)} onClick={() => onAdd(type)}>
          <span aria-hidden="true">+</span>
          {blockLabel(type)}
        </Button>
      ))}
    </div>
  )
}
