import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('pages/index/index.scss color migration', () => {
  it('contains no raw hex color literals (except inside comments)', () => {
    const path = resolve(__dirname, '../../src/pages/index/index.scss');
    const src = readFileSync(path, 'utf8');
    // 移除注释行
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    // 禁止 #hex(3/6/8 位)
    const hexRe = /#[0-9a-fA-F]{3,8}\b/;
    const matches = stripped.match(hexRe);
    if (matches) {
      throw new Error(
        `Found raw hex literal(s) in index.scss: ${matches.slice(0, 5).join(', ')}`,
      );
    }
    expect(matches).toBeNull();
  });
});