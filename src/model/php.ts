/**
 * Écriture de littéraux PHP. Les noms viennent du modèle, donc d'une
 * saisie libre : une apostrophe dans un nom ne doit jamais casser le
 * fichier généré.
 */

/** Chaîne PHP entre apostrophes, apostrophes et barres échappées. */
export function phpString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** Liste de chaînes sur une ligne : `['a', 'b']`. */
export function phpStringList(values: readonly string[]): string {
  return `[${values.map(phpString).join(', ')}]`
}

/** Liste de chaînes sur plusieurs lignes, une par élément. */
export function phpStringBlock(values: readonly string[], indent: string): string {
  if (values.length === 0) {
    return '[]'
  }
  const lines = values.map((value) => `${indent}    ${phpString(value)},`)
  return ['[', ...lines, `${indent}]`].join('\n')
}
