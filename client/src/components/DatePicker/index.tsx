import { View, Text } from '@tarojs/components'
import { useState, useMemo, useEffect } from 'react'
import './index.scss'

interface DatePickerProps {
  visible: boolean
  value: string // YYYY-MM-DD
  onConfirm: (date: string) => void
  onCancel: () => void
}

export default function DatePicker({ visible, value, onConfirm, onCancel }: DatePickerProps) {
  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const [viewYear, setViewYear] = useState(() => {
    const d = value ? new Date(value) : new Date()
    return d.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value) : new Date()
    return d.getMonth() + 1
  })
  const [selectedDate, setSelectedDate] = useState(value || today)

  useEffect(() => {
    if (!visible) return
    const d = value ? new Date(value) : new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth() + 1)
    setSelectedDate(value || today)
  }, [visible, value, today])

  // 生成日历网格
  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
    const result: Array<{ day: number; dateStr: string; disabled: boolean; isToday: boolean }> = []

    // 前置空白
    for (let i = 0; i < firstDay; i++) {
      result.push({ day: 0, dateStr: '', disabled: true, isToday: false })
    }

    // 日期格子
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      result.push({
        day: d,
        dateStr,
        disabled: dateStr > today,
        isToday: dateStr === today,
      })
    }

    return result
  }, [viewYear, viewMonth, today])

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1)
      setViewMonth(12)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const nextMonth = () => {
    // 不允许切换到未来月份
    const todayDate = new Date()
    if (viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth() + 1) return
    if (viewMonth === 12) {
      setViewYear(viewYear + 1)
      setViewMonth(1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const goToToday = () => {
    const d = new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth() + 1)
    setSelectedDate(today)
  }

  // 判断下月按钮是否禁用
  const isNextDisabled = useMemo(() => {
    const todayDate = new Date()
    return viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth() + 1
  }, [viewYear, viewMonth])

  const weekLabels = ['日', '一', '二', '三', '四', '五', '六']

  if (!visible) return null

  return (
    <View className='dp-overlay' onClick={onCancel}>
      <View className='dp-panel' onClick={(e) => e.stopPropagation()}>
        {/* 头部：月份导航 */}
        <View className='dp-header'>
          <View className='dp-nav'>
            <View className='dp-nav-btn' onClick={prevMonth}>
              <Text className='dp-nav-text'>‹</Text>
            </View>
            <Text className='dp-month-label'>{viewYear}年 {viewMonth}月</Text>
            <View
              className={`dp-nav-btn ${isNextDisabled ? 'disabled' : ''}`}
              onClick={nextMonth}
            >
              <Text className='dp-nav-text'>›</Text>
            </View>
          </View>
          <View className='dp-today-btn' onClick={goToToday}>
            <Text className='dp-today-text'>今天</Text>
          </View>
        </View>

        <View className='dp-body'>
          {/* 星期标签行 */}
          <View className='dp-weekdays'>
            {weekLabels.map(label => (
              <Text key={label} className='dp-weekday'>{label}</Text>
            ))}
          </View>

          {/* 日期网格 */}
          <View className='dp-grid'>
            {days.map((item, i) => {
              if (item.day === 0) {
                return <View key={`empty-${i}`} className='dp-day dp-day-empty' />
              }
              const isSelected = item.dateStr === selectedDate
              const className = [
                'dp-day',
                item.disabled ? 'dp-day-disabled' : '',
                isSelected ? 'dp-day-selected' : '',
                item.isToday && !isSelected ? 'dp-day-today' : '',
              ].filter(Boolean).join(' ')

              return (
                <View
                  key={item.dateStr}
                  className={className}
                  onClick={() => !item.disabled && setSelectedDate(item.dateStr)}
                >
                  <Text className='dp-day-text'>{item.day}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 底部按钮 */}
        <View className='dp-footer'>
          <View className='dp-btn dp-btn-cancel' onClick={onCancel}>
            <Text className='dp-btn-text'>取 消</Text>
          </View>
          <View className='dp-btn dp-btn-confirm' onClick={() => onConfirm(selectedDate)}>
            <Text className='dp-btn-text'>確 認</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
