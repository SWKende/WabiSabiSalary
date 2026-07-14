import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('semantic space tokens', () => {
  it('exposes card/section/page compound paddings', async () => {
    const css = await compile(`
      @use 'semantic/space' as s;
      .x {
        sm: s.$space-card-padding-sm;
        md: s.$space-card-padding-md;
        lg: s.$space-card-padding-lg;
        sy: s.$space-section-y;
        se: s.$space-section-edge;
        pe: s.$space-page-edge;
        cx: s.$space-control-padding-x;
      }
    `);
    expect(css).toContain('sm: 12rpx 16rpx');
    expect(css).toContain('md: 24rpx 16rpx');
    expect(css).toContain('lg: 32rpx 24rpx');
    expect(css).toContain('sy: 32rpx');
    expect(css).toContain('se: 40rpx 16rpx');
    expect(css).toContain('pe: 24rpx 16rpx');
    expect(css).toContain('cx: 16rpx');
  });
});