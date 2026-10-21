import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { english } from '../src/i18n/runtime'

describe('couverture des traductions', () => {
  it('chaque texte traduit possède une version anglaise et des paramètres valides', () => {
    const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../src')
    const missing: string[] = []
    const unknownParameters: string[] = []
    function check(key: string, file: string) {
      if (!Object.hasOwn(english, key)) { missing.push(file + ': ' + key); return }
      const sourceSlots = new Set([...key.matchAll(/\{(\d+)\}/g)].map(match => match[1]))
      for (const slot of english[key]!.matchAll(/\{(\d+)\}/g)) if (!sourceSlots.has(slot[1])) unknownParameters.push(file + ': ' + key)
      expect(english[key]?.trim().length, file + ': ' + key).toBeGreaterThan(0)
    }
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name)
        if (entry.isDirectory()) { if (entry.name !== 'i18n') walk(file); continue }
        if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) continue
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
        function visit(node: ts.Node) {
          if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) check(node.arguments[0].text, entry.name)
          if (ts.isJsxAttribute(node) && node.name.getText(source) === 'source' && node.initializer && ts.isStringLiteral(node.initializer)) check(node.initializer.text, entry.name)
          if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'counted') for (const argument of node.arguments.slice(1)) if (ts.isStringLiteral(argument)) check(argument.text, entry.name)
          ts.forEachChild(node, visit)
        }
        visit(source)
      }
    }
    walk(sourceRoot)
    expect(missing).toEqual([])
    expect(unknownParameters).toEqual([])
  })
})
