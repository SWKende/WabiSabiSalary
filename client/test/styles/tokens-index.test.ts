import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('tokens barrel', () => {
  it('exposes all L1 token namespaces through @forward', async () => {
    const css = await compile(`
      @use 'tokens' as t;
      .x {
        c: t.$palette-ink-900;
        f: t.$fs-300;
        s: t.$sp-4;
        r: t.$radius-md;
        z: t.$z-index-overlay;
        m: t.$motion-duration-base;
      }
    `);
    expect(css).toContain('c: #2c2c2c');
    expect(css).toContain('f: 32rpx');
    expect(css).toContain('s: 16rpx');
    expect(css).toContain('r: 16rpx');
    expect(css).toContain('z: 100');
    expect(css).toContain('m: 200ms');
  });
});