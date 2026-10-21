import { t } from "../i18n/runtime"
/**
 * Traduction des messages de validation par défaut de Laravel, que le
 * serveur renvoie en anglais. Un message inconnu est affiché tel quel.
 */
const RULES: { pattern: RegExp; translate: (field: string, match: RegExpMatchArray) => string }[] = [
  { pattern: /field is required\.?$/i, translate: () => t("Ce champ est obligatoire.") },
  { pattern: /must be a valid email address/i, translate: () => t("Adresse email invalide.") },
  {
    pattern: /has already been taken/i,
    translate: (field) =>
      field === 'email'
        ? t("Un compte existe déjà avec cette adresse email.")
        : t("Cette valeur est déjà utilisée."),
  },
  {
    pattern: /must be at least (\d+) characters/i,
    translate: (_field, match) => t("{0} caractères minimum.", [match[1]]),
  },
  {
    pattern: /must not be greater than (\d+) characters/i,
    translate: (_field, match) => t("{0} caractères maximum.", [match[1]]),
  },
  {
    pattern: /must not be greater than (\d+) kilobytes/i,
    translate: (_field, match) => t("Fichier trop lourd : {0} Ko au plus.", [match[1]]),
  },
  { pattern: /must be a string/i, translate: () => t("Valeur invalide.") },
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
