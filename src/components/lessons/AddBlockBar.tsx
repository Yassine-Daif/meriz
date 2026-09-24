import type { BlockType } from '../../lib/lessonBlocks'
import { BLOCK_TYPES, blockLabel } from '../../lib/lessonBlocks'
import { Button } from '../ui/Button'

interface AddBlockBarProps {
  onAdd: (type: BlockType) => void
}

/** Ajout d'un bloc, un bouton par type, dans l'ordre de la page. */
export function AddBlockBar({ onAdd }: AddBlockBarProps) {
  return (
    <div role="group" aria-label="Ajouter un bloc" className="flex flex-wrap gap-2">
      {BLOCK_TYPES.map((type) => (
        <Button key={type} size="sm" onClick={() => onAdd(type)}>
          <span aria-hidden="true">+</span>
          {blockLabel(type)}
        </Button>
      ))}
    </div>
  )
}
