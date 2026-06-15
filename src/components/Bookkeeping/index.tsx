import { View, Text, Input, ScrollView } from '@tarojs/components'
import { useState, useMemo } from 'react'
import Taro from '@tarojs/taro'
import MonthlyBarChart from '../MonthlyBarChart'
import MonthlyPieChart from '../MonthlyPieChart'
import './index.scss'

// 记账设置类型
export interface BookkeepingSettings {
  showWeeklyBar: boolean
  showMonthlyBar: boolean
  showMonthlyPie: boolean
}

// 记账记录类型
export interface BookkeepingRecord {
  id: number
  type: 'expense' | 'income'
  amount: string
  note: string
  category: string
  time: string
}

// 旧数据迁移：无 type 字段时根据 category 推断
function migrateRecord(r: any): BookkeepingRecord {
  if (r.type) return r as BookkeepingRecord
  return {
    ...r,
    type: r.category === '收入' || r.category === '収入' ? 'income' : 'expense',
  }
}

// 记账页面组件
export default function BookkeepingPage({
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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const expenseCategories = ['餐飲', '交通', '購物', '娛樂', '居住', '通訊', '醫療', '教育']
  const incomeCategories = ['薪資', '獎金', '投資', '兼職', '紅包', '其他']

  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense')
  const [category, setCategory] = useState(expenseCategories[0])
  const [records, setRecords] = useState<BookkeepingRecord[]>(() => {
    try {
      const saved = Taro.getStorageSync('bookkeeping_records')
      return saved ? (saved as any[]).filter(Boolean).map(migrateRecord) : []
    } catch {
      return []
    }
  })

  const handleTypeSwitch = (type: 'expense' | 'income') => {
    setActiveType(type)
    setCategory(type === 'expense' ? expenseCategories[0] : incomeCategories[0])
  }

  const handleSubmit = () => {
    if (!amount) return
    const newRecord: BookkeepingRecord = {
      id: Date.now(),
      type: activeType,
      amount,
      note: note || category,
      category,
      time: new Date(selectedDate + 'T12:00:00').toISOString(),
    }
    const updated = [newRecord, ...records]
    setRecords(updated)
    try {
      Taro.setStorageSync('bookkeeping_records', updated)
    } catch {
      /* ignore */
    }
    setAmount('')
    setNote('')
    setSelectedDate(new Date().toISOString().split('T')[0])
    setShowForm(false)
    Taro.showToast({ title: '已記錄', icon: 'success' })
  }

  const handleDelete = (id: number) => {
    const updated = records.filter((r) => r.id !== id)
    setRecords(updated)
    try {
      Taro.setStorageSync('bookkeeping_records', updated)
    } catch {
      /* ignore */
    }
  }

  const monthTotal = useMemo(() => {
    const now = new Date()
    const monthRecords = records.filter((r) => {
      const d = new Date(r.time)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
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
      const dateStr = d.toISOString().split('T')[0]
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const dayTotal = records
        .filter((r) => r.type === chartType && r.time.startsWith(dateStr))
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

      {/* 记忆笔按钮 / 表单卡片 */}
      {!showForm ? (
        <View className='memory-pen-btn' onClick={() => setShowForm(true)}>
          <Text className='memory-pen-text'>記 一 筆</Text>
        </View>
      ) : (
        <View className='bookkeeping-form'>
          <View className='form-card'>
            <View className='form-close-btn' onClick={() => setShowForm(false)}>
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
              <Text className='submit-text'>記 錄</Text>
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
                <Text className='bar-value'>{day.total > 0 ? day.total.toFixed(0) : ''}</Text>
                <View className='bar-track'>
                  <View
                    className={`bar-fill ${chartType}`}
                    style={{
                      height: chartData.maxVal > 0 ? `${(day.total / chartData.maxVal) * 100}%` : '0%',
                    }}
                  />
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
          {records.slice(0, 20).map((record) => (
            <View key={record.id} className='record-item'>
              <View className='record-left'>
                <View className='record-category-badge'>
                  <Text className='record-category'>{record.category}</Text>
                </View>
                <View className='record-info'>
                  <Text className='record-note'>{record.note}</Text>
                  <Text className='record-time'>{record.time}</Text>
                </View>
              </View>
              <View className='record-right'>
                <Text className={`record-amount ${record.type === 'income' ? 'positive' : 'negative'}`}>
                  {record.type === 'income' ? '+' : '-'}¥{record.amount}
                </Text>
                <View className='record-delete' onClick={() => handleDelete(record.id)}>
                  <Text className='record-delete-icon'>×</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
