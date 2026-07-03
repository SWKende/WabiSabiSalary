import { View, Text } from '@tarojs/components'
import { useState, useMemo } from 'react'
import type { BookkeepingRecord } from '../Bookkeeping'
import { isRecordOnDate } from '../../utils/format'
import './index.scss'

interface MonthlyBarChartProps {
  records: BookkeepingRecord[]
}

export default function MonthlyBarChart({ records }: MonthlyBarChartProps) {
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense')

  const chartData = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: { day: number; dateStr: string; total: number; showLabel: boolean }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayTotal = records
        .filter((r) => r.type === chartType && isRecordOnDate(r.time, dateStr))
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

      days.push({
        day: d,
        dateStr,
        total: dayTotal,
        showLabel: d === 1 || d === daysInMonth || d % 5 === 1,
      })
    }

    const rawMaxVal = Math.max(...days.map((d) => d.total), 0)
    const maxValueIndex = rawMaxVal > 0 ? days.findIndex((d) => d.total === rawMaxVal) : -1
    return {
      days,
      rawMaxVal,
      scaleMaxVal: rawMaxVal > 0 ? rawMaxVal : 1,
      maxValueIndex,
      daysInMonth,
    }
  }, [records, chartType])

  const allZero = chartData.rawMaxVal === 0

  return (
    <View className='chart-section monthly-chart'>
      <View className='chart-header'>
        <Text className='chart-title'>月度趨勢</Text>
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
          <Text className='y-label'>{chartData.rawMaxVal > 0 ? chartData.rawMaxVal.toFixed(0) : '0'}</Text>
          <Text className='y-label'>
            {chartData.rawMaxVal > 0 ? (chartData.rawMaxVal / 2).toFixed(0) : '0'}
          </Text>
          <Text className='y-label'>0</Text>
        </View>

        <View className='chart-bars monthly-bars'>
          {chartData.days.map((day, index) => (
            <View key={day.day} className='chart-bar-col monthly-bar-col'>
              <Text className='bar-value monthly-bar-value'>
                {index === chartData.maxValueIndex ? day.total.toFixed(0) : ''}
              </Text>
              <View className='bar-track monthly-bar-track'>
                <View
                  className={`bar-fill monthly-bar-fill ${chartType}`}
                  style={{
                    height: `${(day.total / chartData.scaleMaxVal) * 100}%`,
                  }}
                />
              </View>
              <Text className='bar-label monthly-bar-label'>{day.showLabel ? day.day : ''}</Text>
            </View>
          ))}

          {allZero && (
            <View className='chart-empty'>
              <Text className='chart-empty-text'>尚無記錄</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
