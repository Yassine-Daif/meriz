import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export function chooseVersion(current, tags) {
  if (!/^\d+\.\d+\.\d+$/.test(current)) throw new Error('Version stable attendue : '+current)
  const versions = tags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag)).map((tag) => tag.slice(1))
  const compare = (a, b) => {
    const aa = a.split('.').map(Number), bb = b.split('.').map(Number)
    return aa[0]-bb[0] || aa[1]-bb[1] || aa[2]-bb[2]
  }
  versions.sort(compare)
  const latest = versions.at(-1)
  if (!latest || compare(current, latest) > 0) return current
  const [major, minor, patch] = latest.split('.').map(Number)
  return [major, minor, patch+1].join('.')
}

export function writeVersion(root, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Version stable invalide')
  for (const file of ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json']) {
    const data = JSON.parse(readFileSync(path.join(root, file), 'utf8'))
    data.version = version
    if (file === 'package-lock.json') data.packages[''].version = version
    writeFileSync(path.join(root, file), JSON.stringify(data, null, 2)+'\n')
  }
  const cargo = path.join(root, 'src-tauri/Cargo.toml')
  const toml = readFileSync(cargo, 'utf8')
  writeFileSync(cargo, toml.replace(/(\[package\][\s\S]*?^version = ")[^"]+/m, '$1'+version))
  const lock = path.join(root, 'src-tauri/Cargo.lock')
  const text = readFileSync(lock, 'utf8')
  if (!/name = "app"\r?\nversion = "[^"]+"/.test(text)) throw new Error('Paquet Rust app absent du verrou')
  writeFileSync(lock, text.replace(/(name = "app"\r?\nversion = ")[^"]+/, '$1'+version))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const current = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
  const tags = execFileSync('git', ['tag', '--list'], {cwd:root, encoding:'utf8'}).trim().split('\n')
  const arg = process.argv[2]
  if (arg === '--next') {
    const next = chooseVersion(current, tags)
    writeVersion(root, next)
    console.log(next)
  } else if (arg) {
    writeVersion(root, arg)
    console.log(arg)
  } else {
    throw new Error('Utilisation : node scripts/release-version.mjs --next ou VERSION')
  }
}
