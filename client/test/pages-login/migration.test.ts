import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const FILE = '../../src/pages/login/index.scss';

describe('pages/login/index.scss migration', () => {
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

  it('SCSS forbids raw rgb()/rgba()/hsl()/hsla() literals in login and token index files', () => {
    const files = [
      resolve(__dirname, '../../src/pages/login/index.scss'),
      resolve(__dirname, '../../src/styles/variables.scss'),
      resolve(__dirname, '../../src/styles/tokens/_index.scss'),
      resolve(__dirname, '../../src/styles/semantic/_index.scss'),
      resolve(__dirname, '../../src/styles/components/_index.scss'),
    ];
    for (const f of files) {
      if (!existsSync(f)) continue;
      const src = readFileSync(f, 'utf8');
      const stripped = src
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n');
      const match = stripped.match(/\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
      if (match) {
        throw new Error(`Raw color function literal in ${f}: ${match[0]}`);
      }
    }
  });

  it('login TSX contains no placeholderStyle, inline raw hex color, or inline font-size:px', () => {
    const path = resolve(__dirname, '../../src/pages/login/index.tsx');
    const src = readFileSync(path, 'utf8');
    if (/placeholderStyle\s*=/.test(src)) {
      throw new Error('placeholderStyle is forbidden in login TSX (use placeholderClass + token styles)');
    }
    if (/style\s*=\s*['"][^'"]*#[0-9a-fA-F]{3,8}/.test(src)) {
      throw new Error('Inline raw hex color found in login TSX style attribute');
    }
    if (/style\s*=\s*['"][^'"]*font-size\s*:\s*[0-9]+px/.test(src)) {
      throw new Error('Inline font-size:px found in login TSX style attribute');
    }
  });
});