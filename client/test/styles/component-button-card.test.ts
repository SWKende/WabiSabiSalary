import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('L3 button + card', () => {
  it('button exposes --btn-* variables', async () => {
    const css = await compile(`
      @use 'components/button' as *;
    `);
    expect(css).toContain('--btn-bg-primary');
    expect(css).toContain('--btn-color-primary');
    expect(css).toContain('--btn-radius');
  });

  it('card exposes --card-* variables', async () => {
    const css = await compile(`
      @use 'components/card' as *;
    `);
    expect(css).toContain('--card-bg');
    expect(css).toContain('--card-padding-y');
    expect(css).toContain('--card-padding-x');
    expect(css).toContain('--card-radius');
    expect(css).toContain('--card-shadow');
  });
});
