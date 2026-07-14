import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('radius tokens', () => {
  it('exposes radius scale xs through full', async () => {
    const css = await compile(`
      @use 'tokens/radius' as r;
      .x {
        none: r.$radius-none;
        xs: r.$radius-xs;
        sm: r.$radius-sm;
        md: r.$radius-md;
        lg: r.$radius-lg;
        xl: r.$radius-xl;
        full: r.$radius-full;
      }
    `);
    expect(css).toContain('none: 0');
    expect(css).toContain('xs: 4rpx');
    expect(css).toContain('sm: 8rpx');
    expect(css).toContain('md: 16rpx');
    expect(css).toContain('lg: 24rpx');
    expect(css).toContain('xl: 40rpx');
    expect(css).toContain('full: 9999px');
  });
});