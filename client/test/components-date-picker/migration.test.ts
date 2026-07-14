import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FILE = '../../src/components/DatePicker/index.scss';

describe('../../src/components/DatePicker/index.scss migration', () => {
  it('contains no raw hex color literals (except inside comments)', () => {
    const path = resolve(__dirname, FILE);
    const src = readFileSync(path, 'utf8');
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    const matches = stripped.match(/#[0-9a-fA-F]{3,8}\b/);
    if (matches) {
      throw new Error(
        `Found raw hex literal(s): ${matches.slice(0, 5).join(', ')}`,
      );
    }
    expect(matches).toBeNull();
  });

  it('contains no raw font-size: <number>px', () => {
    const path = resolve(__dirname, FILE);
    const src = readFileSync(path, 'utf8');
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    const matches = stripped.match(/font-size:\s*[0-9]+px\b/);
    if (matches) {
      throw new Error(`Found raw font-size px literal(s): ${matches.slice(0, 5).join(', ')}`);
    }
    expect(matches).toBeNull();
  });

  it('contains no raw padding/margin/border-radius px literals (except 0/1)', () => {
    const path = resolve(__dirname, FILE);
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
