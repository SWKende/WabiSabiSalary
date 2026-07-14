import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('semantic typography tokens', () => {
  it('maps display/heading/body/caption to L1 font scale', async () => {
    const css = await compile(`
      @use 'semantic/typography' as t;
      .x {
        d-xl: t.$font-display-xl;
        h-lg: t.$font-heading-lg;
        b-md: t.$font-body-md;
        c-sm: t.$font-caption-sm;
      }
    `);
    expect(css).toContain('d-xl: 88rpx');
    expect(css).toContain('h-lg: 44rpx');
    expect(css).toContain('b-md: 32rpx');
    expect(css).toContain('c-sm: 24rpx');
  });
});
