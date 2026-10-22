/** Audit Chromium : vrais glyphes, clics, menus et panneaux, pas seulement scrollWidth. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const publicMode = process.argv.includes('--public')
const headerOnly = process.argv.includes('--header-only')
const site = fileURLToPath(new URL('../site/', import.meta.url))
const artifacts = process.env.MERIZ_LAYOUT_ARTIFACTS || path.join(os.tmpdir(), 'meriz-site-layout')
fs.mkdirSync(artifacts, { recursive: true })
const version = await (await fetch((process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222') + '/json/version')).json()
const ws = new WebSocket(version.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let sequence = 0, session, checks = 0
const pending = new Map(), errors = [], runtimeErrors = []
function send(method, params = {}, sessionId = session) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    setTimeout(() => { if (pending.delete(id)) reject(new Error('Timeout ' + method)) }, 20000).unref()
  })
}
ws.onmessage = event => {
  const data = JSON.parse(event.data)
  if (data.id) { const request = pending.get(data.id); if (request) { pending.delete(data.id); if (data.error) request.reject(new Error(data.error.message)); else request.resolve(data.result) }; return }
  if (data.method === 'Runtime.exceptionThrown') runtimeErrors.push(data.params.exceptionDetails.text)
  if (data.method !== 'Fetch.requestPaused') return
  void (async () => {
    const url = new URL(data.params.request.url)
    let file = path.resolve(site, '.' + decodeURIComponent(url.pathname))
    if (file !== path.resolve(site) && !file.startsWith(path.resolve(site) + path.sep)) throw new Error('Chemin refusé')
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) return send('Fetch.fulfillRequest', { requestId: data.params.requestId, responseCode: 404, body: '' })
    const type = ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream'
    await send('Fetch.fulfillRequest', { requestId: data.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: type }, { name: 'Cache-Control', value: 'no-store' }], body: fs.readFileSync(file).toString('base64') })
  })().catch(error => runtimeErrors.push(error.message))
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}
const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')

// Exécutée dans la page : la géométrie du texte est mesurée après le chargement des polices.
function measurePage(headerOnly, requireDesktop) {
  const issues = [], visible = e => !!e.getClientRects().length && !e.closest('[hidden], [aria-hidden="true"], .mz-nav-measure, svg') && getComputedStyle(e).visibility !== 'hidden'
  function textRects(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), rects = []
    while (walker.nextNode()) {
      const text = walker.currentNode
      if (!text.textContent.trim() || text.parentElement.closest('svg,[hidden],[aria-hidden="true"]')) continue
      const range = document.createRange(); range.selectNodeContents(text)
      for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) rects.push(rect)
    }
    return rects
  }
  if (document.documentElement.scrollWidth > innerWidth + 2) issues.push('Débordement de la page')
  const header = document.querySelector('.mz-nav'), row = header.firstElementChild
  if (requireDesktop && (!visible(row.querySelector('.mz-navlinks')) || !visible(row.querySelector('a.mz-btn')))) issues.push('Navigation complète absente sur grand écran')
  const controls = [...row.querySelectorAll('a,button,.mz-ver')].filter(visible)
  for (const control of controls) {
    const rect = control.getBoundingClientRect(), parent = row.getBoundingClientRect(), lines = new Set(textRects(control).map(r => Math.round(r.top / 3)))
    if (lines.size > 1) issues.push('Header sur plusieurs lignes : ' + control.textContent.trim())
    if (rect.left < parent.left - 1 || rect.right > parent.right + 1 || rect.top < parent.top - 1 || rect.bottom > parent.bottom + 1) issues.push('Header hors de sa zone : ' + (control.textContent.trim() || control.getAttribute('aria-label')))
    if (control.matches('.mz-iconbtn,.mz-burger') && rect.width < 43) issues.push('Icône écrasée')
  }
  for (let a = 0; a < controls.length; a++) for (let b = a + 1; b < controls.length; b++) {
    const x = controls[a].getBoundingClientRect(), y = controls[b].getBoundingClientRect()
    if (Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1) issues.push('Chevauchement dans le header')
  }
  if (!headerOnly) for (const e of document.querySelectorAll('main h1,main h2,main h3,main p,main a,main button,main .mz-preview-toolbar > span,footer p,footer a')) {
    if (!visible(e) || (e.closest('pre,table,svg') || (e.closest('.mz-win') && !e.closest('.mz-preview-toolbar')))) continue
    const style = getComputedStyle(e), box = e.getBoundingClientRect()
    if (style.textOverflow === 'ellipsis' || style.overflowX === 'auto' || e.clientWidth < 2) continue
    if (e.scrollWidth > e.clientWidth + 3) issues.push('Texte hors de sa zone : ' + e.textContent.trim().slice(0, 85))
    if (e.matches('a,button') && ['flex', 'inline-flex', 'block'].includes(style.display)) for (const rect of textRects(e)) {
      if (rect.left < box.left - 2 || rect.right > box.right + 2 || rect.top < box.top - 2 || rect.bottom > box.bottom + 2) issues.push('Libellé rogné : ' + e.textContent.trim().slice(0, 85))
    }
  }
  return [...new Set(issues)]
}

const context = (await send('Target.createBrowserContext', {}, null)).browserContextId
try {
  const target = await send('Target.createTarget', { url: 'about:blank', browserContextId: context }, null)
  session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  if (!publicMode) await send('Fetch.enable', { patterns: [{ urlPattern: 'https://meriz.fr/*' }] })
  const paths = ['/', '/fonctionnalites.html', '/merise.html', '/telecharger.html', '/mentions-legales.html', '/en/', '/en/features.html', '/en/merise.html', '/en/download.html', '/en/legal.html']
  const widths = [320, 390, 640, 768, 820, 821, 900, 1024, 1100, 1101, 1200, 1279, 1280, 1281, 1366, 1440, 1920]
  const factors = process.argv.includes('--stress') ? [1, 1.25, 2] : [1, 1.25]
  async function viewport(width, factor) {
    await evaluate("window.__layoutOriginalFonts.forEach(([e,value,priority])=>{if(value)e.style.setProperty('font-size',value,priority);else e.style.removeProperty('font-size')})")
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); await settle()
    await evaluate(`(()=>{const fonts=window.__layoutOriginalFonts.map(([e])=>[e,parseFloat(getComputedStyle(e).fontSize)]);fonts.forEach(([e,size])=>{e.style.fontSize=(size*${factor})+'px'})})()`); await settle()
  }
  async function check(label, width, factor) {
    const found = await evaluate('(' + measurePage.toString() + ')(' + headerOnly + ',' + (width >= 1440 && factor === 1) + ')'); checks++
    if (found.length) {
      const geometry = await evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&!e.closest('[hidden],svg,.mz-nav-measure')&&e.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:Math.round(e.getBoundingClientRect().right),text:e.textContent.trim().slice(0,60),position:getComputedStyle(e).position,overflow:getComputedStyle(e).overflowX}))")
      errors.push({ label, width, factor, issues: found, geometry })
    }
  }
  for (const page of paths) {
    await send('Page.navigate', { url: 'https://meriz.fr' + page })
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate("document.readyState==='complete' && !!document.querySelector('.mz-nav')")) break; await new Promise(resolve => setTimeout(resolve, 60)) }
    await evaluate('document.fonts.ready'); await settle()
    // Les tailles du site sont en px : changer seulement html.fontSize ne les agrandit pas.
    await evaluate("window.__layoutOriginalFonts=[...document.querySelectorAll('.mz, .mz *')].filter(e=>!e.closest('svg')).map(e=>[e,e.style.getPropertyValue('font-size'),e.style.getPropertyPriority('font-size')])")
    for (const factor of factors) {
      for (const width of widths) {
        await viewport(width, factor)
        await check(page, width, factor)
        const compact = await evaluate("getComputedStyle(document.querySelector('[data-menu-bouton]')).display!=='none'")
        if (compact) {
          await evaluate("document.querySelector('[data-menu-bouton]').click()")
          const accessible = await evaluate("(()=>{const p=document.querySelector('[data-menu]');return !p.hidden&&p.getBoundingClientRect().height>0&&[...p.querySelectorAll('a.mz-nl')].every(e=>e.getClientRects().length)})()")
          if (!accessible) errors.push({ label: page, width, factor, issues: ['Le bouton de menu ne donne pas accès aux liens'] })
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
          if (!await evaluate("document.querySelector('[data-menu]').hidden")) throw new Error('Échap ne ferme pas le menu')
        }
        if (factor === 1 && ((page === '/' && width === 1920) || (page === '/' && width === 900) || (page === '/en/' && width === 390))) {
          const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(artifacts, (publicMode ? 'public-' : 'local-') + (page === '/' ? 'fr' : 'en') + '-' + width + '.png'), Buffer.from(shot.data, 'base64'))
        }
      }
      if (!headerOnly) {
        const tabs = await evaluate("[...document.querySelectorAll('main [role=tab]')].map((e,i)=>{e.dataset.layoutTab=String(i);return String(i)})")
        for (const tab of tabs) for (const width of [320, 900, 1440]) {
          await viewport(width, factor)
          const active = await evaluate(`(()=>{const e=document.querySelector('[data-layout-tab="${tab}"]');if(!e.getClientRects().length||e.closest('[hidden]'))return false;e.click();return true})()`)
          if (active) { await settle(); await check(page + ' onglet ' + tab, width, factor) }
        }
      }
    }
    console.log(page + ' : navigation, textes et panneaux contrôlés.')
  }
} finally {
  fs.writeFileSync(path.join(artifacts, (publicMode ? 'public' : 'local') + '-report.json'), JSON.stringify({ checks, errors, runtimeErrors }, null, 2))
  await send('Target.disposeBrowserContext', { browserContextId: context }, null); ws.close()
}
console.log(checks + ' dispositions contrôlées ; ' + errors.length + ' anomalies ; ' + runtimeErrors.length + ' erreurs JavaScript.')
if (errors.length) console.error(JSON.stringify(errors.slice(0, 12), null, 2))
if (errors.length || runtimeErrors.length) process.exitCode = 1
