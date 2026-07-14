import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('L3 input component', () => {
  it('exposes --input-* CSS variables and uses var() in properties', async () => {
    const css = await compile(`
      @use 'components/input' as *;
    `);
    expect(css).toContain('--input-height');
    expect(css).toContain('--input-padding-x');
    expect(css).toContain('--input-bg');
    expect(css).toContain('--input-radius');
    expect(css).toContain('--input-font');
    expect(css).toMatch(/height:\s*var\(--input-height\)/);
    expect(css).toMatch(/border-radius:\s*var\(--input-radius\)/);
  });
});