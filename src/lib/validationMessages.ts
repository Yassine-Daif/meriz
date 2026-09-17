/**
 * Traduction des messages de validation par défaut de Laravel, que le
 * serveur renvoie en anglais. Un message inconnu est affiché tel quel.
 */
const RULES: { pattern: RegExp; translate: (field: string, match: RegExpMatchArray) => string }[] = [
  { pattern: /field is required\.?$/i, translate: () => 'Ce champ est obligatoire.' },
  { pattern: /must be a valid email address/i, translate: () => 'Adresse email invalide.' },
  {
    pattern: /has already been taken/i,
    translate: (field) =>
      field === 'email'
        ? 'Un compte existe déjà avec cette adresse email.'
        : 'Cette valeur est déjà utilisée.',
  },
  {
    pattern: /must be at least (\d+) characters/i,
    translate: (_field, match) => `${match[1]} caractères minimum.`,
  },
  {
    pattern: /must not be greater than (\d+) characters/i,
    translate: (_field, match) => `${match[1]} caractères maximum.`,
  },
  { pattern: /must be a string/i, translate: () => 'Valeur invalide.' },
]

export function translateValidationMessage(field: string, message: string): string {
  for (const rule of RULES) {
    const match = message.match(rule.pattern)
    if (match) {
      return rule.translate(field, match)
    }
  }
  return message
}
