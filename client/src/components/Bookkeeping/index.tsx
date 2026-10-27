import { View, Text, Input, ScrollView } from '@tarojs/components'
import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react'
import Taro from '@tarojs/taro'
import MonthlyBarChart from '../MonthlyBarChart'
import MonthlyPieChart from '../MonthlyPieChart'
import { createRecordTime, formatLocalDate, formatRecordTime, isRecordInMonth, isRecordOnDate } from '../../utils/format'
import { addRecord, listRecords, removeRecord, updateRecord, type BookkeepingRecord } from '../../utils/store'
import './index.scss'

export type { BookkeepingRecord }

// 记账设置类型
export interface BookkeepingSettings {
  showWeeklyBar: boolean
  showMonthlyBar: boolean
  showMonthlyPie: boolean
}

/** 「最近記錄」筛选里的「全部」项 */
const RECORD_FILTER_ALL = '全部'
/** 「最近記錄」每页条数 */
const RECORD_PAGE_SIZE = 20

// 记账页面组件
function BookkeepingPageInner({
  bkSettings,
  openDatePicker,
  openAmountKeyboard,
}: {
  bkSettings: BookkeepingSettings
  openDatePicker: (value: string, onConfirm: (date: string) => void) => void
  openAmountKeyboard: (value: string, onChange: (value: string) => void) => void
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()))
  const [showForm, setShowForm] = useState(false)
  // 非空表示表单处于编辑态：提交走 updateRecord 而不是 addRecord
  const [editingRecord, setEditingRecord] = useState<BookkeepingRecord | null>(null)
  const [formAnimDone, setFormAnimDone] = useState(false)
  const formAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 动画播完后移除 animation 属性，防止 Taro setData 触发重播
  const handleFormAnimEnd = useCallback(() => {
    setFormAnimDone(true)
    if (formAnimTimerRef.current) {
      clearTimeout(formAnimTimerRef.current)
      formAnimTimerRef.current = null
    }
  }, [])

  // 重置动画状态（关闭表单后再打开时需要）
  const openForm = useCallback(() => {
    setFormAnimDone(false)
    setShowForm(true)
    // setTimeout 兜底：若 onAnimationEnd 未触发，350ms 后标记完成
    if (formAnimTimerRef.current) clearTimeout(formAnimTimerRef.current)
    formAnimTimerRef.current = setTimeout(() => setFormAnimDone(true), 350)
  }, [])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (formAnimTimerRef.current) clearTimeout(formAnimTimerRef.current)
    }
  }, [])

  const [recordPendingDelete, setRecordPendingDelete] = useState<BookkeepingRecord | null>(null)
  const expenseCategories = ['餐飲', '交通', '購物', '数码', '娛樂', '居住', '通訊', '醫療', '教育']
  const incomeCategories = ['薪資', '獎金', '投資', '兼職', '紅包', '其他']

  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense')
  const [category, setCategory] = useState(expenseCategories[0])
  const [records, setRecords] = useState<BookkeepingRecord[]>(() => listRecords())

  // 「最近記錄」分类筛选，默认全部
  const [recordFilter, setRecordFilter] = useState<string>(RECORD_FILTER_ALL)
  // 分页：一次显示多少条，滚到底再追加一页
  const [visibleCount, setVisibleCount] = useState<number>(RECORD_PAGE_SIZE)

  const recordCategories = useMemo(() => {
    const seen = new Set<string>()
    for (const record of records) seen.add(record.category)
    return Array.from(seen)
  }, [records])

  // 选中的分类被删空后自动退回「全部」，避免停在一个空列表上
  const activeRecordFilter =
    recordFilter === RECORD_FILTER_ALL || recordCategories.includes(recordFilter)
      ? recordFilter
      : RECORD_FILTER_ALL

  const visibleRecords = useMemo(
    () =>
      activeRecordFilter === RECORD_FILTER_ALL
        ? records
        : records.filter((record) => record.category === activeRecordFilter),
    [records, activeRecordFilter],
  )

  const shownRecords = visibleRecords.slice(0, visibleCount)
  const hasMore = visibleRecords.length > visibleCount

  // 滚动到底附近就追加一页。
  // 不用 IntersectionObserver：它依赖页面可见，后台/隐藏状态下不派发回调，
  // 出问题时会静默失效；监听滚动容器的 scroll 事件在哪都能验。
  useEffect(() => {
    if (!hasMore) return
    // Taro 的 View 不透传 ref，只能按类名取这个哨兵（页面里只有这一个列表）
    const marker = document.querySelector('.record-load-more')
    const scroller = marker?.closest('.page-scroll') as HTMLElement | null
    if (!scroller) return

    const check = () => {
      const distanceToBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      if (distanceToBottom < 240) {
        setVisibleCount((count) => count + RECORD_PAGE_SIZE)
      }
    }
    scroller.addEventListener('scroll', check, { passive: true })
    // 绑定监听时可能已经在底部，那种情况不会有新的 scroll 事件，先自检一次
    check()
    return () => scroller.removeEventListener('scroll', check)
  }, [hasMore, visibleCount, visibleRecords.length])

  const handleTypeSwitch = (type: 'expense' | 'income') => {
    setActiveType(type)
    setCategory(type === 'expense' ? expenseCategories[0] : incomeCategories[0])
  }

  // 新建：清掉编辑态与上次残留输入
  const startCreate = () => {
    setEditingRecord(null)
    setAmount('')
    setNote('')
    setSelectedDate(formatLocalDate(new Date()))
    openForm()
  }

  // 编辑：把这条记录回填进同一个表单
  const startEdit = (record: BookkeepingRecord) => {
    setEditingRecord(record)
    setAmount(record.amount)
    setNote(record.note)
    setActiveType(record.type)
    setCategory(record.category)
    setSelectedDate(record.time.slice(0, 10))
    openForm()
  }

  const handleSubmit = () => {
    if (!amount) return

    // 日期没改就沿用原时间点，否则编辑会把记录重置成「现在」
    const time =
      editingRecord && selectedDate === editingRecord.time.slice(0, 10)
        ? editingRecord.time
        : createRecordTime(selectedDate)

    const payload = { type: activeType, amount, note: note || category, category, time }
    if (editingRecord) {
      updateRecord(editingRecord.id, payload)
    } else {
      addRecord(payload)
    }

    setRecords(listRecords())
    setAmount('')
    setNote('')
    setSelectedDate(formatLocalDate(new Date()))
    setEditingRecord(null)
    setShowForm(false)
    Taro.showToast({ title: editingRecord ? '已更新' : '已記錄', icon: 'success' })
  }

  const handleDelete = (id: string) => {
    removeRecord(id)
    setRecords(listRecords())
  }

  const openDeleteConfirm = (record: BookkeepingRecord) => {
    setRecordPendingDelete(record)
  }

  const closeDeleteConfirm = () => {
    setRecordPendingDelete(null)
  }

  const confirmDelete = () => {
    if (!recordPendingDelete) return
    handleDelete(recordPendingDelete.id)
    setRecordPendingDelete(null)
    Taro.showToast({ title: '已删除', icon: 'success' })
  }

  const monthTotal = useMemo(() => {
    const now = new Date()
    const monthRecords = records.filter((r) => {
      return isRecordInMonth(r.time, now.getFullYear(), now.getMonth())
    })
    const income = monthRecords
      .filter((r) => r.type === 'income')
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const expense = monthRecords
      .filter((r) => r.type === 'expense')
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    return income - expense
  }, [records])

  // 近7日柱状图数据
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense')

  const chartData = useMemo(() => {
    const days: { date: string; label: string; total: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = formatLocalDate(d)
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const dayTotal = records
        .filter((r) => r.type === chartType && isRecordOnDate(r.time, dateStr))
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
      days.push({ date: dateStr, label, total: dayTotal })
    }
    const maxVal = Math.max(...days.map((d) => d.total), 1)
    return { days, maxVal }
  }, [records, chartType])

  return (
    <View className='bookkeeping-page'>
      <View className='bookkeeping-header'>
        <Text className='bookkeeping-title'>記 帳</Text>
        <View className='bookkeeping-summary'>
          <Text className='summary-label'>本月收支</Text>
          <Text className={`summary-value ${monthTotal >= 0 ? 'positive' : 'negative'}`}>
            {monthTotal >= 0 ? '+' : ''}
            {monthTotal.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* 记忆笔按钮：常驻挂载，只用 display 隐藏。
          不要和下面的表单做三元互换 —— Taro H5 会复用同一位置的 taro-view-core，
          复用后不再把 onClick 绑回去，表单关过一次这个按钮就彻底点不动了。 */}
      <View
        className='memory-pen-btn'
        style={showForm ? { display: 'none' } : undefined}
        onClick={startCreate}
      >
        <Text className='memory-pen-text'>記 一 筆</Text>
      </View>

      {showForm && (
        <View
          className={`bookkeeping-form${formAnimDone ? ' is-anim-done' : ''}`}
          onAnimationEnd={handleFormAnimEnd}
        >
          <View className='form-card'>
            <View
              className='form-close-btn'
              onClick={() => {
                setShowForm(false)
                setEditingRecord(null)
              }}
            >
              <Text className='form-close-icon'>✕</Text>
            </View>
            <View className='amount-row'>
              <Text className='amount-symbol'>¥</Text>
              <View
                className={`amount-display ${amount ? 'has-value' : 'is-empty'}`}
                onClick={() => openAmountKeyboard(amount, setAmount)}
              >
                <Text className='amount-display-text'>{amount || '請輸入金額'}</Text>
              </View>
            </View>

            <View className='category-section'>
              <View className='type-tabs'>
                <View
                  className={`tab ${activeType === 'expense' ? 'active' : ''}`}
                  onClick={() => handleTypeSwitch('expense')}
                >
                  <Text className='tab-text'>支 出</Text>
                </View>
                <View
                  className={`tab ${activeType === 'income' ? 'active' : ''}`}
                  onClick={() => handleTypeSwitch('income')}
                >
                  <Text className='tab-text'>收 入</Text>
                </View>
              </View>
              <ScrollView scrollX className='category-scroll'>
                <View className='category-row'>
                  {(activeType === 'expense' ? expenseCategories : incomeCategories).map((cat) => (
                    <View
                      key={cat}
                      className={`cat-chip ${category === cat ? 'active' : ''}`}
                      onClick={() => setCategory(cat)}
                    >
                      <Text className='cat-chip-text'>{cat}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* 日期选择器 */}
            <View className='date-row'>
              <Text className='date-label'>日期</Text>
              <View
                className='date-picker'
                onClick={() => openDatePicker(selectedDate, (date) => setSelectedDate(date))}
              >
                <Text className='date-value'>{selectedDate}</Text>
                <Text className='date-arrow'>›</Text>
              </View>
            </View>

            <View className='note-row'>
              <Text className='note-label'>備註</Text>
              <Input
                className='note-input'
                placeholder='備註（選填）'
                value={note}
                onInput={(e) => setNote(e.detail.value)}
              />
            </View>

            <View
              className={`submit-btn ${!amount ? 'disabled' : ''}`}
              onClick={handleSubmit}
            >
              <Text className='submit-text'>{editingRecord ? '更 新' : '記 錄'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 近7日柱状图 */}
      {bkSettings.showWeeklyBar && (
      <View className='chart-section'>
        <View className='chart-header'>
          <Text className='chart-title'>近 7 日</Text>
          <View className='chart-toggle'>
            <View
              className={`toggle-btn ${chartType === 'expense' ? 'active' : ''}`}
              onClick={() => setChartType('expense')}
            >
              <Text className='toggle-text'>支出</Text>
            </View>
            <View
              className={`toggle-btn ${chartType === 'income' ? 'active' : ''}`}
              onClick={() => setChartType('income')}
            >
              <Text className='toggle-text'>收入</Text>
            </View>
          </View>
        </View>

        <View className='chart-body'>
          <View className='chart-y-axis'>
            <Text className='y-label'>{chartData.maxVal > 0 ? chartData.maxVal.toFixed(0) : '0'}</Text>
            <Text className='y-label'>{chartData.maxVal > 0 ? (chartData.maxVal / 2).toFixed(0) : '0'}</Text>
            <Text className='y-label'>0</Text>
          </View>
          <View className='chart-bars'>
            {chartData.days.map((day, i) => (
              <View key={i} className='chart-bar-col'>
                <View className='bar-track'>
                  <View className='bar-stack'>
                    <Text className='bar-value'>{day.total > 0 ? day.total.toFixed(0) : ''}</Text>
                    <View
                      className={`bar-fill ${chartType}`}
                      style={{
                        height: chartData.maxVal > 0 ? `${(day.total / chartData.maxVal) * 100}%` : '0%',
                      }}
                    />
                  </View>
                </View>
                <Text className='bar-label'>{day.label}</Text>
              </View>
            ))}
            {chartData.days.every((d) => d.total === 0) && (
              <View className='chart-empty'>
                <Text className='chart-empty-text'>尚無記錄</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      )}

      {/* 月度柱状图 */}
      {bkSettings.showMonthlyBar && <MonthlyBarChart records={records} />}

      {/* 月度饼状图 */}
      {bkSettings.showMonthlyPie && <MonthlyPieChart records={records} />}

      {records.length > 0 && (
        <View className='records-section'>
          <Text className='records-title'>最近記錄</Text>
          <View className='record-filter'>
            {[RECORD_FILTER_ALL, ...recordCategories].map((tag) => (
              <View
                key={tag}
                className={`record-tag${activeRecordFilter === tag ? ' is-active' : ''}`}
                onClick={() => {
                  setRecordFilter(tag)
                  setVisibleCount(RECORD_PAGE_SIZE)
                }}
              >
                <Text className='record-tag-text'>{tag}</Text>
              </View>
            ))}
          </View>
          {shownRecords.map((record) => (
            <View key={record.id} className='record-item' onClick={() => startEdit(record)}>
              <View className='record-left'>
                <View className='record-category-badge'>
                  <Text className='record-category'>{record.category}</Text>
                </View>
                <View className='record-info'>
                  <Text className='record-note'>{record.note}</Text>
                  <Text className='record-time'>{formatRecordTime(record.time)}</Text>
                </View>
              </View>
              <View className='record-right'>
                <Text className={`record-amount ${record.type === 'income' ? 'positive' : 'negative'}`}>
                  {record.type === 'income' ? '+' : '-'}¥{record.amount}
                </Text>
                <View
                  className='record-delete'
                  onClick={(event) => {
                    event.stopPropagation()
                    openDeleteConfirm(record)
                  }}
                >
                  <Text className='record-delete-icon'>×</Text>
                </View>
              </View>
            </View>
          ))}

          {hasMore && (
            <View
              className='record-load-more'
              onClick={() => setVisibleCount((count) => count + RECORD_PAGE_SIZE)}
            >
              <Text className='record-load-more-text'>下滑加載更多</Text>
            </View>
          )}
        </View>
      )}

      {recordPendingDelete && (
        <View className='record-confirm-overlay' onClick={closeDeleteConfirm}>
          <View className='record-confirm-dialog' onClick={(e) => e.stopPropagation()}>
            <Text className='record-confirm-title'>确认删除</Text>
            <Text className='record-confirm-desc'>
              将删除"{recordPendingDelete.note || recordPendingDelete.category}"
            </Text>
            <Text className='record-confirm-meta'>
              {recordPendingDelete.type === 'income' ? '+' : '-'}¥{recordPendingDelete.amount} · {formatRecordTime(recordPendingDelete.time)}
            </Text>
            <View className='record-confirm-actions'>
              <View className='record-confirm-btn is-cancel' onClick={closeDeleteConfirm}>
                <Text className='record-confirm-btn-text'>取消</Text>
              </View>
              <View className='record-confirm-btn is-danger' onClick={confirmDelete}>
                <Text className='record-confirm-btn-text'>删除</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const BookkeepingPage = memo(BookkeepingPageInner)
export default BookkeepingPage
