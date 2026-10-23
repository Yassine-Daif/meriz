import { useToast } from './ui/toastContext'
import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { useMemo, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { saveFileAs } from '../lib/download'
import { concatFiles, filesToMarkdown, FRAMEWORKS, generateFiles } from '../model/codegen'
import type { FrameworkId } from '../model/codegen'
import type { Mcd } from '../model/mcd'
import type { MldTable } from '../model/mld'
import type { MpdSettings } from '../model/mpd'
import { EmptyGeneration, ErrorsBanner } from './GenerationNotices'
import { Button } from './ui/Button'
import { MoreInfo } from './ui/MoreInfo'
import { Notice } from './ui/Notice'
import { Segmented } from './ui/Segmented'

interface CodeViewProps {
  mcd: Mcd
  tables: MldTable[]
  settings: MpdSettings
  hasErrors: boolean
}

/**
 * Vue Code : les fichiers de données du framework choisi, dérivés du
 * MCD et du MPD. Chaque fichier porte son chemin de destination et se
 * copie seul ; rien ne s'écrit sur disque sans le dire.
 */
export function CodeView({ mcd, tables, settings, hasErrors }: CodeViewProps) {
  const locale = useLanguage()
  const [framework, setFramework] = useState<FrameworkId>('laravel')
  const setStatus = useToast()

  const files = useMemo(
    () => { void locale; return generateFiles(framework, mcd, tables, settings) },
    [framework, mcd, tables, settings, locale],
  )

  if (tables.length === 0) {
    return <EmptyGeneration viewName="Code" />
  }

  const label = FRAMEWORKS.find((candidate) => candidate.id === framework)?.label ?? framework

  const copy = async (text: string, success: string) => {
    const copied = await copyText(text)
    setStatus({ kind: copied ? 'info' : 'error', text: copied ? success : t("Erreur : copie impossible dans ce navigateur.") })
  }

  const handleExport = async () => {
    const result = await saveFileAs(
      `${framework}.md`,
      new Blob([filesToMarkdown(files, t("Code {0} généré par Meriz", [label]))], { type: 'text/markdown' }),
      t("Code généré"),
      { 'text/markdown': ['.md'] },
    )
    setStatus(result === 'cancelled' ? t("Export annulé.") : t("Fichiers exportés en .md."))
  }

  return (
    <section aria-label={t("Vue Code")} className="flex min-h-0 min-w-0 flex-1 flex-col [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <Segmented
          legend={t("Framework cible")}
          hideLegend
          size="sm"
          options={FRAMEWORKS.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
          value={framework}
          onChange={setFramework}
        />
        <Button size="sm" onClick={() => void copy(concatFiles(files), t("Tous les fichiers copiés dans le presse-papiers."))}>
          {t("Copier tout")}</Button>
        <Button size="sm" onClick={() => void handleExport()}>
          {t("Exporter en .md")}</Button>
        <p className="text-xs text-ink-soft">
          {files.length === 1 ? t("1 fichier généré pour ") : t("{0} fichiers générés pour ", [files.length])}
          <span className="font-mono">{label}</span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {hasErrors && <ErrorsBanner />}

        <Notice
          tone="info"
          announce={false}
          title={t("Meriz pose les fondations de votre base")}
          className="mb-4"
        >
          <p>
            <strong className="font-semibold">{t("Ce que Meriz écrit pour vous.")}</strong> {t(" La structure de la base de données : les tables, leurs colonnes et les liens entre elles, écrits aux conventions de votre framework. Chaque fichier porte le dossier où le copier dans votre projet.")}</p>
          <p className="mt-1.5">
            <strong className="font-semibold">{t("Ce qui reste à vous.")}</strong> {t(" Ce que votre application fait vraiment : vos règles de gestion, les vérifications des données saisies et les tests. Les fondations sont posées, vous construisez dessus. Relisez le code avant de vous en servir.")}</p>

          <MoreInfo summary={t("À savoir, si vous voulez creuser")}>
            <p>
              {t("Les noms suivent les habitudes du framework : tables au pluriel, colonnes en minuscules avec des tirets bas, classes avec une majuscule à chaque mot. Ils peuvent donc différer du script de la vue SQL. La mise au pluriel suit le français courant, elle rate les mots rares.")}</p>
            <p>
              {t("Les migrations Laravel ajoutent deux colonnes de dates, created_at et updated_at, que le framework tient à jour tout seul.")}</p>
            <p>
              {t("Quand un identifiant tient sur deux colonnes, Laravel ne sait pas suivre le lien tout seul : la relation est laissée en commentaire dans le modèle, à écrire à la main.")}</p>
            <p>
              {t("La migration Symfony porte une date figée dans son nom. Renommez le fichier avec la date du jour avant de l’ajouter à un projet qui a déjà des migrations.")}</p>
          </MoreInfo>
        </Notice>

        <ul className="flex flex-col gap-4">
          {files.map((file) => (
            <li key={file.path} className="rounded-card border border-line bg-surface shadow-soft">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                <span className="font-mono text-xs text-ink">{file.path}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => void copy(file.content, t("{0} copié dans le presse-papiers.", [file.path]))}
                  aria-label={t("Copier {0}", [file.path])}
                >
                  {t("Copier")}</Button>
              </div>
              <pre
                tabIndex={0}
                role="region"
                aria-label={t("Contenu de {0}", [file.path])}
                className="max-h-96 overflow-auto px-4 py-3 font-mono text-micro leading-6"
              >
                <code>{file.content}</code>
              </pre>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
