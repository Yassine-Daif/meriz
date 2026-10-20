import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chooseVersion, writeVersion } from './release-version.mjs'

test('respecte une nouvelle version mineure choisie dans le dépôt', () => {
  assert.equal(chooseVersion('1.1.0', ['v1.0.0', 'v1.0.1']), '1.1.0')
})
test('incrémente automatiquement les correctifs quand la version existe déjà', () => {
  assert.equal(chooseVersion('1.1.0', ['v1.1.0', 'v1.1.9', 'v1.1.10']), '1.1.11')
})
test('ne publie jamais une version inférieure à la dernière release', () => {
  assert.equal(chooseVersion('1.0.1', ['v1.1.3', 'v2.0.0-beta.1']), '1.1.4')
})
test('refuse les versions stables mal formées', () => {
  assert.throws(() => chooseVersion('v1.1.0', []))
  assert.throws(() => chooseVersion('1.1', []))
})
test('garde les cinq fichiers de version cohérents et conserve les dépendances', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'meriz-version-test-'))
  try {
    mkdirSync(path.join(root, 'src-tauri'))
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({version:'1.0.1',dependencies:{test:'^2'}}))
    writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({version:'1.0.1',packages:{'':{version:'1.0.1'}}}))
    writeFileSync(path.join(root, 'src-tauri/tauri.conf.json'), JSON.stringify({version:'1.0.1',identifier:'dev.meriz.desktop'}))
    writeFileSync(path.join(root, 'src-tauri/Cargo.toml'), '[package]\nname = "app"\nversion = "1.0.1"\n')
    writeFileSync(path.join(root, 'src-tauri/Cargo.lock'), '[[package]]\nname = "app"\nversion = "1.0.1"\n[[package]]\nname = "tauri"\nversion = "2.11.3"\n')
    writeVersion(root, '1.1.0')
    for (const file of ['package.json','package-lock.json','src-tauri/tauri.conf.json']) {
      assert.equal(JSON.parse(readFileSync(path.join(root,file),'utf8')).version, '1.1.0')
    }
    assert.equal(JSON.parse(readFileSync(path.join(root,'package-lock.json'),'utf8')).packages[''].version, '1.1.0')
    assert.equal(JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).dependencies.test, '^2')
    assert.match(readFileSync(path.join(root,'src-tauri/Cargo.toml'),'utf8'), /version = "1.1.0"/)
    assert.match(readFileSync(path.join(root,'src-tauri/Cargo.lock'),'utf8'), /name = "app"\nversion = "1.1.0"/)
    assert.match(readFileSync(path.join(root,'src-tauri/Cargo.lock'),'utf8'), /name = "tauri"\nversion = "2.11.3"/)
  } finally {
    rmSync(root, {recursive:true, force:true})
  }
})
