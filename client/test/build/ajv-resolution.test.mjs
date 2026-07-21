import { test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'

const repoRoot = resolve(import.meta.dirname, '../../..')

// Each entry corresponds to a consumer that npm hoisted a nested ajv@6 next
// to. Resolution-truthful: from the consumer's package.json, use Node's
// module resolution to locate the ajv that consumer would actually load at
// runtime.
const consumers = [
  {
    name: '@eslint/eslintrc',
    consumerPkg: 'node_modules/@eslint/eslintrc/package.json',
  },
  {
    name: 'eslint',
    consumerPkg: 'node_modules/eslint/package.json',
  },
  {
    name: '@tarojs/plugin-doctor',
    consumerPkg: 'node_modules/@tarojs/plugin-doctor/package.json',
  },
  {
    name: 'babel-loader',
    consumerPkg: 'node_modules/babel-loader/package.json',
  },
]

function consumerRequire(pkgRel) {
  const absPkg = resolve(repoRoot, pkgRel)
  if (!existsSync(absPkg)) {
    throw new Error(`Consumer package not found at expected path: ${pkgRel}`)
  }
  return createRequire(absPkg)
}

test('each eslint + babel-loader schema-utils consumer resolves ajv 6.x', () => {
  for (const { name, consumerPkg } of consumers) {
    let resolvedPkgPath
    let resolvedVersion
    try {
      const req = consumerRequire(consumerPkg)
      resolvedPkgPath = req.resolve('ajv/package.json')
      const ajvPkg = JSON.parse(readFileSync(resolvedPkgPath, 'utf8'))
      resolvedVersion = ajvPkg.version
    } catch (err) {
      throw new Error(
        `[${name}] failed to resolve ajv/package.json from ${consumerPkg}: ${err.message}`
      )
    }
    const major = String(resolvedVersion).split('.')[0]
    if (major !== '6') {
      throw new Error(
        `[${name}] expected ajv major 6 but resolved ${resolvedVersion} from ${resolvedPkgPath}`
      )
    }
    // Secondary check: at minimum, a hoisted ajv directory exists somewhere
    // along the consumer's node_modules ancestry. Existence of the resolved
    // path itself satisfies this — kept explicit to provide a useful failure
    // message if the resolution unexpectedly returns the top-level 8.x.
    if (!existsSync(resolvedPkgPath)) {
      throw new Error(
        `[${name}] resolved ajv path does not exist on disk: ${resolvedPkgPath}`
      )
    }
  }
})

test('top-level ajv is 8.x', () => {
  const top = resolve(repoRoot, 'node_modules/ajv/package.json')
  if (!existsSync(top)) {
    throw new Error(`top-level ajv not found at ${top}`)
  }
  // Use createRequire rooted at the consumer's nearest package.json so we
  // only assert what consumers actually resolve (8.x at the top level).
  const rootReq = createRequire(resolve(repoRoot, 'package.json'))
  const resolved = rootReq.resolve('ajv/package.json')
  const pkg = JSON.parse(readFileSync(resolved, 'utf8'))
  const major = String(pkg.version).split('.')[0]
  if (major !== '8') {
    throw new Error(`Expected top-level ajv 8.x, got ${pkg.version}`)
  }
})
