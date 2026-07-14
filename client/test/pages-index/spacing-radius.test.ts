import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('pages/index/index.scss spacing + radius migration', () => {
  it('contains no raw padding/margin/border-radius px literals (must be tokens or 0)', () => {
    const path = resolve(__dirname, '../../src/pages/index/index.scss');
    const src = readFileSync(path, 'utf8');
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    const props = ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
                   'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
                   'border-radius'];
    const violations: string[] = [];
    for (const p of props) {
      const re = new RegExp(`${p}:\\s*[^;]*\\b([0-9]+)px\\b`, 'g');
      const matches = [...stripped.matchAll(re)];
      for (const m of matches) {
        // 单个 0px / 1px(物理边框)允许
        const val = m[1];
        if (val !== '0' && val !== '1') {
          violations.push(`${p}: ${m[0]}`);
        }
      }
    }
    if (violations.length) {
      throw new Error(`Raw px literal(s): ${violations.slice(0, 8).join('; ')}`);
    }
    expect(violations).toHaveLength(0);
  });
});
