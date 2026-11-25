import { createElement, type PropsWithChildren } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { legacyPreference } = vi.hoisted(() => ({ legacyPreference: vi.fn() }))

vi.mock('@tarojs/components', () => ({
  View: ({ children, className }: PropsWithChildren<{ className?: string }>) =>
    createElement('div', { className }, children),
  ScrollView: ({ children }: PropsWithChildren) => createElement('div', null, children),
  Text: ({ children }: PropsWithChildren) => createElement('span', null, children),
  Image: () => null,
  Input: () => null,
  Switch: () => null,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => {
      if (key === 'local_meta_keys_v1') return '["home_page_preference"]'
      return key === 'home_page_preference' ? legacyPreference() : ''
    },
    useDidShow: () => undefined,
  },
}))

import Index from '../../src/pages/index'
import { __resetStore, bootstrapStore } from '../../src/utils/store'

describe('记账首页', () => {
  it.each(['', '"salary"'])('本地库就绪后直接进入记账（旧首页偏好：%s）', async (preference) => {
    __resetStore()
    legacyPreference.mockReturnValue(preference)
    await bootstrapStore()

    const html = renderToString(createElement(Index))

    expect(html).toContain('bookkeeping-page')
    expect(html).not.toContain('launch-screen-root')
    expect(html).not.toContain('countdown-card')
  })
})
