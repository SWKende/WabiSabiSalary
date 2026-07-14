import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('pages/index/index.scss font-size migration', () => {
  it('contains no font-size: <number>px (only token references or rpx)', () => {
    const path = resolve(__dirname, '../../src/pages/index/index.scss');
    const src = readFileSync(path, 'utf8');
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    const re = /font-size:\s*[0-9]+px\b/;
    const matches = stripped.match(re);
    if (matches) {
      throw new Error(`Found raw font-size px literal(s): ${matches.slice(0, 5).join(', ')}`);
    }
    expect(matches).toBeNull();
  });
});