import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('@tarojs/components', () => ({
  View: ({ children, className, style }: any) =>
    createElement('div', { className, style }, children),
  Text: ({ children, className }: any) => createElement('span', { className }, children),
}))

// H5 / Capacitor WebView 里的真实形态：小程序专属 API 返回被 reject 的 Promise，
// 包在 try/catch 里也拦不住，只会变成未处理的 Promise 拒绝。
const { getMenuButtonBoundingClientRect } = vi.hoisted(() => ({
  getMenuButtonBoundingClientRect: vi.fn(() =>
    Promise.reject({ errMsg: 'getMenuButtonBoundingClientRect:fail 暂时不支持 API' })
  ),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getMenuButtonBoundingClientRect,
    // H5 的 getSystemInfoSync 拿不到状态栏高度，实测返回 NaN
    getSystemInfoSync: () => ({ statusBarHeight: NaN, windowWidth: 375 }),
  },
}))

import CustomNavBar from '../../src/components/CustomNavBar'

beforeEach(() => {
  getMenuButtonBoundingClientRect.mockClear()
})

describe('CustomNavBar', () => {
  it('渲染时不调用小程序专属的胶囊按钮 API', () => {
    renderToString(createElement(CustomNavBar, { timeStr: '10:00:00', status: 'resting' } as any))
    expect(getMenuButtonBoundingClientRect).not.toHaveBeenCalled()
  })

  it('不把 NaN 写进内联高度 —— 浏览器会整条丢弃，导航栏高度失效', () => {
    const html = renderToString(
      createElement(CustomNavBar, { timeStr: '10:00:00', status: 'resting' } as any)
    )
    expect(html).not.toContain('NaN')
    expect(html).toContain('custom-nav-bar')
  })
})
