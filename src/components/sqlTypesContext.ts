import { createContext, useContext } from 'react'
import type { Dispatch } from 'react'
import type { AttributeType } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'
import { DEFAULT_MPD_SETTINGS, proposedSqlType } from '../model/mpd'
import type { MpdSettings } from '../model/mpd'
import { formatSqlType, parseSqlType, sqlTypeForDialect } from '../model/sqlTypes'

export const SqlTypesContext = createContext<{ settings: MpdSettings; dispatch: Dispatch<McdAction>; readOnly: boolean; beginner?: boolean }>({ settings: DEFAULT_MPD_SETTINGS, dispatch: () => {}, readOnly: true })
export function useSqlTypes() {
  const context = useContext(SqlTypesContext)
  return { ...context, physicalType: (id: string, type: AttributeType, size?: number) => {
    const raw = context.settings.overrides[id] ?? proposedSqlType(type, size, context.settings.dialect)
    const spec = parseSqlType(raw), mapped = spec && sqlTypeForDialect(spec, context.settings.dialect)
    return mapped ? formatSqlType(mapped) : raw
  } }
}
