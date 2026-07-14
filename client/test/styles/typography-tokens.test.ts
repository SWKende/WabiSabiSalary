import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('typography tokens', () => {
  it('exposes 9-step font scale in rpx', async () => {
    const css = await compile(`
      @use 'tokens/typography' as t;
      .x {
        fs-50: t.$fs-50;
        fs-75: t.$fs-75;
        fs-100: t.$fs-100;
        fs-200: t.$fs-200;
        fs-300: t.$fs-300;
        fs-400: t.$fs-400;
        fs-500: t.$fs-500;
        fs-600: t.$fs-600;
        fs-700: t.$fs-700;
      }
    `);
    expect(css).toContain('fs-50: 20rpx');
    expect(css).toContain('fs-75: 24rpx');
    expect(css).toContain('fs-100: 26rpx');
    expect(css).toContain('fs-200: 28rpx');
    expect(css).toContain('fs-300: 32rpx');
    expect(css).toContain('fs-400: 36rpx');
    expect(css).toContain('fs-500: 44rpx');
    expect(css).toContain('fs-600: 56rpx');
    expect(css).toContain('fs-700: 88rpx');
  });
});