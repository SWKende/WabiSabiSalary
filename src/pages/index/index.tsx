import { View, Text, ScrollView, Swiper, SwiperItem, Switch } from '@tarojs/components'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Taro from '@tarojs/taro'
import AnimatedNumber from '../../components/AnimatedNumber'
import CustomNavBar from '../../components/CustomNavBar'
import SettingRow from '../../components/SettingRow'
import BookkeepingPage from '../../components/Bookkeeping'
import DatePicker from '../../components/DatePicker'
import NumberKeyboard from '../../components/NumberKeyboard'
import type { BookkeepingSettings } from '../../components/Bookkeeping'
import { DEFAULT_CONFIG, SalaryConfig } from '../../constants/salary'
import { formatMoney2, formatMoney4 } from '../../utils/format'
import {
  classifyCnDate,
  ensureCnHolidayDataset,
  readCnHolidayDatasetSync,
  toYYYYMMDD,
  type CnDayType,
} from '../../utils/cnHoliday'
import { getWindowInfo } from '../../utils/window'
import holidayGameSvg from './assets/holiday-game.svg'
import holidayRunSvg from './assets/holiday-run.svg'
import holidaySunSvg from './assets/holiday-sun.svg'
import './index.scss'

const DEFAULT_BK_SETTINGS: BookkeepingSettings = {
  showWeeklyBar: true,
  showMonthlyBar: true,
  showMonthlyPie: true,
}

const HOME_PAGE_STORAGE_KEY = 'home_page_preference'

type HomePage = 0 | 1

const resolveHomePagePreference = (value: unknown): HomePage | null => {
  if (value === 0 || value === 'salary') return 0
  if (value === 1 || value === 'bookkeeping') return 1
  return null
}

const getInitialHomePageState = () => {
  try {
    const saved = Taro.getStorageSync(HOME_PAGE_STORAGE_KEY)
    const preferredPage = resolveHomePagePreference(saved)
    if (preferredPage !== null) {
      return {
        currentPage: preferredPage,
        showLaunchScreen: false,
      }
    }
  } catch {
    /* ignore */
  }

  return {
    currentPage: 0 as HomePage,
    showLaunchScreen: true,
  }
}

const HOLIDAY_CARD_VARIANTS = [
  {
    key: 'sun',
    kicker: '休 日 中',
    title: '今日不计收益',
    desc: '风轻日暖，适合发呆、散步，和慢慢晒太阳。',
    illustration: holidaySunSvg,
  },
  {
    key: 'game',
    kicker: '休 日 中',
    title: '今天适合通关',
    desc: '把提醒静音一会儿，沙发、掌机和下午的光刚刚好。',
    illustration: holidayGameSvg,
  },
  {
    key: 'run',
    kicker: '休 日 中',
    title: '今天适合跑步',
    desc: '不用赶进度，沿着树影慢跑一会儿，呼吸会先轻下来。',
    illustration: holidayRunSvg,
  },
] as const

const pickRandomHolidayCardIndex = () => Math.floor(Math.random() * HOLIDAY_CARD_VARIANTS.length)

