import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('@tarojs/components', () => ({
  View: ({ children, className }: any) => createElement('div', { className }, children),
  Text: ({ children }: any) => createElement('span', null, children),
}))

const storage = new Map<string, unknown>()
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value) },
    removeStorageSync: (key: string) => { storage.delete(key) },
  },
}))

import App from '../../src/app'
import { __resetStore, isStoreReady } from '../../src/utils/store'

beforeEach(() => {
  storage.clear()
  __resetStore()
})

describe('App 入口门控', () => {
  it('本地库未就绪时也必须渲染 children —— Taro 的页面宿主元素就在 children 里', () => {
    expect(isStoreReady()).toBe(false)
    const html = renderToString(createElement(App, null, createElement('div', { id: 'page-host' })))
    expect(html).toContain('page-host')
  })

  it('未就绪时可以叠加启动占位屏，但它不能替代 children', () => {
    expect(isStoreReady()).toBe(false)
    const html = renderToString(createElement(App, null, createElement('div', { id: 'page-host' })))
    expect(html).toContain('app-boot')
    expect(html).toContain('page-host')
  })
})
