import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('variables.scss entry', () => {
  const entryPath = resolve(__dirname, '../../src/styles/variables.scss');

  it('exists at src/styles/variables.scss', () => {
    expect(existsSync(entryPath)).toBe(true);
  });

  it('forwards both L1 (tokens) and L2 (semantic) layers', () => {
    const src = readFileSync(entryPath, 'utf8');
    expect(src).toMatch(/@forward\s+['"]\.\/tokens['"]/);
    expect(src).toMatch(/@forward\s+['"]\.\/semantic['"]/);
  });
});