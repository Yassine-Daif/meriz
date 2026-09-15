import { useState } from 'react'
import type { MldTable } from '../model/mld'
import { relationalLine } from '../model/mld'
import { EmptyGeneration, ErrorsBanner } from './GenerationNotices'

interface MldViewProps {
  tables: MldTable[]
  hasErrors: boolean
}

/**
 * En-tête daté du MLDR, au format d'AnalyseSI. Le MLD dérive en direct
 * du MCD : la date est celle de l'affichage ou de la copie.
 */
function mldrHeader(date: Date): string {
  return `# Modèle créé le : ${date.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' })}`
}

/**
 * Vue MLD : le schéma relationnel dérivé du MCD (ce qu'AnalyseSI
 * nomme MLDR). Types conceptuels : le passage aux types SQL est
 * affiché au MPD.
 */
export function MldView({ tables, hasErrors }: MldViewProps) {
  const [copyStatus, setCopyStatus] = useState('')

  if (tables.length === 0) {
    return <EmptyGeneration viewName="MLD (modèle logique de données)" />
  }

  const handleCopy = async () => {
    const text = [mldrHeader(new Date()), ...tables.map(relationalLine)].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('Notation copiée dans le presse-papiers.')
    } catch {
      setCopyStatus('Erreur : copie impossible dans ce navigateur.')
    }
  }

  return (
    <section aria-label="Vue MLD" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell"
        >
          Copier la notation
        </button>
        <p className="text-xs text-zinc-600">
          {tables.length} table{tables.length > 1 ? 's' : ''} dérivée
          {tables.length > 1 ? 's' : ''} du MCD
        </p>
        <p role="status" aria-live="polite" className="text-xs text-zinc-600">
          {copyStatus}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {hasErrors && <ErrorsBanner />}
        <div className="flex flex-wrap items-start gap-4 pb-6">
          {tables.map((table) => (
            <div key={table.id} className="min-w-56 rounded-lg border border-zinc-300 bg-surface shadow-sm">
              <h2 className="rounded-t-lg border-b border-line bg-shell px-3 py-1.5 text-center text-sm font-semibold tracking-tight">
                {table.name}
              </h2>
              <ul className="px-3 py-2 font-mono text-xs leading-6">
                {table.columns.map((column) => (
                  <li key={column.id} className="flex items-baseline gap-2">
                    <span
                      className={
                        column.isPrimaryKey
                          ? 'font-medium underline decoration-indigo-700 underline-offset-2'
                          : ''
                      }
                    >
                      {column.name}
                    </span>
                    <span className="text-zinc-500">{column.type}</span>
                    {column.nullable && <span className="text-zinc-400">NULL</span>}
                    {column.isPrimaryKey && (
                      <span className="rounded-sm border border-indigo-200 bg-indigo-50 px-1 text-[10px] font-medium text-indigo-700">
                        PK
                      </span>
                    )}
                    {column.references && (
                      <span className="text-zinc-500">→ {column.references.tableName}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Le MLDR textuel d'AnalyseSI : en-tête daté en commentaire,
            puis la notation relationnelle, FK préfixées #. */}
        <div className="w-full rounded-lg border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight">Notation relationnelle (MLDR)</h2>
          <div className="mt-2 font-mono text-[13px] leading-7">
            <p className="text-zinc-500">{mldrHeader(new Date())}</p>
            <ul>
              {tables.map((table) => (
                <li key={table.id}>
                  {table.name} (
                  {table.columns.map((column, index) => (
                    <span key={column.id}>
                      {index > 0 && ', '}
                      <span
                        className={
                          column.isPrimaryKey
                            ? 'font-semibold underline decoration-indigo-700 underline-offset-2'
                            : column.references
                              ? 'text-indigo-700'
                              : ''
                        }
                      >
                        {column.references && '#'}
                        {column.name}
                      </span>
                    </span>
                  ))}
                  )
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
