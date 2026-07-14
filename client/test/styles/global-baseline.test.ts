import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from '../../scripts/build-css';

describe('global.scss baseline', () => {
  const entryPath = resolve(__dirname, '../../src/styles/global.scss');

  it('exists at src/styles/global.scss', () => {
    expect(existsSync(entryPath)).toBe(true);
  });

  it('declares a top-level :root selector', () => {
    const src = readFileSync(entryPath, 'utf8');
    expect(src).toMatch(/^:root\s*\{/m);
  });

  it('compiles without error via @use import', async () => {
    // Sass strips empty rule blocks (e.g. `:root {}` → ""), so we cannot
    // assert non-empty CSS output. Instead, verify the file is importable
    // through the same loadPaths the production pipeline uses.
    const css = await compile("@use '../styles/global';");
    expect(typeof css).toBe('string');
  });
});