import type { WorkspaceCollection } from './collectionsApi'
export type PeriodKind = 'academic' | 'calendar'
export function periodLabel(
  collection: Pick<WorkspaceCollection, 'yearStart' | 'periodKind'>,
): string {
  return collection.yearStart === null
    ? ''
    : collection.periodKind === 'calendar'
      ? String(collection.yearStart)
      : collection.yearStart + '-' + (collection.yearStart + 1)
}
export function periodKey(
  collection: Pick<WorkspaceCollection, 'yearStart' | 'periodKind'>,
): string {
  return collection.yearStart === null
    ? 'null'
    : (collection.periodKind ?? 'academic') + ':' + collection.yearStart
}
export function currentAcademicYear(date = new Date()): number {
  return date.getFullYear() - (date.getMonth() < 8 ? 1 : 0)
}
