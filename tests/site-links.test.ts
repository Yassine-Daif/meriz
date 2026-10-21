import { expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '../site')
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(join(dir, entry.name)) : entry.name.endsWith('.html') ? [join(dir, entry.name)] : [])
}
it('les pages de la vitrine possèdent des liens et des ancres internes valides', () => {
  const errors: string[] = []
  for (const file of pages(site)) {
    const html = readFileSync(file, 'utf8')
    const base = new URL('https://meriz.fr/' + file.slice(site.length + 1).replaceAll('\\', '/'))
    for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
      const url = new URL(match[1]!, base)
      if (url.origin !== base.origin) continue
      const target = join(site, decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '')
      if (!existsSync(target)) { errors.push(file + ': ' + match[1]); continue }
      if (url.hash && target.endsWith('.html')) {
        const id = decodeURIComponent(url.hash.slice(1))
        const content = readFileSync(target, 'utf8')
        if (!content.includes('id="' + id + '"') && !content.includes("id='" + id + "'")) errors.push(file + ': ancre ' + match[1])
      }
    }
  }
  expect(errors).toEqual([])
})
it('les cinq pages anglaises ont une langue, un titre et des alternatives françaises', () => {
  for (const file of pages(join(site, 'en'))) {
    const html = readFileSync(file, 'utf8')
    expect(html).toMatch(/<html[^>]+lang="en"/)
    expect(html).toMatch(/<title>[^<]+<\/title>/)
    expect(html).toMatch(/rel="canonical"[^>]+https:\/\/meriz.fr\/en\//)
    expect(html).toContain('hreflang="fr"')
    expect(html).toContain('hreflang="en"')
  }
})
