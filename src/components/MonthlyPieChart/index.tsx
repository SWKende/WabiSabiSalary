import { View, Text } from '@tarojs/components'
import { useState, useMemo } from 'react'
import type { BookkeepingRecord } from '../Bookkeeping'
import './index.scss'

interface MonthlyPieChartProps {
  records: BookkeepingRecord[]
}

const CATEGORY_COLORS: Record<string, string> = {
  // 支出分类
  '餐飲': '#b85450',
  '交通': '#c8b99a',
  '購物': '#7a8c6e',
  '娛樂': '#a89878',
  '居住': '#5c5650',
  '通訊': '#d4a574',
  '醫療': '#6b8fa3',
  '教育': '#9b7ea6',
  // 收入分类
  '薪資': '#7a8c6e',
  '獎金': '#c8b99a',
  '投資': '#6b8fa3',
  '兼職': '#a89878',
  '紅包': '#b85450',
  '其他': '#5c5650',
}

export default function MonthlyPieChart({ records }: MonthlyPieChartProps) {
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense')

  const pieData = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    const monthRecords = records.filter((r) => {
      const d = new Date(r.time)
      return d.getMonth() === month && d.getFullYear() === year && r.type === chartType
    })

    const categoryMap = new Map<string, number>()
    monthRecords.forEach((r) => {
      const current = categoryMap.get(r.category) || 0
      categoryMap.set(r.category, current + (parseFloat(r.amount) || 0))
    })

    const total = Array.from(categoryMap.values()).reduce((s, v) => s + v, 0)
    if (total === 0) return { slices: [], total: 0, conicGradient: '' }

    const slices = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percent: (amount / total) * 100,
        color: CATEGORY_COLORS[category] || '#8a8279',
      }))
      .sort((a, b) => b.amount - a.amount)

    // Build conic-gradient string
    let startPercent = 0
    const stops: string[] = []
    slices.forEach((slice) => {
      const endPercent = startPercent + slice.percent
      stops.push(`${slice.color} ${startPercent}% ${endPercent}%`)
      startPercent = endPercent
    })

    return { slices, total, conicGradient: `conic-gradient(${stops.join(', ')})` }
  }, [records, chartType])

  const isEmpty = pieData.slices.length === 0

  return (
    <View className='chart-section pie-chart-section'>
      <View className='chart-header'>
        <Text className='chart-title'>分類佔比</Text>
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

      {isEmpty ? (
        <View className='pie-empty'>
          <Text className='chart-empty-text'>尚無記錄</Text>
        </View>
      ) : (
        <View className='pie-body'>
          <View className='pie-chart-area'>
            <View className='pie-circle' style={{ background: pieData.conicGradient }} />
          </View>
          <View className='pie-legend'>
            {pieData.slices.map((slice) => (
              <View key={slice.category} className='legend-item'>
                <View className='legend-color' style={{ background: slice.color }} />
                <Text className='legend-name'>{slice.category}</Text>
                <Text className='legend-percent'>{slice.percent.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}
