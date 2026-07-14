import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('semantic control tokens', () => {
  it('exposes input/btn heights and inner paddings', async () => {
    const css = await compile(`
      @use 'semantic/control' as c;
      .x {
        ism: c.$input-height-sm;
        imm: c.$input-height-md;
        iml: c.$input-height-lg;
        ipx: c.$input-padding-x;
        ipy: c.$input-padding-y;
        bsm: c.$btn-height-sm;
        bmd: c.$btn-height-md;
        blg: c.$btn-height-lg;
      }
    `);
    expect(css).toContain('ism: 56rpx');
    expect(css).toContain('imm: 72rpx');
    expect(css).toContain('iml: 88rpx');
    expect(css).toContain('ipx: 16rpx');
    expect(css).toContain('ipy: 8rpx');
    expect(css).toContain('bsm: 56rpx');
    expect(css).toContain('bmd: 80rpx');
    expect(css).toContain('blg: 96rpx');
  });
});
