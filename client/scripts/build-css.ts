import { compileString } from 'sass-embedded';
import { resolve } from 'path';

/**
 * 编译 SCSS 字符串为 CSS 字符串,用于 token/迁移回归测试。
 * @param scss SCSS 源文
 * @param basePath 项目根,默认 client/
 */
export async function compile(scss: string, basePath = resolve(__dirname, '..')): Promise<string> {
  const result = await compileString(scss, {
    loadPaths: [resolve(basePath, 'src/styles'), resolve(basePath, 'src')],
    style: 'expanded',
  });
  return result.css;
}
