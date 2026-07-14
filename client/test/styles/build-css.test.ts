import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('build-css helper', () => {
  it('compiles plain SCSS to CSS', async () => {
    const result = await compile('$x: 32rpx; .a { font-size: $x; }');
    expect(result).toContain('font-size: 32rpx');
  });

  it('returns empty string for empty input', async () => {
    const result = await compile('');
    expect(result.trim()).toBe('');
  });
});
