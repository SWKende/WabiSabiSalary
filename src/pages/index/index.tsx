import { View, Text, Input, ScrollView, Swiper, SwiperItem } from '@tarojs/components'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Taro from '@tarojs/taro'
import DatePicker from '../../components/DatePicker'
import './index.scss'

// 默认配置
const DEFAULT_CONFIG = {
  monthlySalary: 3000,
  workDaysPerMonth: 30,
  workHoursPerDay: 8,
  workStartHour: 8,
  workEndHour: 16,
  payday: 1,
}

interface SalaryConfig {
  monthlySalary: number
  workDaysPerMonth: number
  workHoursPerDay: number
  workStartHour: number
  workEndHour: number
  payday: number
}

// 格式化：固定小数位，避免 toLocaleString 的不确定性
function formatMoney2(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatMoney4(amount: number): string {
  return amount.toFixed(4)
}

// 单个字符位 — 独立检测变化并触发动画
// 使用 View 包裹而非 Text，避免 Taro Text 组件对 children key 的干扰
function DigitSlot({ char }: { char: string }) {
  const [animating, setAnimating] = useState(false)
  const prevRef = useRef(char)

  useEffect(() => {
    if (char !== prevRef.current) {
      prevRef.current = char
      setAnimating(false)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true)
        })
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [char])

  return (
    <View className={`animated-char ${animating ? 'char-slide-up' : ''}`}>
      {char}
    </View>
  )
}

// 动画数字组件 — 按数字位独立控制，仅变化的位触发动画
function AnimatedNumber({ value, className }: { value: string; className?: string }) {
  // 直接按字符拆分，每个字符一个独立槽位
  // key 使用 "pos-" 前缀 + 绝对位置索引，确保唯一且稳定
  const chars = useMemo(() => {
    return value.split('').map((char, i) => ({
      char,
      key: `pos-${i}`,
    }))
  }, [value])

  return (
    <View className={`animated-number ${className || ''}`}>
      {chars.map((item) => (
        <DigitSlot key={item.key} char={item.char} />
      ))}
    </View>
  )
}

// 设置面板项
function SettingRow({ label, value, onChange, suffix }: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
}) {
  return (
    <View className='setting-row'>
      <Text className='setting-label'>{label}</Text>
      <View className='setting-input-wrap'>
        <Input
          className='setting-input'
          type='number'
          value={value}
          onInput={(e) => onChange(e.detail.value)}
        />
        {suffix && <Text className='setting-suffix'>{suffix}</Text>}
      </View>
    </View>
  )
}

// 获取窗口信息（兼容新旧版本基础库）
function getWindowInfo() {
  try {
    if (typeof Taro.getWindowInfo === 'function') {
      return Taro.getWindowInfo()
    }
  } catch { /* ignore */ }
  // 回退：旧版 API
  const fallback = Taro.getSystemInfoSync()
  return { statusBarHeight: fallback.statusBarHeight ?? 20, windowWidth: fallback.windowWidth ?? 375 }
}

