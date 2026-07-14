import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('global.scss :root variables', () => {
  it('sets all semantic + control CSS vars on :root', async () => {
    const css = await compile("@use 'styles/global';");
    // 语义颜色
    expect(css).toContain('--color-text-primary');
    expect(css).toContain('--color-bg-page');
    expect(css).toContain('--color-brand-primary');
    // 控件
    expect(css).toContain('--input-height-md');
    expect(css).toContain('--input-padding-x');
    expect(css).toContain('--btn-height-md');
  });
});