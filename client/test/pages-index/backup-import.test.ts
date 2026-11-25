// @vitest-environment jsdom

import { act, createElement, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { pickBackupFile, showToast } = vi.hoisted(() => ({
  pickBackupFile: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: (props: ComponentProps<'div'>) => createElement('div', props),
  ScrollView: ({ children }: ComponentProps<'div'>) => createElement('div', null, children),
  Text: (props: ComponentProps<'span'>) => createElement('span', props),
  Input: () => null,
  Switch: () => null,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => localStorage.getItem(key) ?? '',
    setStorageSync: (key: string, value: string) => localStorage.setItem(key, value),
    removeStorageSync: (key: string) => localStorage.removeItem(key),
    showToast,
  },
}))

vi.mock('../../src/utils/backupIO', () => ({ pickBackupFile, exportBackupFile: vi.fn() }))

import Index from '../../src/pages/index'
import { BACKUP_APP, BACKUP_VERSION } from '../../src/utils/backup'
import { createRecordTime, formatLocalDate } from '../../src/utils/format'
import { __resetStore, addRecord, bootstrapStore } from '../../src/utils/store'

describe('从记账首页导入备份', () => {
  let container: HTMLDivElement
  let app: Root

  function textElement(label: string): HTMLElement {
    const element = [...container.querySelectorAll('span')].find((span) => span.textContent === label)
    if (!element) throw new Error(`Missing page label: ${label}`)
    return element
  }

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    __resetStore()
    await bootstrapStore()
    container = document.createElement('div')
    document.body.append(container)
    app = createRoot(container)
  })

  afterEach(() => {
    act(() => app.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('确认覆盖后立即显示备份记录、金额和图表设置', async () => {
    const time = createRecordTime(formatLocalDate(new Date()))
    const entry = { type: 'expense' as const, category: '餐飲', time }
    addRecord({ ...entry, amount: '2', note: '导入前的账目' })
    pickBackupFile.mockResolvedValueOnce(JSON.stringify({
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      records: [{ ...entry, id: 'restored', amount: '38.50', note: '从备份恢复的午餐' }],
      meta: { bookkeeping_settings: { showWeeklyBar: false } },
    }))

    act(() => app.render(createElement(Index)))
    expect(container.textContent).toContain('导入前的账目')
    expect(container.textContent).toContain('近 7 日')

    act(() => container.querySelector<HTMLElement>('[aria-label="记账设置"]')?.click())
    await act(async () => textElement('导入备份').click())
    await act(async () => textElement('覆盖导入').click())

    expect(container.textContent).toContain('从备份恢复的午餐')
    expect(container.textContent).not.toContain('导入前的账目')
    expect(container.querySelector('.summary-value')?.textContent).toBe('-38.50')
    expect(container.textContent).not.toContain('近 7 日')
  })
})