// 自定义导航栏 — 适配微信小程序胶囊按钮
function CustomNavBar({ timeStr, isWorking, capsuleRight, hasCapsule }: {
  timeStr: string
  isWorking: boolean
  capsuleRight: number
  hasCapsule: boolean
}) {
  const windowInfo = getWindowInfo()
  const statusBarHeight = windowInfo.statusBarHeight ?? 20

  // 胶囊按钮位置（CSS 像素）
  let capsuleTop = statusBarHeight + 4
  let capsuleBottom = statusBarHeight + 36
  try {
    const rect = Taro.getMenuButtonBoundingClientRect()
    if (rect && rect.width > 0) {
      capsuleTop = rect.top
      capsuleBottom = rect.bottom
    }
  } catch { /* ignore */ }

  // 胶囊垂直中心（相对状态栏底部）
  const capsuleCenterOffset = (capsuleTop + capsuleBottom) / 2 - statusBarHeight
  // 导航内容区高度 = 胶囊中心偏移 × 2（上下对称，flex 居中后正好对齐胶囊中心）
  const navContentHeight = capsuleCenterOffset * 2

  return (
    <View className='custom-nav-bar'>
      {/* 状态栏占位 */}
      <View className='nav-status-spacer' style={{ height: `${statusBarHeight}px` }} />
      {/* 导航内容 */}
      <View
        className={`nav-content ${hasCapsule ? 'nav-capsule' : ''}`}
        style={{
          height: `${navContentHeight}px`,
          paddingRight: hasCapsule ? `${capsuleRight}px` : '4px',
        }}
      >
        {!hasCapsule && <Text className='status-time'>{timeStr}</Text>}
        <View className={`status-badge ${isWorking ? 'working' : 'resting'}`}>
          <View className='status-dot' />
          <Text className='status-text'>{isWorking ? '稼働中' : '休憩中'}</Text>
        </View>
      </View>
    </View>
  )
}

// 记账记录类型
interface BookkeepingRecord {
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
    type: (r.category === '收入' || r.category === '収入') ? 'income' : 'expense',
  }
}

