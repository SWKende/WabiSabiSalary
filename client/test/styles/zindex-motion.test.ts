import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('z-index and motion tokens', () => {
  it('exposes z-index layers', async () => {
    const css = await compile(`
      @use 'tokens/z-index' as z;
      .x { z: z.$z-index-overlay; nav: z.$z-index-nav; }
    `);
    expect(css).toMatch(/z:\s*100/);
    expect(css).toMatch(/nav:\s*10/);
  });

  it('exposes motion duration and easing', async () => {
    const css = await compile(`
      @use 'tokens/motion' as m;
      .x { d: m.$motion-duration-base; e: m.$motion-easing-standard; }
    `);
    expect(css).toMatch(/d:\s*200ms/);
    expect(css).toMatch(/e:\s*ease-in-out/);
  });
});