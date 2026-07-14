import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('L3 cell component', () => {
  it('exposes --cell-* variables', async () => {
    const css = await compile(`
      @use 'components/cell' as *;
    `);
    expect(css).toContain('--cell-bg');
    expect(css).toContain('--cell-padding-y');
    expect(css).toContain('--cell-padding-x');
    expect(css).toContain('--cell-divider');
  });
});