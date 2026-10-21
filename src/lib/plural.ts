import { isPlural, t } from '../i18n/runtime'
/** Le zéro reste singulier en français, mais prend le pluriel en anglais. */
export function plural(count: number, one: string, many: string): string { return t(isPlural(count) ? many : one) }
export function counted(count: number, one: string, many: string): string { return count + ' ' + plural(count, t(one), t(many)) }
