/**
 * Intégration des vidéos, sous contrôle strict.
 *
 * Règle de sécurité : on n'intègre jamais l'adresse saisie. On vérifie
 * l'hôte contre une liste blanche exacte, on en extrait l'identifiant de
 * la vidéo, on valide cet identifiant, puis on construit nous-mêmes
 * l'adresse du lecteur. Une adresse quelconque ne devient donc jamais le
 * src d'une iframe : elle reste un simple lien.
 *
 * La comparaison d'hôte est une égalité, jamais un suffixe : « endsWith »
 * laisserait passer evil-youtube.com et youtube.com.evil.tld.
 */

export type VideoProvider = 'youtube' | 'vimeo' | 'dailymotion'

export interface VideoEmbed {
  provider: VideoProvider
  /** Adresse du lecteur, construite ici à partir du seul identifiant. */
  embedUrl: string
  /** Nom de l'hébergeur, pour le titre de l'iframe. */
  providerLabel: string
}

const PROVIDER_LABEL: Record<VideoProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  dailymotion: 'Dailymotion',
}

/** Hébergeurs reconnus, hôte par hôte. */
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const YOUTUBE_SHORT_HOSTS = new Set(['youtu.be'])
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])
const DAILYMOTION_HOSTS = new Set(['dailymotion.com', 'www.dailymotion.com'])
const DAILYMOTION_SHORT_HOSTS = new Set(['dai.ly'])

/** Identifiants attendus : jamais de caractère qui pourrait sortir de l'adresse. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,32}$/
const VIMEO_ID = /^[0-9]{6,12}$/
const DAILYMOTION_ID = /^[A-Za-z0-9]{5,20}$/

/**
 * Lit une adresse saisie. Renvoie null si elle est vide, mal formée, si
 * le schéma n'est pas http(s), ou si l'hôte n'est pas reconnu.
 */
export function parseWebUrl(input: string): URL | null {
  const trimmed = input.trim()
  if (trimmed === '') {
    return null
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
}

/** Première partie non vide du chemin, ou une chaîne vide. */
function firstSegment(url: URL): string {
  return url.pathname.split('/').filter((part) => part !== '')[0] ?? ''
}

function segmentAfter(url: URL, prefix: string): string {
  const parts = url.pathname.split('/').filter((part) => part !== '')
  return parts[0] === prefix ? (parts[1] ?? '') : ''
}

function youtubeId(url: URL): string {
  if (YOUTUBE_SHORT_HOSTS.has(url.hostname)) {
    return firstSegment(url)
  }
  const path = url.pathname.split('/').filter((part) => part !== '')
  if (path[0] === 'watch') {
    return url.searchParams.get('v') ?? ''
  }
  // /shorts/<id>, /embed/<id>, /live/<id>
  if (path[0] === 'shorts' || path[0] === 'embed' || path[0] === 'live') {
    return path[1] ?? ''
  }
  return ''
}

/**
 * Adresse d'intégration d'une vidéo, ou null quand l'hébergeur n'est pas
 * reconnu. Dans ce cas, l'appelant affiche un lien, jamais une iframe.
 */
export function resolveVideo(input: string): VideoEmbed | null {
  const url = parseWebUrl(input)
  if (!url) {
    return null
  }
  const host = url.hostname.toLowerCase()

  if (YOUTUBE_HOSTS.has(host) || YOUTUBE_SHORT_HOSTS.has(host)) {
    const id = youtubeId(url)
    if (YOUTUBE_ID.test(id)) {
      // Domaine sans cookie de suivi, et adresse reconstruite à partir du seul identifiant.
      return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, providerLabel: PROVIDER_LABEL.youtube }
    }
    return null
  }

  if (VIMEO_HOSTS.has(host)) {
    const id = host === 'player.vimeo.com' ? segmentAfter(url, 'video') : firstSegment(url)
    if (VIMEO_ID.test(id)) {
      return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}`, providerLabel: PROVIDER_LABEL.vimeo }
    }
    return null
  }

  if (DAILYMOTION_HOSTS.has(host) || DAILYMOTION_SHORT_HOSTS.has(host)) {
    const id = DAILYMOTION_SHORT_HOSTS.has(host) ? firstSegment(url) : segmentAfter(url, 'video')
    if (DAILYMOTION_ID.test(id)) {
      return {
        provider: 'dailymotion',
        embedUrl: `https://www.dailymotion.com/embed/video/${id}`,
        providerLabel: PROVIDER_LABEL.dailymotion,
      }
    }
    return null
  }

  return null
}

/** Hébergeurs acceptés, pour l'aide affichée au prof. */
export const KNOWN_PROVIDERS = 'YouTube, Vimeo et Dailymotion'
