import type { ApiClient } from '../../lib/apiClient'
import type { LessonBlock } from '../../lib/lessonBlocks'
import { mediaIdOf } from '../../lib/lessonBlocks'
import { ExternalLink } from './blocks/ExternalLink'
import { AudioBlock, ImageBlock } from './blocks/MediaBlocks'
import { VideoBlock } from './blocks/VideoBlock'

interface LessonPageProps {
  client: ApiClient
  lessonId: string
  blocks: readonly LessonBlock[]
}

/**
 * La page d'un cours, telle qu'elle se lit : les blocs dans leur ordre,
 * sans aucune action. Sert aussi bien à l'élève qu'à l'aperçu du prof.
 */
export function LessonPage({ client, lessonId, blocks }: LessonPageProps) {
  if (blocks.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
        Ce cours est encore vide.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => (
        <LessonBlockView key={index} client={client} lessonId={lessonId} block={block} />
      ))}
    </div>
  )
}

interface LessonBlockViewProps {
  client: ApiClient
  lessonId: string
  block: LessonBlock
}

/** Un bloc, rendu selon son type. */
export function LessonBlockView({ client, lessonId, block }: LessonBlockViewProps) {
  switch (block.type) {
    case 'heading':
      return <h4 className="mt-2 text-lg font-semibold tracking-tight text-ink">{block.text}</h4>
    case 'text':
      // Les retours à la ligne saisis par le prof sont conservés.
      return <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{block.text}</p>
    case 'link':
      return (
        <p className="text-sm text-ink">
          <ExternalLink url={block.url} label={block.label} />
        </p>
      )
    case 'video':
      return <VideoBlock url={block.url} />
    case 'image':
      return <ImageBlock client={client} lessonId={lessonId} mediaId={mediaIdOf(block)} alt={block.alt} />
    case 'audio':
      return <AudioBlock client={client} lessonId={lessonId} mediaId={mediaIdOf(block)} label={block.label} />
  }
}
