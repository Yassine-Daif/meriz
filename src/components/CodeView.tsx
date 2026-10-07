import { useMemo, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { saveFileAs } from '../lib/download'
import { concatFiles, filesToMarkdown, FRAMEWORKS, generateFiles } from '../model/codegen'
import type { FrameworkId } from '../model/codegen'
import type { Mcd } from '../model/mcd'
import type { MldTable } from '../model/mld'
import type { MpdSettings } from '../model/mpd'
import { EmptyGeneration, ErrorsBanner } from './GenerationNotices'
import { MoreInfo } from './ui/MoreInfo'
import { Notice } from './ui/Notice'
import { Segmented } from './ui/Segmented'

interface CodeViewProps {
  mcd: Mcd
  tables: MldTable[]
  settings: MpdSettings
  hasErrors: boolean
}

const buttonClass = 'rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell'

/**
 * Vue Code : les fichiers de données du framework choisi, dérivés du
 * MCD et du MPD. Chaque fichier porte son chemin de destination et se
 * copie seul ; rien ne s'écrit sur disque sans le dire.
 */
export function CodeView({ mcd, tables, settings, hasErrors }: CodeViewProps) {
  const [framework, setFramework] = useState<FrameworkId>('laravel')
  const [status, setStatus] = useState('')

  const files = useMemo(
    () => generateFiles(framework, mcd, tables, settings),
    [framework, mcd, tables, settings],
  )

  if (tables.length === 0) {
    return <EmptyGeneration viewName="Code" />
  }

  const label = FRAMEWORKS.find((candidate) => candidate.id === framework)?.label ?? framework

  const copy = async (text: string, success: string) => {
    const copied = await copyText(text)
    setStatus(copied ? success : 'Erreur : copie impossible dans ce navigateur.')
  }

  const handleExport = async () => {
    const result = await saveFileAs(
      `${framework}.md`,
      new Blob([filesToMarkdown(files, `Code ${label} généré par Meriz`)], { type: 'text/markdown' }),
      'Code généré',
      { 'text/markdown': ['.md'] },
    )
    setStatus(result === 'cancelled' ? 'Export annulé.' : 'Fichiers exportés en .md.')
  }

  return (
    <section aria-label="Vue Code" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <Segmented
          legend="Framework cible"
          hideLegend
          size="sm"
          options={FRAMEWORKS.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
          value={framework}
          onChange={setFramework}
        />
        <button type="button" onClick={() => void copy(concatFiles(files), 'Tous les fichiers copiés dans le presse-papiers.')} className={buttonClass}>
          Copier tout
        </button>
        <button type="button" onClick={() => void handleExport()} className={buttonClass}>
          Exporter en .md
        </button>
        <p className="text-xs text-ink-soft">
          {files.length === 1 ? '1 fichier généré pour ' : `${files.length} fichiers générés pour `}
          <span className="font-mono">{label}</span>
        </p>
        <p role="status" aria-live="polite" className="text-xs text-ink-soft">
          {status}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {hasErrors && <ErrorsBanner />}

        <Notice
          tone="info"
          announce={false}
          title="Meriz pose les fondations de votre base"
          className="mb-4"
        >
          <p>
            <strong className="font-semibold">Ce que Meriz écrit pour vous.</strong> La structure de la
            base de données : les tables, leurs colonnes et les liens entre elles, écrits aux conventions de
            votre framework. Chaque fichier porte le dossier où le copier dans votre projet.
          </p>
          <p className="mt-1.5">
            <strong className="font-semibold">Ce qui reste à vous.</strong> Ce que votre application fait
            vraiment : vos règles de gestion, les vérifications des données saisies et les tests. Les
            fondations sont posées, vous construisez dessus. Relisez le code avant de vous en servir.
          </p>

          <MoreInfo summary="À savoir, si vous voulez creuser">
            <p>
              Les noms suivent les habitudes du framework : tables au pluriel, colonnes en minuscules avec
              des tirets bas, classes avec une majuscule à chaque mot. Ils peuvent donc différer du script
              de la vue SQL. La mise au pluriel suit le français courant, elle rate les mots rares.
            </p>
            <p>
              Les migrations Laravel ajoutent deux colonnes de dates, created_at et updated_at, que le
              framework tient à jour tout seul.
            </p>
            <p>
              Quand un identifiant tient sur deux colonnes, Laravel ne sait pas suivre le lien tout seul :
              la relation est laissée en commentaire dans le modèle, à écrire à la main.
            </p>
            <p>
              La migration Symfony porte une date figée dans son nom. Renommez le fichier avec la date du
              jour avant de l’ajouter à un projet qui a déjà des migrations.
            </p>
          </MoreInfo>
        </Notice>

        <ul className="flex flex-col gap-4">
          {files.map((file) => (
            <li key={file.path} className="rounded-card border border-line bg-surface shadow-soft">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                <span className="font-mono text-xs text-ink">{file.path}</span>
                <button
                  type="button"
                  onClick={() => void copy(file.content, `${file.path} copié dans le presse-papiers.`)}
                  aria-label={`Copier ${file.path}`}
                  className="ml-auto rounded-control px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-soft hover:text-accent-ink"
                >
                  Copier
                </button>
              </div>
              <pre className="max-h-96 overflow-auto px-4 py-3 font-mono text-[13px] leading-6">
                <code>{file.content}</code>
              </pre>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
