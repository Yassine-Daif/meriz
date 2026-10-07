import { buildCodeSchema } from './codeSchema'
import type { FrameworkId, GeneratedFile } from './codegenTypes'
import { laravelFiles } from './laravel'
import type { Mcd } from './mcd'
import type { MldTable } from './mld'
import type { MpdSettings } from './mpd'
import { symfonyFiles } from './symfony'

/**
 * Le code de données d'un framework, dérivé du MCD.
 *
 * Les relations viennent des cardinalités du MCD, les types viennent du
 * MPD : le dialecte et les surcharges choisis dans la vue MPD se
 * retrouvent donc dans le code produit. Rien n'est écrit sur disque ici,
 * c'est la vue qui propose la copie.
 */

export type { FrameworkId, GeneratedFile } from './codegenTypes'
export { FRAMEWORKS } from './codegenTypes'

export function generateFiles(
  framework: FrameworkId,
  mcd: Mcd,
  tables: MldTable[],
  settings: MpdSettings,
): GeneratedFile[] {
  const schema = buildCodeSchema(mcd, tables, settings)
  return framework === 'laravel' ? laravelFiles(schema) : symfonyFiles(schema, settings.dialect)
}

/** Tous les fichiers en un seul texte, chacun annoncé par son chemin. */
export function concatFiles(files: GeneratedFile[]): string {
  return files
    .map((file) => `/* ===== ${file.path} ===== */\n\n${file.content.trim()}\n`)
    .join('\n')
}

/** Les fichiers en Markdown, un bloc de code par fichier. */
export function filesToMarkdown(files: GeneratedFile[], title: string): string {
  const blocks = files.map((file) => `### ${file.path}\n\n\`\`\`php\n${file.content.trim()}\n\`\`\`\n`)
  return [`# ${title}`, '', ...blocks].join('\n')
}
