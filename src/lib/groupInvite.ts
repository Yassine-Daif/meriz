import { t } from "../i18n/runtime"
import { formatJoinCode } from './classroomsApi'

/**
 * L'invitation à rejoindre un groupe, prête à coller. Le message dit
 * tout ce qu'il faut : le nom du groupe, le code, où le saisir, et
 * l'adresse de l'application.
 *
 * Rien n'est envoyé d'ici. Depuis un navigateur, on ne peut pas publier
 * dans Discord : on prépare le message, la personne le colle.
 */

export interface InviteParams {
  groupName: string
  joinCode: string
  /** Adresse de l'application, telle qu'elle est ouverte. */
  appUrl: string
}

export function invitationSubject(groupName: string): string {
  return t("Rejoins mon groupe « {0} » sur Meriz", [groupName])
}

export function invitationMessage({ groupName, joinCode, appUrl }: InviteParams): string {
  return [
    t("Rejoins mon groupe « {0} » sur Meriz, pour modéliser à plusieurs.", [groupName]),
    '',
    t("Code du groupe : {0}", [formatJoinCode(joinCode)]),
    '',
    t("Ouvre « Mes groupes », puis « Rejoindre un groupe », et saisis ce code."),
    t("Les minuscules, les espaces et les tirets sont acceptés."),
    appUrl,
  ].join('\n')
}

/**
 * Variante Discord : le code entre accents graves. Discord le met alors
 * en évidence et n'y applique aucune correction automatique.
 */
export function discordMessage({ groupName, joinCode, appUrl }: InviteParams): string {
  return [
    t("Rejoins mon groupe **{0}** sur Meriz, pour modéliser à plusieurs.", [groupName]),
    '',
    t("Code du groupe : `{0}`", [formatJoinCode(joinCode)]),
    '',
    t("Ouvre « Mes groupes », puis « Rejoindre un groupe », et saisis ce code."),
    appUrl,
  ].join('\n')
}

/**
 * Lien de courrier prérempli, sans destinataire : la personne choisit
 * dans son logiciel de messagerie.
 */
export function invitationMailto(params: InviteParams): string {
  const subject = encodeURIComponent(invitationSubject(params.groupName))
  const body = encodeURIComponent(invitationMessage(params))
  return `mailto:?subject=${subject}&body=${body}`
}
