import type { ApiClient } from '../../lib/apiClient'
import type { LessonBlock } from '../../lib/lessonBlocks'
import { blockLabel, mediaIdOf } from '../../lib/lessonBlocks'
import type { LessonMedium } from '../../lib/lessonsApi'
import { KNOWN_PROVIDERS, resolveVideo } from '../../lib/videoEmbed'
import { FormField } from '../FormField'
import { Badge } from '../ui/Badge'
import { LessonBlockView } from './LessonPage'
import { MediaField } from './MediaField'

interface BlockCardProps {
  client: ApiClient
  lessonId: string
  block: LessonBlock
  /** Rang du bloc et taille de la page : dits à l'écran et aux lecteurs. */
  index: number
  total: number
  media: readonly LessonMedium[]
  onChange: (block: LessonBlock) => void
  onMove: (direction: 'up' | 'down') => void
  /** Boutons de déplacement confiés au parent, qui y remet le focus. */
  onRegisterMoveButton: (direction: 'up' | 'down', button: HTMLButtonElement | null) => void
  onRemove: () => void
  onUploaded: (medium: LessonMedium) => void
  onMediumGone: (mediumId: string) => void
}

const moveButtonClass =
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded-control border border-line-strong bg-surface text-ink transition-colors duration-150 hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Un bloc dans l'éditeur : ses champs, son aperçu tel qu'il sera vu, et
 * ses actions de déplacement et de retrait. Le rang du bloc figure dans
 * chaque libellé, pour que l'action reste claire au clavier.
 */
export function BlockCard({
  client,
  lessonId,
  block,
  index,
  total,
  media,
  onChange,
  onMove,
  onRegisterMoveButton,
  onRemove,
  onUploaded,
  onMediumGone,
}: BlockCardProps) {
  const position = `${index + 1} sur ${total}`
  const label = blockLabel(block.type)
  const mediaId = mediaIdOf(block)
  const medium = media.find((item) => item.id === mediaId) ?? null

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <Badge tone="neutral">{label}</Badge>
          <span className="text-xs text-ink-soft">Bloc {position}</span>
        </p>
        <div role="group" aria-label={`Ordre du bloc ${position}`} className="flex gap-1">
          <button
            type="button"
            ref={(element) => onRegisterMoveButton('up', element)}
            className={moveButtonClass}
            disabled={index === 0}
            aria-label={`Monter le bloc ${position}, ${label}`}
            title="Monter ce bloc"
            onClick={() => onMove('up')}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            ref={(element) => onRegisterMoveButton('down', element)}
            className={moveButtonClass}
            disabled={index === total - 1}
            aria-label={`Descendre le bloc ${position}, ${label}`}
            title="Descendre ce bloc"
            onClick={() => onMove('down')}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button
            type="button"
            className="inline-flex min-h-9 items-center rounded-control border border-danger bg-surface px-3 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
            aria-label={`Retirer le bloc ${position}, ${label}`}
            onClick={onRemove}
          >
            Retirer
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {block.type === 'heading' && (
          <FormField
            label="Titre de section"
            type="text"
            value={block.text}
            onChange={(text) => onChange({ type: 'heading', text })}
            autoComplete="off"
            maxLength={200}
          />
        )}

        {block.type === 'text' && (
          <FormField
            label="Texte"
            type="text"
            value={block.text}
            onChange={(text) => onChange({ type: 'text', text })}
            autoComplete="off"
            multiline
            rows={6}
            maxLength={5000}
            hint="Les retours à la ligne sont conservés."
          />
        )}

        {block.type === 'link' && (
          <>
            <FormField
              label="Adresse du lien"
              type="url"
              value={block.url}
              onChange={(url) => onChange({ type: 'link', url, label: block.label })}
              autoComplete="off"
              hint="Commence par https://"
            />
            <FormField
              label="Libellé"
              type="text"
              value={block.label}
              onChange={(text) => onChange({ type: 'link', url: block.url, label: text })}
              autoComplete="off"
              maxLength={200}
              required={false}
              hint="Ce que vos élèves liront. Vide, l'adresse s'affiche."
            />
          </>
        )}

        {block.type === 'video' && (
          <>
            <FormField
              label="Adresse de la vidéo"
              type="url"
              value={block.url}
              onChange={(url) => onChange({ type: 'video', url })}
              autoComplete="off"
              hint={`Intégrée pour ${KNOWN_PROVIDERS}. Ailleurs, elle s'affiche en lien.`}
            />
            {block.url.trim() !== '' && (
              <p className="text-xs text-ink-soft">
                {resolveVideo(block.url)
                  ? 'Cet hébergeur est reconnu : la vidéo sera intégrée à la page.'
                  : 'Hébergeur non reconnu : un lien sera affiché à la place du lecteur.'}
              </p>
            )}
          </>
        )}

        {block.type === 'image' && (
          <>
            <MediaField
              client={client}
              lessonId={lessonId}
              kind="image"
              medium={medium}
              onUploaded={onUploaded}
              onReplaced={onMediumGone}
            />
            <FormField
              label="Description de l'image"
              type="text"
              value={block.alt}
              onChange={(alt) => onChange({ type: 'image', mediaId: block.mediaId, alt })}
              autoComplete="off"
              maxLength={300}
              hint="Ce que voit quelqu'un qui n'a pas l'image : décrivez-la en une phrase."
            />
          </>
        )}

        {block.type === 'audio' && (
          <>
            <MediaField
              client={client}
              lessonId={lessonId}
              kind="audio"
              medium={medium}
              onUploaded={onUploaded}
              onReplaced={onMediumGone}
            />
            <FormField
              label="Libellé de l'audio"
              type="text"
              value={block.label}
              onChange={(text) => onChange({ type: 'audio', mediaId: block.mediaId, label: text })}
              autoComplete="off"
              maxLength={200}
              required={false}
              hint="Par exemple « Explication des cardinalités »."
            />
          </>
        )}

        {/* Aperçu : le bloc tel que la classe le verra. */}
        {(block.type === 'video' || block.type === 'image' || block.type === 'audio') && (
          <div className="rounded-card bg-surface-soft p-3">
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">Aperçu</p>
            <LessonBlockView client={client} lessonId={lessonId} block={block} />
          </div>
        )}
      </div>
    </li>
  )
}