export default function Index() {
  const initialHomePageState = getInitialHomePageState()

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
    } catch {
      /* ignore */
    }
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
  const [currentPage, setCurrentPage] = useState<HomePage>(initialHomePageState.currentPage)
  const [showLaunchScreen, setShowLaunchScreen] = useState(initialHomePageState.showLaunchScreen)
  const [showBkSettings, setShowBkSettings] = useState(false)
  const [bkSettings, setBkSettings] = useState<BookkeepingSettings>(() => {
    try {
      const saved = Taro.getStorageSync('bookkeeping_settings')
      return saved ? { ...DEFAULT_BK_SETTINGS, ...saved } : DEFAULT_BK_SETTINGS
    } catch {
      return DEFAULT_BK_SETTINGS
    }
  })

  const datePickerConfirmRef = useRef<((date: string) => void) | null>(null)
  const amountKeyboardChangeRef = useRef<((value: string) => void) | null>(null)
  const [datePickerVisible, setDatePickerVisible] = useState(false)
  const [datePickerValue, setDatePickerValue] = useState(() => new Date().toISOString().split('T')[0])
  const [numberKeyboardVisible, setNumberKeyboardVisible] = useState(false)
  const [numberKeyboardValue, setNumberKeyboardValue] = useState('')
  const [holidayCardIndex, setHolidayCardIndex] = useState(() => pickRandomHolidayCardIndex())

  const syncHomePagePreference = useCallback(() => {
    try {
      const saved = Taro.getStorageSync(HOME_PAGE_STORAGE_KEY)
      const preferredPage = resolveHomePagePreference(saved)
      if (preferredPage === null) {
        setShowLaunchScreen(true)
      } else {
        setCurrentPage(preferredPage)
        setShowLaunchScreen(false)
      }
    } catch {
      setShowLaunchScreen(true)
    }
  }, [])

  const handleSelectHomePage = useCallback((page: HomePage) => {
    setCurrentPage(page)
    setShowLaunchScreen(false)
    try {
      Taro.setStorageSync(HOME_PAGE_STORAGE_KEY, page === 0 ? 'salary' : 'bookkeeping')
    } catch {
      /* ignore */
    }
  }, [])

  const openDatePicker = useCallback((value: string, onConfirm: (date: string) => void) => {
    datePickerConfirmRef.current = onConfirm
    setDatePickerValue(value)
    setDatePickerVisible(true)
  }, [])

  const closeDatePicker = useCallback(() => {
    setDatePickerVisible(false)
  }, [])

  const confirmDatePicker = useCallback((date: string) => {
    const fn = datePickerConfirmRef.current
    if (fn) fn(date)
    setDatePickerVisible(false)
  }, [])

  const openAmountKeyboard = useCallback((value: string, onChange: (value: string) => void) => {
    amountKeyboardChangeRef.current = onChange
    setNumberKeyboardValue(value)
    setNumberKeyboardVisible(true)
  }, [])

  const closeAmountKeyboard = useCallback(() => {
    setNumberKeyboardVisible(false)
  }, [])

  const changeAmountKeyboardValue = useCallback((value: string) => {
    setNumberKeyboardValue(value)
    const fn = amountKeyboardChangeRef.current
    if (fn) fn(value)
  }, [])

  const confirmAmountKeyboard = useCallback((value: string) => {
    changeAmountKeyboardValue(value)
    setNumberKeyboardVisible(false)
  }, [changeAmountKeyboardValue])

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

  const [cnDayType, setCnDayType] = useState<CnDayType>(() => {
    const today = toYYYYMMDD(new Date())
    return classifyCnDate(today, readCnHolidayDatasetSync())
  })

  const currentDateStr = useMemo(() => toYYYYMMDD(new Date()), [tick])

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
        setTick((t) => t + 1)
      }
    }, 200) // 200ms 检查一次，确保不漏秒

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2]

    setCnDayType(classifyCnDate(currentDateStr, readCnHolidayDatasetSync()))

    ;(async () => {
      const dataset = await ensureCnHolidayDataset({ years })
      if (cancelled) return
      setCnDayType(classifyCnDate(currentDateStr, dataset))
    })()

    return () => {
      cancelled = true
    }
  }, [currentDateStr])

  const isHolidayMode = cnDayType === 'holiday'
  const prevHolidayModeRef = useRef(isHolidayMode)

  useEffect(() => {
    if (isHolidayMode && !prevHolidayModeRef.current) {
      setHolidayCardIndex(pickRandomHolidayCardIndex())
    }
    prevHolidayModeRef.current = isHolidayMode
  }, [isHolidayMode])

  const holidayCard = HOLIDAY_CARD_VARIANTS[holidayCardIndex]

  useEffect(() => {
    syncHomePagePreference()
  }, [syncHomePagePreference])

  Taro.useDidShow(() => {
    syncHomePagePreference()
  })

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

    const isHoliday = isHolidayMode
    const isWorking = !isHoliday && hour >= workStartHour && hour < workEndHour

    let todayEarned = 0
    if (!isHoliday) {
      if (hour >= workEndHour) {
        todayEarned = dailySalary
      } else if (hour >= workStartHour) {
        const workedSeconds = (hour - workStartHour) * 3600 + minute * 60 + second
        todayEarned = workedSeconds * secondSalary
      }
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

    const workProgress = isHoliday
      ? 0
      : isWorking
        ? (((hour - workStartHour) * 3600 + minute * 60 + second) / (workHoursPerDay * 3600)) * 100
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
      isHoliday,
      paydayDays: Math.floor(secondsToPayday / 86400),
      paydayHours: Math.floor((secondsToPayday % 86400) / 3600),
      paydayMinutes: Math.floor((secondsToPayday % 3600) / 60),
      paydaySeconds: secondsToPayday % 60,
    }
  }, [tick, config, dailySalary, secondSalary, isHolidayMode])

  // 保存配置
  const saveConfig = useCallback((newConfig: SalaryConfig) => {
    setConfig(newConfig)
    try {
      Taro.setStorageSync('salary_config', newConfig)
    } catch {
      /* ignore */
    }
  }, [])

  // 设置面板输入处理 — 编辑态用字符串类型，与 SettingRow 的 onChange 对齐
  type EditForm = { [K in keyof SalaryConfig]: string }
  const [editForm, setEditForm] = useState<EditForm>(() => ({
    monthlySalary: String(config.monthlySalary),
    workDaysPerMonth: String(config.workDaysPerMonth),
    workHoursPerDay: String(config.workHoursPerDay),
    workStartHour: String(config.workStartHour),
    workEndHour: String(config.workEndHour),
    payday: String(config.payday),
  }))

  const openSettings = useCallback(() => {
    setEditForm({
      monthlySalary: String(config.monthlySalary),
      workDaysPerMonth: String(config.workDaysPerMonth),
      workHoursPerDay: String(config.workHoursPerDay),
      workStartHour: String(config.workStartHour),
      workEndHour: String(config.workEndHour),
      payday: String(config.payday),
    })
    setShowSettings(true)
  }, [config])

  const closeSettings = useCallback(() => {
    setShowSettings(false)
  }, [])

  const openBkSettings = useCallback(() => {
    setShowBkSettings(true)
  }, [])

  const closeBkSettings = useCallback(() => {
    setShowBkSettings(false)
  }, [])

  const toggleBkSetting = useCallback((key: keyof BookkeepingSettings) => {
    setBkSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        Taro.setStorageSync('bookkeeping_settings', next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const applySettings = useCallback(() => {
    // 用 NaN 检查替代 ||，避免 0 被当作 falsy 回退到默认值
    const n = (v: string) => {
      const x = Number(v)
      return isNaN(x) ? undefined : x
    }
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
    setEditForm({
      monthlySalary: String(DEFAULT_CONFIG.monthlySalary),
      workDaysPerMonth: String(DEFAULT_CONFIG.workDaysPerMonth),
      workHoursPerDay: String(DEFAULT_CONFIG.workHoursPerDay),
      workStartHour: String(DEFAULT_CONFIG.workStartHour),
      workEndHour: String(DEFAULT_CONFIG.workEndHour),
      payday: String(DEFAULT_CONFIG.payday),
    })
  }, [])

  const startStr = `${String(config.workStartHour).padStart(2, '0')}:00`
  const endStr = `${String(config.workEndHour).padStart(2, '0')}:00`

  // 计算 Swiper 高度（视口 - 导航栏 - 指示器）
  const scrollHeight = useMemo(() => {
    const windowInfo = getWindowInfo()
    const wh = (windowInfo as any).windowHeight ?? 812
    let navH = windowInfo.statusBarHeight ?? 20
    try {
      const rect = Taro.getMenuButtonBoundingClientRect()
      if (rect && rect.width > 0) navH = rect.bottom + 4
      else navH += 44
    } catch {
      navH += 44
    }
    const indicatorH = 36
    return wh - navH - indicatorH
  }, [])

  if (showLaunchScreen) {
    return (
      <View className='salary-app-root launch-screen-root'>
        <View className='launch-screen'>
          <View className='launch-screen__halo launch-screen__halo--top' />
          <View className='launch-screen__halo launch-screen__halo--bottom' />
          <View className='launch-screen__content'>
            <Text className='launch-screen__eyebrow'>Trae Salary</Text>
            <Text className='launch-screen__title'>选择你想先进入的首页</Text>
            <Text className='launch-screen__desc'>
              首次进入先做一次选择，之后会自动进入你设定的首页。
            </Text>

            <View
              className='launch-screen__option'
              onClick={() => handleSelectHomePage(0)}
            >
              <View className='launch-screen__optionHeader'>
                <Text className='launch-screen__optionTitle'>每秒工资</Text>
                <Text className='launch-screen__optionBadge'>默认推荐</Text>
              </View>
              <Text className='launch-screen__optionText'>
                进入实时工资页，先看今天已经赚了多少、距离发薪日还有多久。
              </Text>
            </View>

            <View
              className='launch-screen__option launch-screen__option--secondary'
              onClick={() => handleSelectHomePage(1)}
            >
              <View className='launch-screen__optionHeader'>
                <Text className='launch-screen__optionTitle'>记账页</Text>
                <Text className='launch-screen__optionBadge'>持久记忆</Text>
              </View>
              <Text className='launch-screen__optionText'>
                进入记账首页，后续再次打开小程序也会优先从记账页开始。
              </Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='salary-app-root'>
      {/* 自定义导航栏（适配胶囊按钮） */}
      <CustomNavBar
        timeStr={timeInfo.timeStr}
        status={timeInfo.isHoliday ? 'holiday' : timeInfo.isWorking ? 'working' : 'resting'}
        capsuleRight={navLayout.capsuleRight}
        hasCapsule={navLayout.hasCapsule}
      />

      {/* 双页滑动容器 */}
      <Swiper
        className='page-swiper'
        indicatorDots={false}
        current={currentPage}
        onChange={(e) => setCurrentPage((e.detail.current === 1 ? 1 : 0) as HomePage)}
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
                    style={{
                      width: `${Math.min(
                        100,
                        (parseFloat(timeInfo.monthEarnedStr.replace(/,/g, '')) / config.monthlySalary) * 100
                      )}%`,
                    }}
                  />
                </View>
                <Text className='hero-target'>目標 ¥{config.monthlySalary.toLocaleString()}</Text>
              </View>

              {/* 实时收益 / 放假态 */}
              {timeInfo.isHoliday ? (
                <View className='holiday-sun-card'>
                  <View
                    className='holiday-card-illustration'
                    style={{ backgroundImage: `url(${holidayCard.illustration})` }}
                  />
                  <View className='holiday-card-content'>
                    <Text className='holiday-card-kicker'>{holidayCard.kicker}</Text>
                    <Text className='holiday-card-title'>{holidayCard.title}</Text>
                    <Text className='holiday-card-desc'>{holidayCard.desc}</Text>
                  </View>
                </View>
              ) : (
                <View className='live-earning'>
                  <View className='live-glow' />
                  <Text className='live-label'>今 日 收 益</Text>
                  <View className='live-amount-wrap'>
                    <Text className='live-currency'>¥</Text>
                    <AnimatedNumber className='live-amount' value={timeInfo.todayEarnedStr} />
                  </View>
                  <Text className='live-rate'>+¥{secondSalary.toFixed(6)} / 秒</Text>
                </View>
              )}

              {/* 薪资明细 — 卷轴 */}
              <View
                className={`detail-card ${showDetail ? 'expanded' : ''}`}
                onClick={() => setShowDetail(!showDetail)}
              >
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
                <Text className='footer-text'>
                  每月{config.payday}日給与 · {startStr}-{endStr}
                </Text>
              </View>

              {/* 底部安全区占位 */}
              <View style={{ height: '60px' }} />
            </View>
          </ScrollView>
        </SwiperItem>

        {/* 第二页：记账 */}
        <SwiperItem>
          <ScrollView scrollY className='page-scroll'>
            <BookkeepingPage
              bkSettings={bkSettings}
              openDatePicker={openDatePicker}
              openAmountKeyboard={openAmountKeyboard}
            />
          </ScrollView>
        </SwiperItem>
      </Swiper>

      {/* 页面指示器 */}
      <View className='page-indicator'>
        <View className={`indicator-dot ${currentPage === 0 ? 'active' : ''}`} />
        <View className={`indicator-dot ${currentPage === 1 ? 'active' : ''}`} />
      </View>

      {/* 浮动设置按钮 */}
      <View
        className='fab-btn'
        onClick={() => (currentPage === 0 ? openSettings() : openBkSettings())}
      >
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
                  value={editForm.monthlySalary}
                  onChange={(v) => setEditForm({ ...editForm, monthlySalary: v })}
                  suffix='元'
                />
                <SettingRow
                  label='月工作天数'
                  value={editForm.workDaysPerMonth}
                  onChange={(v) => setEditForm({ ...editForm, workDaysPerMonth: v })}
                  suffix='天'
                />
                <SettingRow
                  label='日工作时长'
                  value={editForm.workHoursPerDay}
                  onChange={(v) => setEditForm({ ...editForm, workHoursPerDay: v })}
                  suffix='时'
                />
              </View>

              <View className='settings-divider' />

              <View className='settings-section'>
                <Text className='settings-section-title'>時 間</Text>
                <SettingRow
                  label='上班时间'
                  value={editForm.workStartHour}
                  onChange={(v) => setEditForm({ ...editForm, workStartHour: v })}
                  suffix='时'
                />
                <SettingRow
                  label='下班时间'
                  value={editForm.workEndHour}
                  onChange={(v) => setEditForm({ ...editForm, workEndHour: v })}
                  suffix='时'
                />
                <SettingRow
                  label='发薪日'
                  value={editForm.payday}
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

      {/* 记账设置面板 */}
      {showBkSettings && (
        <View className='settings-overlay' onClick={closeBkSettings}>
          <View className='settings-panel' onClick={(e) => e.stopPropagation()}>
            <View className='settings-header'>
              <Text className='settings-title'>記帳設定</Text>
              <View className='settings-close' onClick={closeBkSettings}>
                <Text className='settings-close-text'>✕</Text>
              </View>
            </View>

            <View className='settings-body'>
              <View className='settings-section'>
                <Text className='settings-section-title'>圖表顯示</Text>

                {/* 近7日柱状图 */}
                <View className='bk-setting-row'>
                  <View className='mini-bar-chart'>
                    {[40, 70, 50, 90, 60].map((h, i) => (
                      <View key={i} className='mini-bar' style={{ height: `${h}%` }} />
                    ))}
                  </View>
                  <Text className='bk-setting-label'>近7日柱狀圖</Text>
                  <Switch
                    checked={bkSettings.showWeeklyBar}
                    onChange={() => toggleBkSetting('showWeeklyBar')}
                    color='#c8b99a'
                  />
                </View>

                {/* 月度柱状图 */}
                <View className='bk-setting-row'>
                  <View className='mini-bar-chart mini-bar-monthly'>
                    {[30, 60, 45, 80, 55, 70, 40].map((h, i) => (
                      <View key={i} className='mini-bar' style={{ height: `${h}%` }} />
                    ))}
                  </View>
                  <Text className='bk-setting-label'>月度柱狀圖</Text>
                  <Switch
                    checked={bkSettings.showMonthlyBar}
                    onChange={() => toggleBkSetting('showMonthlyBar')}
                    color='#c8b99a'
                  />
                </View>

                {/* 月度饼状图 */}
                <View className='bk-setting-row'>
                  <View className='mini-pie-chart' />
                  <Text className='bk-setting-label'>月度餅狀圖</Text>
                  <Switch
                    checked={bkSettings.showMonthlyPie}
                    onChange={() => toggleBkSetting('showMonthlyPie')}
                    color='#c8b99a'
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      <DatePicker
        visible={datePickerVisible}
        value={datePickerValue}
        onConfirm={confirmDatePicker}
        onCancel={closeDatePicker}
      />

      <NumberKeyboard
        visible={numberKeyboardVisible}
        value={numberKeyboardValue}
        onChange={changeAmountKeyboardValue}
        onConfirm={confirmAmountKeyboard}
        onCancel={closeAmountKeyboard}
      />
    </View>
  )
}
