import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('palette tokens', () => {
  it('exposes ink/sand/accent/olive/rouge/alpha ramps', async () => {
    const css = await compile(`
      @use 'tokens/palette' as p;
      .x {
        ink-900: p.$palette-ink-900;
        sand-50: p.$palette-sand-50;
        accent-500: p.$palette-accent-500;
        accent-700: p.$palette-accent-700;
        olive-500: p.$palette-olive-500;
        rouge-500: p.$palette-rouge-500;
        alpha-08: p.$palette-alpha-ink-08;
      }
    `);
    expect(css).toContain('ink-900: #2c2c2c');
    expect(css).toContain('sand-50: #faf8f4');
    expect(css).toContain('accent-500: #c8b99a');
    expect(css).toContain('accent-700: #a89878');
    expect(css).toContain('olive-500: #7a8c6e');
    expect(css).toContain('rouge-500: #b85450');
    expect(css).toContain('alpha-08: rgba(44, 44, 44, 0.08)');
  });
});
