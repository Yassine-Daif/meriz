import type { ViewId } from '../components/views'
export const WORK_VIEWS = ['dictionnaire', 'mcd', 'mld', 'mpd', 'sql', 'code'] as const
export type WorkView = typeof WORK_VIEWS[number]
export interface AssignmentInterface {
  views: WorkView[]
  export_image: boolean
  export_model: boolean
}
export function parseAssignmentInterface(raw: unknown): AssignmentInterface | null | undefined {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const value = raw as Record<string, unknown>
  if (!Array.isArray(value.views) || value.views.length === 0 || value.views.length > 6 || new Set(value.views).size !== value.views.length || !value.views.every(v => typeof v === 'string' && (WORK_VIEWS as readonly string[]).includes(v)) || typeof value.export_image !== 'boolean' || typeof value.export_model !== 'boolean') return undefined
  return { views: value.views as WorkView[], export_image: value.export_image, export_model: value.export_model }
}
/** Un réglage explicite du devoir prime sur le niveau personnel. */
export function assignmentViews(settings: AssignmentInterface): readonly ViewId[] {
  return [...settings.views, 'apprendre', 'apropos']
}
export const INTERFACE_PRESETS: Readonly<Record<string, AssignmentInterface>> = {
  mcd: { views: ['dictionnaire', 'mcd'], export_image: true, export_model: true },
  mld: { views: ['dictionnaire', 'mcd', 'mld'], export_image: true, export_model: true },
  complete: { views: [...WORK_VIEWS], export_image: true, export_model: true },
}
