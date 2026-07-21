import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../../..')

const consumers = [
  'node_modules/@eslint/eslintrc/node_modules/ajv/package.json',
  'node_modules/eslint/node_modules/ajv/package.json',
  'node_modules/@tarojs/plugin-doctor/node_modules/eslint/node_modules/ajv/package.json',
  'node_modules/babel-loader/node_modules/schema-utils/node_modules/ajv/package.json',
]

test('each eslint + babel-loader schema-utils consumer resolves ajv 6.x', () => {
  for (const rel of consumers) {
    const p = resolve(repoRoot, rel)
    if (!existsSync(p)) {
      throw new Error(`Expected nested ajv 6.x at ${rel}, but it is missing (npm overrides did not nest it)`)
    }
    const pkg = JSON.parse(readFileSync(p, 'utf8'))
    const major = pkg.version.split('.')[0]
    if (major !== '6') {
      throw new Error(`Expected ajv 6.x at ${rel}, got ${pkg.version}`)
    }
  }
})

test('top-level ajv is 8.x', () => {
  const p = resolve(repoRoot, 'node_modules/ajv/package.json')
  const pkg = JSON.parse(readFileSync(p, 'utf8'))
  const major = pkg.version.split('.')[0]
  if (major !== '8') {
    throw new Error(`Expected top-level ajv 8.x, got ${pkg.version}`)
  }
})
