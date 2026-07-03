import { Fragment, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { applyNodeChanges, Background, Panel, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import type { NodeChange } from '@xyflow/react'
import type { MpdSettings, MpdTable, SqlDialect } from '../model/mpd'
import { SQL_DIALECTS } from '../model/mpd'
import { TableNode } from '../canvas/TableNode'
import type { TableFlowNode } from '../canvas/TableNode'
import { buildFkEdges, initialTableNodes } from '../canvas/mldToFlow'
import { EmptyGeneration, ErrorsBanner } from './GenerationNotices'

const nodeTypes = { table: TableNode }

interface MpdViewProps {
  tables: MpdTable[] | null
  hasErrors: boolean
  settings: MpdSettings
  onDialectChange: (dialect: SqlDialect) => void
  onOverrideChange: (columnId: string, value: string) => void
}

/**
 * Vue MPD : le schéma physique en diagramme (tables typées SQL,
 * flèches de clés étrangères) plus le mappage des types, éditable
 * par colonne et mémorisé. La structure reste dérivée du MCD, seuls
 * le dialecte et les surcharges de types sont mémorisés.
 */
export function MpdView({ tables, hasErrors, settings, onDialectChange, onOverrideChange }: MpdViewProps) {
  const dialectSelectId = useId()
  const mappingPanelId = useId()
  const [mappingOpen, setMappingOpen] = useState(true)
  if (!tables) {
    return <EmptyGeneration viewName="MPD (modèle physique de données)" />
  }
  return (
    <section aria-label="Vue MPD" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <label htmlFor={dialectSelectId} className="text-xs font-medium text-zinc-600">
          Dialecte SQL
        </label>
        <select
          id={dialectSelectId}
          value={settings.dialect}
          onChange={(event) => onDialectChange(event.target.value as SqlDialect)}
          className="rounded border border-zinc-300 px-1.5 py-1 font-mono text-xs"
        >
          {SQL_DIALECTS.map((dialect) => (
            <option key={dialect.id} value={dialect.id}>
              {dialect.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-expanded={mappingOpen}
          aria-controls={mappingPanelId}
          onClick={() => setMappingOpen((open) => !open)}
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell"
        >
          <span aria-hidden="true" className="text-zinc-500">
            {mappingOpen ? '▸' : '◂'}
          </span>
          Mappage des types
        </button>
        <p className="text-xs text-zinc-600">
          Types éditables colonne par colonne, choix mémorisés.
        </p>
      </div>
      <div className="flex min-h-0 flex-1">
        <MpdDiagram tables={tables} hasErrors={hasErrors} />
        {mappingOpen && (
          <TypeMappingPanel
            panelId={mappingPanelId}
            tables={tables}
            onOverrideChange={onOverrideChange}
          />
        )}
      </div>
    </section>
  )
}

function MpdDiagram({ tables, hasErrors }: { tables: MpdTable[]; hasErrors: boolean }) {
  const [nodes, setNodes] = useState<TableFlowNode[]>(() => initialTableNodes(tables))

  // Le MPD suit le MCD : les tables connues gardent leur position,
  // les nouvelles prennent la grille par défaut.
  useEffect(() => {
    setNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]))
      return initialTableNodes(tables).map((node) => {
        const existing = byId.get(node.id)
        return existing ? { ...node, position: existing.position } : node
      })
    })
  }, [tables])

  const onNodesChange = useCallback((changes: NodeChange<TableFlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const edges = useMemo(() => buildFkEdges(tables, nodes), [tables, nodes])

  return (
    <div className="min-h-0 flex-1 bg-canvas">
      <ReactFlowProvider>
        <ReactFlow<TableFlowNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          nodesConnectable={false}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        >
          <Background gap={16} />
          {hasErrors && (
            <Panel position="top-left">
              <ErrorsBanner />
            </Panel>
          )}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

/**
 * Mappage des types : type conceptuel → type SQL éditable par colonne.
 * Colonne latérale repliable, à droite du diagramme.
 */
function TypeMappingPanel({
  panelId,
  tables,
  onOverrideChange,
}: {
  panelId: string
  tables: MpdTable[]
  onOverrideChange: (columnId: string, value: string) => void
}) {
  return (
    <section
      id={panelId}
      aria-label="Mappage des types"
      className="w-1/2 shrink-0 overflow-auto border-l border-line bg-surface p-4"
    >
      <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-line text-sm shadow-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            {['Colonne', 'Type conceptuel', 'Type SQL'].map((label) => (
              <th
                key={label}
                scope="col"
                className="border-b border-line bg-shell px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tables.map((table) => (
            <Fragment key={table.id}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={3}
                  className="border-b border-line bg-indigo-50/60 px-3 py-1.5 text-left text-xs font-semibold tracking-tight text-indigo-900"
                >
                  {table.name}
                </th>
              </tr>
              {table.columns.map((column, index) => (
                <tr key={column.id} className={index % 2 === 1 ? 'bg-shell/50' : ''}>
                  <td className="border-b border-line px-3 py-1.5 font-mono text-[13px]">
                    {column.name}
                    {column.isPrimaryKey && (
                      <span className="ml-1.5 rounded-sm border border-indigo-200 bg-indigo-50 px-1 text-[10px] font-medium text-indigo-700">
                        PK
                      </span>
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-1.5 font-mono text-[13px] text-zinc-600">
                    {column.conceptualType}
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <input
                        type="text"
                        aria-label={`Type SQL de ${table.name}.${column.name}`}
                        value={column.overridden ? column.sqlType : ''}
                        placeholder={column.proposedType}
                        onChange={(event) => onOverrideChange(column.id, event.target.value)}
                        className="w-full min-w-0 rounded border border-zinc-300 bg-surface px-1.5 py-0.5 font-mono text-[13px] placeholder:text-zinc-400"
                      />
                      {column.overridden && (
                        <button
                          type="button"
                          aria-label={`Revenir au type proposé pour ${column.name}`}
                          title={`Revenir à ${column.proposedType}`}
                          onClick={() => onOverrideChange(column.id, '')}
                          className="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 text-xs hover:bg-zinc-100"
                        >
                          ↺
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  )
}
