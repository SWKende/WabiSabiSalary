import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const HTML = resolve(__dirname, '../../src/index.html')
const CONFIG = resolve(__dirname, '../../config/index.js')

/**
 * index.html 的手写 rem 脚本和 Taro 的 rpx→rem 编译必须共用同一个基线。
 * 两边各说各话时整站会等比放大/缩小，却不会有任何报错——本项目曾因此全站大 17%。
 */
describe('rem 基线与 designWidth 一致性', () => {
  it('index.html 里有把根字号设为 视口宽/基线*20 的脚本', () => {
    const src = readFileSync(HTML, 'utf8')
    expect(src).toMatch(/\/\s*(\d+(?:\.\d+)?)\s*\*\s*20/)
  })

  it('脚本里的视口基线 = designWidth / 2', () => {
    const designWidth = Number(readFileSync(CONFIG, 'utf8').match(/designWidth:\s*(\d+)/)?.[1])
    const divisor = Number(readFileSync(HTML, 'utf8').match(/\/\s*(\d+(?:\.\d+)?)\s*\*\s*20/)?.[1])

    expect(designWidth).toBeGreaterThan(0)
    expect(divisor).toBe(designWidth / 2)
  })
})
