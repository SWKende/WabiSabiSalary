import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('spacing tokens', () => {
  it('exposes 4rpx-grid spacing scale', async () => {
    const css = await compile(`
      @use 'tokens/spacing' as s;
      .x {
        sp-0: s.$sp-0;
        sp-1: s.$sp-1;
        sp-4: s.$sp-4;
        sp-8: s.$sp-8;
        sp-16: s.$sp-16;
      }
    `);
    expect(css).toContain('sp-0: 0');
    expect(css).toContain('sp-1: 4rpx');
    expect(css).toContain('sp-4: 16rpx');
    expect(css).toContain('sp-8: 32rpx');
    expect(css).toContain('sp-16: 64rpx');
  });
});