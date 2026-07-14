import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('semantic color tokens', () => {
  it('aliases text/bg/divider/state tokens to palette', async () => {
    const css = await compile(`
      @use 'semantic/color' as c;
      .x {
        primary: c.$color-text-primary;
        placeholder: c.$color-text-placeholder;
        page: c.$color-bg-page;
        divider: c.$color-divider-subtle;
        success: c.$color-state-success;
        danger: c.$color-state-danger;
      }
    `);
    expect(css).toContain('primary: #2c2c2c');
    expect(css).toContain('placeholder: #8a8279');
    expect(css).toContain('page: #faf8f4');
    expect(css).toContain('divider: rgba(44, 44, 44, 0.08)');
    expect(css).toContain('success: #7a8c6e');
    expect(css).toContain('danger: #b85450');
  });
});