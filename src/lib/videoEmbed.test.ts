import { describe, expect, it } from 'vitest'
import { parseWebUrl, resolveVideo } from './videoEmbed'

describe('adresses du web', () => {
  it('accepte http et https, refuse le reste', () => {
    expect(parseWebUrl('https://exemple.fr/page')?.href).toBe('https://exemple.fr/page')
    expect(parseWebUrl('http://exemple.fr')?.href).toBe('http://exemple.fr/')
    expect(parseWebUrl('  https://exemple.fr  ')?.href).toBe('https://exemple.fr/')

    expect(parseWebUrl('javascript:alert(1)')).toBeNull()
    expect(parseWebUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(parseWebUrl('file:///C:/secret.txt')).toBeNull()
    expect(parseWebUrl('vbscript:msgbox(1)')).toBeNull()
    expect(parseWebUrl('/page/relative')).toBeNull()
    expect(parseWebUrl('exemple.fr')).toBeNull()
    expect(parseWebUrl('')).toBeNull()
    expect(parseWebUrl('   ')).toBeNull()
  })
})

describe('intégration des vidéos, hébergeurs reconnus', () => {
  it('reconnaît YouTube sous ses différentes formes', () => {
    const attendu = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'

    expect(resolveVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.embedUrl).toBe(attendu)
    expect(resolveVideo('https://youtube.com/watch?v=dQw4w9WgXcQ&t=42')?.embedUrl).toBe(attendu)
    expect(resolveVideo('https://m.youtube.com/watch?v=dQw4w9WgXcQ')?.embedUrl).toBe(attendu)
    expect(resolveVideo('https://youtu.be/dQw4w9WgXcQ')?.embedUrl).toBe(attendu)
    expect(resolveVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ')?.embedUrl).toBe(attendu)
    expect(resolveVideo('https://www.youtube.com/embed/dQw4w9WgXcQ')?.embedUrl).toBe(attendu)
    expect(resolveVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.provider).toBe('youtube')
  })

  it('reconnaît Vimeo et Dailymotion', () => {
    expect(resolveVideo('https://vimeo.com/123456789')?.embedUrl).toBe('https://player.vimeo.com/video/123456789')
    expect(resolveVideo('https://player.vimeo.com/video/123456789')?.provider).toBe('vimeo')
    expect(resolveVideo('https://www.dailymotion.com/video/x8abcde')?.embedUrl).toBe(
      'https://www.dailymotion.com/embed/video/x8abcde',
    )
    expect(resolveVideo('https://dai.ly/x8abcde')?.provider).toBe('dailymotion')
  })

  it("ne recopie jamais l'adresse saisie dans l'adresse du lecteur", () => {
    const embed = resolveVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&evil=%3Cscript%3E')

    // L'adresse est reconstruite à partir du seul identifiant : rien de la
    // chaîne d'origine ne survit en dehors de lui.
    expect(embed?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(embed?.embedUrl).not.toContain('evil')
    expect(embed?.embedUrl).not.toContain('script')
  })
})

describe('intégration des vidéos, ce qui doit être refusé', () => {
  it('refuse un schéma dangereux', () => {
    expect(resolveVideo('javascript:alert(1)')).toBeNull()
    expect(resolveVideo('data:text/html,<iframe src=x>')).toBeNull()
    expect(resolveVideo('JavaScript:alert(1)')).toBeNull()
  })

  it('refuse un hôte qui ressemble à un hébergeur connu', () => {
    expect(resolveVideo('https://evil-youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(resolveVideo('https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(resolveVideo('https://notyoutu.be/dQw4w9WgXcQ')).toBeNull()
    expect(resolveVideo('https://vimeo.com.attaque.fr/123456789')).toBeNull()
    expect(resolveVideo('https://sous.domaine.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    // Un identifiant valide chez un inconnu ne suffit pas.
    expect(resolveVideo('https://exemple.fr/watch?v=dQw4w9WgXcQ')).toBeNull()
  })

  it('refuse un identifiant douteux ou absent', () => {
    expect(resolveVideo('https://www.youtube.com/watch?v=../../etc/passwd')).toBeNull()
    expect(resolveVideo('https://www.youtube.com/watch?v=abc"onload=x')).toBeNull()
    expect(resolveVideo('https://www.youtube.com/watch')).toBeNull()
    expect(resolveVideo('https://www.youtube.com/')).toBeNull()
    expect(resolveVideo('https://youtu.be/')).toBeNull()
    expect(resolveVideo('https://vimeo.com/pas-un-nombre')).toBeNull()
    expect(resolveVideo('https://www.dailymotion.com/playlist/x8abcde')).toBeNull()
  })

  it('refuse une saisie vide ou incomplète', () => {
    expect(resolveVideo('')).toBeNull()
    expect(resolveVideo('   ')).toBeNull()
    expect(resolveVideo('youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })
})