// 记账页面组件
function BookkeepingPage() {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const expenseCategories = ['餐飲', '交通', '購物', '娛樂', '居住', '通訊', '醫療', '教育']
  const incomeCategories = ['薪資', '獎金', '投資', '兼職', '紅包', '其他']

  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense')
  const [category, setCategory] = useState(expenseCategories[0])
  const [records, setRecords] = useState<BookkeepingRecord[]>(() => {
    try {
      const saved = Taro.getStorageSync('bookkeeping_records')
      return saved ? (saved as any[]).filter(Boolean).map(migrateRecord) : []
    } catch { return [] }
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
    try { Taro.setStorageSync('bookkeeping_records', updated) } catch {}
    setAmount('')
    setNote('')
    setSelectedDate(new Date().toISOString().split('T')[0])
    Taro.showToast({ title: '已記錄', icon: 'success' })
  }

  const handleDelete = (id: number) => {
    const updated = records.filter(r => r.id !== id)
    setRecords(updated)
    try { Taro.setStorageSync('bookkeeping_records', updated) } catch {}
  }

  const monthTotal = useMemo(() => {
    const now = new Date()
    const monthRecords = records.filter(r => {
      const d = new Date(r.time)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const income = monthRecords.filter(r => r.type === 'income').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const expense = monthRecords.filter(r => r.type === 'expense').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
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
        .filter(r => r.type === chartType && r.time.startsWith(dateStr))
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
      days.push({ date: dateStr, label, total: dayTotal })
    }
    const maxVal = Math.max(...days.map(d => d.total), 1)
    return { days, maxVal }
  }, [records, chartType])

  return (
    <View className='bookkeeping-page'>
      <View className='bookkeeping-header'>
        <Text className='bookkeeping-title'>記 帳</Text>
        <View className='bookkeeping-summary'>
          <Text className='summary-label'>本月收支</Text>
          <Text className={`summary-value ${monthTotal >= 0 ? 'positive' : 'negative'}`}>
            {monthTotal >= 0 ? '+' : ''}{monthTotal.toFixed(2)}
          </Text>
        </View>
      </View>

      <View className='bookkeeping-form'>
        <View className='form-card'>
          <View className='amount-row'>
            <Text className='amount-symbol'>¥</Text>
            <Input
              className='amount-input'
              type='digit'
              placeholder='請輸入金額'
              placeholderStyle='font-size: 28px; color: #a89878;'
              value={amount}
              onInput={(e) => setAmount(e.detail.value)}
            />
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
                {(activeType === 'expense' ? expenseCategories : incomeCategories).map(cat => (
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
            <View className='date-picker' onClick={() => setShowDatePicker(true)}>
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

      {/* 近7日柱状图 */}
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
                    style={{ height: chartData.maxVal > 0 ? `${(day.total / chartData.maxVal) * 100}%` : '0%' }}
                  />
                </View>
                <Text className='bar-label'>{day.label}</Text>
              </View>
            ))}
            {chartData.days.every(d => d.total === 0) && (
              <View className='chart-empty'>
                <Text className='chart-empty-text'>尚無記錄</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {records.length > 0 && (
        <View className='records-section'>
          <Text className='records-title'>最近記錄</Text>
          {records.slice(0, 20).map(record => (
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
      {/* 自定义日期选择器 */}
      <DatePicker
        visible={showDatePicker}
        value={selectedDate}
        onConfirm={(date) => { setSelectedDate(date); setShowDatePicker(false) }}
        onCancel={() => setShowDatePicker(false)}
      />
    </View>
  )
}

export default function Index() {
  // 胶囊按钮信息（右侧预留空间 + 是否存在胶囊）
  const navLayout = useMemo(() => {
    try {
      const windowInfo = getWindowInfo()
      const rect = Taro.getMenuButtonBoundingClientRect()
      if (rect && rect.width > 0) {
        return {
          capsuleRight: windowInfo.windowWidth - rect.left + 12,
          hasCapsule: true,
        }
      }
    } catch { /* ignore */ }
    return { capsuleRight: 0, hasCapsule: false }
  }, [])

  const [config, setConfig] = useState<SalaryConfig>(() => {
    try {
      const saved = Taro.getStorageSync('salary_config')
      return saved ? { ...DEFAULT_CONFIG, ...saved } : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  })
  const [showDetail, setShowDetail] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  // 用 ref 存储实时数据，避免每秒 setState 导致整个组件树重渲染
  const timeInfoRef = useRef({
    timeStr: '00:00:00',
    isWorking: false,
    todayEarnedStr: '0.0000',
    monthEarnedStr: '0.00',
    workProgress: 0,
    paydayDays: 0,
    paydayHours: 0,
    paydayMinutes: 0,
    paydaySeconds: 0,
  })

  // 只在秒变化时更新显示（1秒1次，而非60fps）
  const [tick, setTick] = useState(0)
  const lastSecondRef = useRef(-1)

  // 派生计算
  const dailySalary = useMemo(() => config.monthlySalary / config.workDaysPerMonth, [config])
  const hourlySalary = useMemo(() => dailySalary / config.workHoursPerDay, [dailySalary, config.workHoursPerDay])
  const minuteSalary = useMemo(() => hourlySalary / 60, [hourlySalary])
  const secondSalary = useMemo(() => minuteSalary / 60, [minuteSalary])

  // 每秒更新一次
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const sec = now.getSeconds()
      if (sec !== lastSecondRef.current) {
        lastSecondRef.current = sec
        setTick(t => t + 1)
      }
    }, 200) // 200ms 检查一次，确保不漏秒

    return () => clearInterval(timer)
  }, [])

  // 计算 timeInfo（纯函数，依赖 tick 触发）
  const timeInfo = useMemo(() => {
    const { monthlySalary, workDaysPerMonth, workHoursPerDay, workStartHour, workEndHour, payday } = config
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const second = now.getSeconds()

    const isWorking = hour >= workStartHour && hour < workEndHour

    let todayEarned = 0
    if (hour >= workEndHour) {
      todayEarned = dailySalary
    } else if (hour >= workStartHour) {
      const workedSeconds = (hour - workStartHour) * 3600 + minute * 60 + second
      todayEarned = workedSeconds * secondSalary
    }

    let monthEarned = 0
    if (day > payday) {
      const workedDays = day - payday
      monthEarned = workedDays * dailySalary + todayEarned
    } else if (day === payday) {
      monthEarned = todayEarned
    } else {
      const prevMonthDays = new Date(year, month, 0).getDate()
      const workedDays = prevMonthDays - payday + day
      monthEarned = workedDays * dailySalary + todayEarned
    }

    const workProgress = isWorking
      ? ((hour - workStartHour) * 3600 + minute * 60 + second) / (workHoursPerDay * 3600) * 100
      : hour >= workEndHour ? 100 : 0

    let nextPayday: Date
    if (day >= payday) {
      nextPayday = new Date(year, month + 1, payday, 0, 0, 0)
    } else {
      nextPayday = new Date(year, month, payday, 0, 0, 0)
    }
    const secondsToPayday = Math.max(0, Math.floor((nextPayday.getTime() - now.getTime()) / 1000))

    return {
      timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
      isWorking,
      todayEarnedStr: formatMoney4(todayEarned),
      monthEarnedStr: formatMoney2(monthEarned),
      workProgress,
      paydayDays: Math.floor(secondsToPayday / 86400),
      paydayHours: Math.floor((secondsToPayday % 86400) / 3600),
      paydayMinutes: Math.floor((secondsToPayday % 3600) / 60),
      paydaySeconds: secondsToPayday % 60,
    }
  }, [tick, config, dailySalary, secondSalary])

  // 保存配置
  const saveConfig = useCallback((newConfig: SalaryConfig) => {
    setConfig(newConfig)
    try {
      Taro.setStorageSync('salary_config', newConfig)
    } catch { /* ignore */ }
  }, [])

  // 设置面板输入处理
  const [editForm, setEditForm] = useState<SalaryConfig>(config)

  const openSettings = useCallback(() => {
    setEditForm({ ...config })
    setShowSettings(true)
  }, [config])

  const closeSettings = useCallback(() => {
    setShowSettings(false)
  }, [])

  const applySettings = useCallback(() => {
    // 用 NaN 检查替代 ||，避免 0 被当作 falsy 回退到默认值
    const n = (v: string) => { const x = Number(v); return isNaN(x) ? undefined : x }
    const parsed: SalaryConfig = {
      monthlySalary: n(editForm.monthlySalary) ?? DEFAULT_CONFIG.monthlySalary,
      workDaysPerMonth: Math.max(1, n(editForm.workDaysPerMonth) ?? DEFAULT_CONFIG.workDaysPerMonth),
      workHoursPerDay: Math.max(1, n(editForm.workHoursPerDay) ?? DEFAULT_CONFIG.workHoursPerDay),
      workStartHour: Math.max(0, Math.min(24, n(editForm.workStartHour) ?? DEFAULT_CONFIG.workStartHour)),
      workEndHour: Math.max(0, Math.min(24, n(editForm.workEndHour) ?? DEFAULT_CONFIG.workEndHour)),
      payday: Math.max(1, Math.min(28, n(editForm.payday) ?? DEFAULT_CONFIG.payday)),
    }
    saveConfig(parsed)
    setShowSettings(false)
  }, [editForm, saveConfig])

  const resetSettings = useCallback(() => {
    setEditForm({ ...DEFAULT_CONFIG })
  }, [])

  const startStr = `${String(config.workStartHour).padStart(2, '0')}:00`
  const endStr = `${String(config.workEndHour).padStart(2, '0')}:00`

  // 计算 Swiper 高度（视口 - 导航栏 - 指示器）
  const scrollHeight = useMemo(() => {
    const windowInfo = getWindowInfo()
    const wh = (windowInfo as any).windowHeight ?? 812
    let navH = (windowInfo.statusBarHeight ?? 20)
    try {
      const rect = Taro.getMenuButtonBoundingClientRect()
      if (rect && rect.width > 0) navH = rect.bottom + 4
      else navH += 44
    } catch { navH += 44 }
    const indicatorH = 36
    return wh - navH - indicatorH
  }, [])

  return (
    <View className='salary-app-root'>
      {/* 自定义导航栏（适配胶囊按钮） */}
      <CustomNavBar
        timeStr={timeInfo.timeStr}
        isWorking={timeInfo.isWorking}
        capsuleRight={navLayout.capsuleRight}
        hasCapsule={navLayout.hasCapsule}
      />

      {/* 双页滑动容器 */}
      <Swiper
        className='page-swiper'
        indicatorDots={false}
        current={currentPage}
        onChange={(e) => setCurrentPage(e.detail.current)}
      >
        {/* 第一页：工资时钟 */}
        <SwiperItem>
          <ScrollView scrollY className='page-scroll'>
            <View className='salary-app'>
              {/* 主金额 — 留白呼吸 */}
              <View className='hero-section'>
                <Text className='hero-label'>今 月 已 赚</Text>
                <View className='hero-amount'>
                  <Text className='hero-currency'>¥</Text>
                  <AnimatedNumber className='hero-number' value={timeInfo.monthEarnedStr} />
                </View>
                <View className='hero-progress-bg'>
                  <View
                    className='hero-progress-fill'
                    style={{ width: `${Math.min(100, (parseFloat(timeInfo.monthEarnedStr.replace(/,/g, '')) / config.monthlySalary) * 100)}%` }}
                  />
                </View>
                <Text className='hero-target'>目標 ¥{config.monthlySalary.toLocaleString()}</Text>
              </View>

              {/* 实时收益 — 水墨 */}
              <View className='live-earning'>
                <View className='live-glow' />
                <Text className='live-label'>今 日 收 益</Text>
                <View className='live-amount-wrap'>
                  <Text className='live-currency'>¥</Text>
                  <AnimatedNumber className='live-amount' value={timeInfo.todayEarnedStr} />
                </View>
                <Text className='live-rate'>+¥{secondSalary.toFixed(6)} / 秒</Text>
              </View>

              {/* 薪资明细 — 卷轴 */}
              <View className={`detail-card ${showDetail ? 'expanded' : ''}`} onClick={() => setShowDetail(!showDetail)}>
                <View className='detail-header'>
                  <Text className='detail-title'>薪 賄 明 細</Text>
                  <Text className='detail-arrow'>{showDetail ? '▲' : '▼'}</Text>
                </View>

                {showDetail && (
                  <View className='detail-body'>
                    <View className='detail-row'>
                      <Text className='detail-name'>月薪</Text>
                      <Text className='detail-value'>¥{config.monthlySalary.toLocaleString()}</Text>
                    </View>
                    <View className='detail-row'>
                      <Text className='detail-name'>日薪</Text>
                      <Text className='detail-value highlight'>¥{dailySalary.toFixed(2)}</Text>
                    </View>
                    <View className='detail-row'>
                      <Text className='detail-name'>时薪</Text>
                      <Text className='detail-value highlight'>¥{hourlySalary.toFixed(4)}</Text>
                    </View>
                    <View className='detail-row'>
                      <Text className='detail-name'>分薪</Text>
                      <Text className='detail-value highlight'>¥{minuteSalary.toFixed(6)}</Text>
                    </View>
                    <View className='detail-row'>
                      <Text className='detail-name'>秒薪</Text>
                      <Text className='detail-value gold'>¥{secondSalary.toFixed(8)}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 工作进度 — 枯山水砂纹 */}
              <View className='progress-card'>
                <View className='progress-header'>
                  <Text className='progress-title'>今日進度</Text>
                  <Text className='progress-percent'>{timeInfo.workProgress.toFixed(1)}%</Text>
                </View>
                <View className='progress-bar-bg'>
                  <View
                    className={`progress-bar-fill ${timeInfo.isWorking ? 'active' : ''}`}
                    style={{ width: `${timeInfo.workProgress}%` }}
                  />
                </View>
                <View className='progress-time'>
                  <Text className='progress-start'>{startStr}</Text>
                  <Text className='progress-end'>{endStr}</Text>
                </View>
              </View>

              {/* 发薪日倒计时 */}
              <View className='countdown-card'>
                <Text className='countdown-title'>次 回 給 与 日</Text>
                <View className='countdown-grid'>
                  <View className='countdown-item'>
                    <Text className='countdown-num'>{timeInfo.paydayDays}</Text>
                    <Text className='countdown-unit'>日</Text>
                  </View>
                  <View className='countdown-item'>
                    <Text className='countdown-num'>{timeInfo.paydayHours}</Text>
                    <Text className='countdown-unit'>時</Text>
                  </View>
                  <View className='countdown-item'>
                    <Text className='countdown-num'>{timeInfo.paydayMinutes}</Text>
                    <Text className='countdown-unit'>分</Text>
                  </View>
                  <View className='countdown-item'>
                    <Text className='countdown-num'>{timeInfo.paydaySeconds}</Text>
                    <Text className='countdown-unit'>秒</Text>
                  </View>
                </View>
              </View>

              {/* 底部 */}
              <View className='footer-info'>
                <Text className='footer-text'>每月{config.payday}日給与 · {startStr}-{endStr}</Text>
              </View>

              {/* 底部安全区占位 */}
              <View style={{ height: '60px' }} />
            </View>
          </ScrollView>
        </SwiperItem>

        {/* 第二页：记账 */}
        <SwiperItem>
          <ScrollView scrollY className='page-scroll'>
            <BookkeepingPage />
          </ScrollView>
        </SwiperItem>
      </Swiper>

      {/* 页面指示器 */}
      <View className='page-indicator'>
        <View className={`indicator-dot ${currentPage === 0 ? 'active' : ''}`} />
        <View className={`indicator-dot ${currentPage === 1 ? 'active' : ''}`} />
      </View>

      {/* 浮动设置按钮 */}
      <View className='fab-btn' onClick={openSettings}>
        <Text className='fab-icon'>⚙</Text>
      </View>

      {/* 设置面板遮罩 */}
      {showSettings && (
        <View className='settings-overlay' onClick={closeSettings}>
          <View className='settings-panel' onClick={(e) => e.stopPropagation()}>
            <View className='settings-header'>
              <Text className='settings-title'>設 定</Text>
              <View className='settings-close' onClick={closeSettings}>
                <Text className='settings-close-text'>✕</Text>
              </View>
            </View>

            <View className='settings-body'>
              <View className='settings-section'>
                <Text className='settings-section-title'>薪 賄</Text>
                <SettingRow
                  label='月薪'
                  value={String(editForm.monthlySalary)}
                  onChange={(v) => setEditForm({ ...editForm, monthlySalary: v })}
                  suffix='元'
                />
                <SettingRow
                  label='月工作天数'
                  value={String(editForm.workDaysPerMonth)}
                  onChange={(v) => setEditForm({ ...editForm, workDaysPerMonth: v })}
                  suffix='天'
                />
                <SettingRow
                  label='日工作时长'
                  value={String(editForm.workHoursPerDay)}
                  onChange={(v) => setEditForm({ ...editForm, workHoursPerDay: v })}
                  suffix='时'
                />
              </View>

              <View className='settings-divider' />

              <View className='settings-section'>
                <Text className='settings-section-title'>時 間</Text>
                <SettingRow
                  label='上班时间'
                  value={String(editForm.workStartHour)}
                  onChange={(v) => setEditForm({ ...editForm, workStartHour: v })}
                  suffix='时'
                />
                <SettingRow
                  label='下班时间'
                  value={String(editForm.workEndHour)}
                  onChange={(v) => setEditForm({ ...editForm, workEndHour: v })}
                  suffix='时'
                />
                <SettingRow
                  label='发薪日'
                  value={String(editForm.payday)}
                  onChange={(v) => setEditForm({ ...editForm, payday: v })}
                  suffix='日'
                />
              </View>
            </View>

            <View className='settings-footer'>
              <View className='settings-btn settings-btn-reset' onClick={resetSettings}>
                <Text className='settings-btn-text'>恢 復 默 認</Text>
              </View>
              <View className='settings-btn settings-btn-save' onClick={applySettings}>
                <Text className='settings-btn-text'>保 存</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
