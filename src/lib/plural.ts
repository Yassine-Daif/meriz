/**
 * Accord en nombre, à la française : zéro et un restent au singulier,
 * deux et au-delà passent au pluriel. « 0 classe », « 1 classe »,
 * « 2 classes ».
 */
export function plural(count: number, one: string, many: string): string {
  return count > 1 ? many : one
}
