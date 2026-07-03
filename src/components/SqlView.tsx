import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { MpdTable, SqlDialect } from '../model/mpd'
import { mpdToSql, SQL_DIALECTS } from '../model/mpd'
import { saveFileAs } from '../lib/download'
import { EmptyGeneration, ErrorsBanner } from './GenerationNotices'

interface SqlViewProps {
  tables: MpdTable[] | null
  dialect: SqlDialect
  hasErrors: boolean
}

// Coloration légère : les mots-clés connus en accent, rien d'autre.
const SQL_KEYWORDS =
  /(DROP TABLE IF EXISTS|CREATE TABLE|ALTER TABLE|ADD CONSTRAINT|FOREIGN KEY|PRIMARY KEY|REFERENCES|NOT NULL|AUTO_INCREMENT|SERIAL)/g

function highlightSql(sql: string): ReactNode[] {
  return sql.split(SQL_KEYWORDS).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="font-semibold text-indigo-700">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

/**
 * Vue SQL : le script dérivé du MPD (donc du MCD + mappage + dialecte),
 * en lecture seule. On modifie le modèle, jamais le texte.
 */
export function SqlView({ tables, dialect, hasErrors }: SqlViewProps) {
  const [includeDrops, setIncludeDrops] = useState(true)
  const [copyStatus, setCopyStatus] = useState('')
  const dropsId = useId()

  const sql = useMemo(
    () => (tables ? mpdToSql(tables, dialect, { includeDrops }) : ''),
    [tables, dialect, includeDrops],
  )

  if (!tables) {
    return <EmptyGeneration viewName="SQL" />
  }

  const dialectLabel = SQL_DIALECTS.find((d) => d.id === dialect)?.label ?? dialect

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql)
      setCopyStatus('Script copié dans le presse-papiers.')
    } catch {
      setCopyStatus('Erreur : copie impossible dans ce navigateur.')
    }
  }

  const handleExport = async () => {
    const result = await saveFileAs('schema.sql', new Blob([sql], { type: 'application/sql' }), 'Script SQL', {
      'application/sql': ['.sql'],
    })
    if (result === 'cancelled') {
      setCopyStatus('Export annulé.')
    } else {
      setCopyStatus('Fichier .sql exporté.')
    }
  }

  return (
    <section aria-label="Vue SQL" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell"
        >
          Copier
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell"
        >
          Exporter en .sql
        </button>
        <label htmlFor={dropsId} className="flex items-center gap-1.5 text-xs text-zinc-700">
          <input
            id={dropsId}
            type="checkbox"
            checked={includeDrops}
            onChange={(event) => setIncludeDrops(event.target.checked)}
          />
          DROP TABLE IF EXISTS
        </label>
        <p className="text-xs text-zinc-600">
          Dialecte : <span className="font-mono">{dialectLabel}</span> (choisi dans la vue MPD)
        </p>
        <p role="status" aria-live="polite" className="text-xs text-zinc-600">
          {copyStatus}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {hasErrors && <ErrorsBanner />}
        <pre className="w-full overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-[13px] leading-6 shadow-sm">
          <code>{highlightSql(sql)}</code>
        </pre>
      </div>
    </section>
  )
}
