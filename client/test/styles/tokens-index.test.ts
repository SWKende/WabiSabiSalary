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
    // 本测试只验 @forward 是否把各命名空间透出，不钉具体档位数值——
    // 字号/间距阶梯的调整不该让这个测试失败。
    expect(css).toMatch(/f: \d+rpx/);
    expect(css).toMatch(/s: \d+rpx/);
    expect(css).toContain('r: 16rpx');
    expect(css).toContain('z: 100');
    expect(css).toContain('m: 200ms');
  });
});