import { ScrollView, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { getExpenseCategories, summarizeExpenses } from '../../utils/expenseStatistics'
import { formatRecordTime, parseRecordDateTime } from '../../utils/format'
import { listRecords, type BookkeepingRecord } from '../../utils/store'
import { useStoreReady } from '../../utils/useStoreReady'
import './index.scss'

type PeriodMode = 'month' | 'year'
type Month = { year: number; month: number }

const detailPageSize = 20
const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
const months = Array.from({ length: 12 }, (_, index) => index + 1)

function formatAmount(cents: number): string {
  return currency.format(cents / 100)
}

function getPeriodBounds(records: readonly BookkeepingRecord[], today: Month) {
  let firstYear = today.year - 1
  let last = today

  for (const record of records) {
    if (record.type !== 'expense') continue
    const date = parseRecordDateTime(record.time)
    if (!date) continue
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    firstYear = Math.min(firstYear, year)
    if (year > last.year || (year === last.year && month > last.month)) {
      last = { year, month }
    }
  }

  return { firstYear, last }
}

function goBack() {
  if (Taro.getCurrentPages().length > 1) {
    void Taro.navigateBack()
    return
  }
  void Taro.reLaunch({ url: '/pages/index/index' })
}

function PeriodPicker({ mode, period, firstYear, last, onApply }: {
  mode: PeriodMode
  period: Month
  firstYear: number
  last: Month
  onApply: (year: number, month: number) => void
}) {
  const [year, setYear] = useState(String(period.year))
  const [month, setMonth] = useState(period.month)
  const monthLimit = Number(year) === last.year ? last.month : months.length
  const selectedMonth = Math.min(month, monthLimit)

  return (
    <form className='expense-period-picker' aria-label={mode === 'month' ? '選擇年月' : '選擇年份'} onSubmit={(event) => {
      event.preventDefault()
      onApply(Number(year), selectedMonth)
    }}>
      <label className='expense-period-field'>
        <span>年份</span>
        <input
          className='expense-period-input'
          type='number'
          inputMode='numeric'
          value={year}
          min={firstYear}
          max={last.year}
          onChange={(event) => setYear(event.currentTarget.value)}
          required
        />
      </label>
      {mode === 'month' && (
        <label className='expense-period-field'>
          <span>月份</span>
          <select className='expense-period-input' value={selectedMonth} onChange={(event) => setMonth(Number(event.currentTarget.value))}>
            {months.slice(0, monthLimit).map((value) => <option key={value} value={value}>{value} 月</option>)}
          </select>
        </label>
      )}
      <button type='submit' className='expense-period-apply'>查看統計</button>
    </form>
  )
}

function ExpenseStatistics() {
  const [records] = useState(listRecords)
  const [today] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [period, setPeriod] = useState(today)
  const [mode, setMode] = useState<PeriodMode>('month')
  const [openPicker, setOpenPicker] = useState<'period' | 'category' | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [details, setDetails] = useState<{ name: string; count: number } | null>(null)

  const { firstYear, last } = useMemo(() => getPeriodBounds(records, today), [records, today])
  const categoryOptions = useMemo(() => getExpenseCategories(records), [records])
  const { totalCents, categories } = useMemo(() => summarizeExpenses(
    records,
    mode === 'month' ? period : { year: period.year },
    selectedCategories,
  ), [records, mode, period, selectedCategories])

  const canGoBack = period.year > firstYear || (mode === 'month' && period.month > 1)
  const canGoForward = period.year < last.year || (mode === 'month' && period.month < last.month)
  const largestCategory = categories[0]?.cents ?? 0
  const categoryCount = selectedCategories.length
  const categorySummary = categoryCount > 1 ? `已選 ${categoryCount} 類` : selectedCategories[0] ?? '全部分類'
  const currentPeriod = period.year === today.year && (mode === 'year' || period.month === today.month)

  function selectMode(next: PeriodMode) {
    setMode(next)
    setDetails(null)
  }

  function selectPeriod(year: number, month: number) {
    setPeriod({ year, month: year === last.year ? Math.min(month, last.month) : month })
    setDetails(null)
  }

  function stepPeriod(step: number) {
    if (mode === 'year') {
      selectPeriod(period.year + step, period.month)
      return
    }
    const month = period.month + step
    if (month < 1) selectPeriod(period.year - 1, 12)
    else if (month > 12) selectPeriod(period.year + 1, 1)
    else selectPeriod(period.year, month)
  }

  function toggleCategory(name: string) {
    setSelectedCategories((selected) => selected.includes(name)
      ? selected.filter((category) => category !== name)
      : [...selected, name])
    setDetails(null)
  }

  function clearCategories() {
    setSelectedCategories([])
    setDetails(null)
  }

  function togglePicker(picker: 'period' | 'category') {
    setOpenPicker((open) => open === picker ? null : picker)
  }

  return (
    <View className='expense-statistics'>
      <ScrollView scrollY className='expense-scroll'>
        <main className='expense-content'>
          <header className='expense-header'>
            <button type='button' className='expense-back' aria-label='返回' onClick={goBack}>
              <span className='expense-chevron expense-chevron--left' aria-hidden='true' />
            </button>
            <h1>支出統計</h1>
          </header>

          <section className='expense-filters' aria-label='統計範圍'>
            <div className='expense-toolbar'>
              <div className='expense-period'>
                <button type='button' aria-label={mode === 'month' ? '上一個月' : '上一年'} disabled={!canGoBack} onClick={() => stepPeriod(-1)}>
                  <span className='expense-chevron expense-chevron--left' aria-hidden='true' />
                </button>
                <button
                  type='button'
                  className='expense-period-label'
                  aria-label={mode === 'month' ? `選擇年月，目前是 ${period.year} 年 ${period.month} 月` : `選擇年份，目前是 ${period.year} 年`}
                  aria-expanded={openPicker === 'period'}
                  aria-controls='expense-period-picker'
                  onClick={() => togglePicker('period')}
                >
                  <span>{period.year} 年{mode === 'month' && ` ${period.month} 月`}</span>
                  <span className='expense-chevron' aria-hidden='true' />
                </button>
                <button type='button' aria-label={mode === 'month' ? '下一個月' : '下一年'} disabled={!canGoForward} onClick={() => stepPeriod(1)}>
                  <span className='expense-chevron expense-chevron--right' aria-hidden='true' />
                </button>
              </div>
              <div className='expense-modes' role='group' aria-label='統計週期'>
                <button type='button' aria-pressed={mode === 'month'} onClick={() => selectMode('month')}>按月</button>
                <button type='button' aria-pressed={mode === 'year'} onClick={() => selectMode('year')}>按年</button>
              </div>
            </div>

            <div id='expense-period-picker' hidden={openPicker !== 'period'}>
              {openPicker === 'period' && (
                <PeriodPicker
                  key={`${mode}-${period.year}-${period.month}`}
                  mode={mode}
                  period={period}
                  firstYear={firstYear}
                  last={last}
                  onApply={(year, month) => {
                    selectPeriod(year, month)
                    setOpenPicker(null)
                  }}
                />
              )}
            </div>

            <button
              type='button'
              className='expense-category-trigger'
              aria-label={`分類篩選，${categorySummary}`}
              aria-expanded={openPicker === 'category'}
              aria-controls='expense-category-picker'
              onClick={() => togglePicker('category')}
            >
              <span>{categorySummary}</span>
              <span className='expense-chevron' aria-hidden='true' />
            </button>

            <div id='expense-category-picker' hidden={openPicker !== 'category'}>
              <div className='expense-chips' role='group' aria-label='選擇分類'>
                <button type='button' aria-pressed={categoryCount === 0} onClick={clearCategories}>
                  全部分類
                </button>
                {categoryOptions.map((name) => (
                  <button key={name} type='button' aria-pressed={selectedCategories.includes(name)} onClick={() => toggleCategory(name)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className='expense-results' aria-labelledby='expense-results-title'>
            <div className='expense-total'>
              <h2 id='expense-results-title'>{categoryCount > 0 ? '所選分類合計' : '支出合計'}</h2>
              <strong aria-live='polite'>{formatAmount(totalCents)}</strong>
            </div>

            {categories.length === 0 && (
              <div className='expense-empty'>
                <p role='status'>{categoryCount > 0 ? '這一期的所選分類尚無支出' : '這一期尚無支出記錄'}</p>
                {categoryCount > 0 ? (
                  <button type='button' onClick={clearCategories}>清除分類篩選</button>
                ) : !currentPeriod && (
                  <button type='button' onClick={() => selectPeriod(today.year, today.month)}>
                    {mode === 'month' ? '回到本月' : '回到本年'}
                  </button>
                )}
              </div>
            )}

            {categories.length > 0 && <h3 className='expense-breakdown-title'>分類明細</h3>}
            {categories.map(({ name, cents, entries }, index) => {
              const count = details?.name === name ? details.count : 0
              const expanded = count > 0
              const barWidth = largestCategory > 0 ? Math.max(0, cents) / largestCategory * 100 : 0
              const detailId = `expense-detail-${index}`

              return (
                <div key={name} className='expense-category'>
                  <button
                    type='button'
                    className='expense-category-button'
                    aria-expanded={expanded}
                    aria-controls={detailId}
                    onClick={() => setDetails(expanded ? null : { name, count: detailPageSize })}
                  >
                    <span className='expense-category-name'>{name}</span>
                    <span className='expense-category-amount'>{formatAmount(cents)}</span>
                    <span className='expense-chevron' aria-hidden='true' />
                    <span className='expense-bar' aria-hidden='true'>
                      <span style={{ width: `${barWidth}%` }} />
                    </span>
                  </button>

                  <div id={detailId} className='expense-detail-panel' hidden={!expanded}>
                    {expanded && (
                      <ul className='expense-details' aria-label={`${name}明細`}>
                        {entries.slice(0, count).map(({ record, cents: entryCents }) => (
                          <li key={record.id}>
                            <div><span>{record.note || name}</span><small>{formatRecordTime(record.time)}</small></div>
                            <span className='expense-entry-amount'>{formatAmount(entryCents)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {expanded && count < entries.length && (
                      <button type='button' className='expense-more' onClick={() => setDetails({ name, count: count + detailPageSize })}>顯示更多</button>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        </main>
      </ScrollView>
    </View>
  )
}

export default function ExpenseStatisticsPage() {
  const ready = useStoreReady()
  return ready ? <ExpenseStatistics /> : <View />
}
