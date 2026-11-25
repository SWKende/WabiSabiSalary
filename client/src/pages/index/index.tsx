import { View, Text, ScrollView, Switch } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useRef, useCallback } from 'react'
import BookkeepingPage, { type BookkeepingSettings } from '../../components/Bookkeeping'
import DatePicker from '../../components/DatePicker'
import NumberKeyboard from '../../components/NumberKeyboard'
import { readJSON, writeJSON, storageDiagnostics, listRecords, flushStore } from '../../utils/store'
import {
  dumpSnapshot,
  parseBackup,
  applySnapshot,
  markBackupDone,
  backupNotice,
  type BackupFile,
} from '../../utils/backup'
import { exportBackupFile, pickBackupFile } from '../../utils/backupIO'
import { useStoreReady } from '../../utils/useStoreReady'
import './index.scss'

const DEFAULT_BK_SETTINGS: BookkeepingSettings = {
  showWeeklyBar: true,
  showMonthlyBar: true,
  showMonthlyPie: true,
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function HomeScreen() {
  const [showBkSettings, setShowBkSettings] = useState(false)
  const [bkSettingsClosing, setBkSettingsClosing] = useState(false)
  const [bkSettings, setBkSettings] = useState<BookkeepingSettings>(() => ({
    ...DEFAULT_BK_SETTINGS,
    ...readJSON<Partial<BookkeepingSettings>>('bookkeeping_settings', {}),
  }))

  const datePickerConfirmRef = useRef<((date: string) => void) | null>(null)
  const amountKeyboardChangeRef = useRef<((value: string) => void) | null>(null)
  const [datePickerVisible, setDatePickerVisible] = useState(false)
  const [datePickerValue, setDatePickerValue] = useState(() => new Date().toISOString().split('T')[0])
  const [numberKeyboardVisible, setNumberKeyboardVisible] = useState(false)
  const [numberKeyboardValue, setNumberKeyboardValue] = useState('')
  const bkSettingsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (bkSettingsCloseTimerRef.current) clearTimeout(bkSettingsCloseTimerRef.current)
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

  // 每次按键即时写回金额，不再有「确认」这一步
  const changeAmountKeyboardValue = useCallback((value: string) => {
    setNumberKeyboardValue(value)
    const fn = amountKeyboardChangeRef.current
    if (fn) fn(value)
  }, [])

  const openBkSettings = useCallback(() => {
    if (bkSettingsCloseTimerRef.current) clearTimeout(bkSettingsCloseTimerRef.current)
    setBkSettingsClosing(false)
    setShowBkSettings(true)
  }, [])

  const closeBkSettings = useCallback(() => {
    const PANEL_CLOSE_MS = 280
    if (bkSettingsCloseTimerRef.current) clearTimeout(bkSettingsCloseTimerRef.current)
    setBkSettingsClosing(true)
    bkSettingsCloseTimerRef.current = setTimeout(() => {
      setShowBkSettings(false)
      setBkSettingsClosing(false)
    }, PANEL_CLOSE_MS)
  }, [])

  const toggleBkSetting = useCallback((key: keyof BookkeepingSettings) => {
    setBkSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      writeJSON('bookkeeping_settings', next)
      return next
    })
  }, [])

  const diagnostics = storageDiagnostics()
  const notice = backupNotice({ degraded: diagnostics.degraded })

  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null)
  const noticeText = backupMsg || notice

  const handleExport = useCallback(async () => {
    setPendingBackup(null)
    try {
      const snapshot = dumpSnapshot()
      const where = await exportBackupFile(snapshot)
      markBackupDone()
      setBackupMsg(where === 'shared' ? '已导出（系统分享面板）' : '已导出为文件')
    } catch (err) {
      setBackupMsg(`导出失败：${describeError(err)}`)
    }
  }, [])

  const handlePickBackup = useCallback(async () => {
    setBackupMsg(null)
    setPendingBackup(null)
    const raw = await pickBackupFile()
    if (raw === null) return
    try {
      // 校验通过才进确认态：坏文件在这一步就被挡下，本机数据一个字节没动
      setPendingBackup(parseBackup(raw))
    } catch (err) {
      setBackupMsg(`导入失败：${describeError(err)}`)
    }
  }, [])

  const handleConfirmImport = useCallback(async () => {
    if (!pendingBackup) return
    await applySnapshot(pendingBackup)
    markBackupDone()
    // reload 会丢掉还没落盘的写入，所以必须等写队列 flush 完再重启
    await flushStore()
    setPendingBackup(null)
    // 整库换掉了。与其逐个通知读缓存的组件，不如重启一次让所有数据从库里重读
    window.location.reload()
  }, [pendingBackup])

  return (
    <View className='bookkeeping-app-root'>
      <ScrollView scrollY className='page-scroll'>
        <BookkeepingPage
          bkSettings={bkSettings}
          openDatePicker={openDatePicker}
          openAmountKeyboard={openAmountKeyboard}
        />
      </ScrollView>

      <View className='fab-btn' onClick={openBkSettings} aria-label='记账设置'>
        <Text className='fab-icon'>⚙</Text>
      </View>

      {showBkSettings && (
        <View
          className={`settings-overlay ${bkSettingsClosing ? 'closing' : ''}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeBkSettings()
          }}
        >
          <View className={`settings-panel ${bkSettingsClosing ? 'closing' : ''}`}>
            <View className='settings-header'>
              <Text className='settings-title'>記帳設定</Text>
              <View className='settings-close' onClick={closeBkSettings}>
                <Text className='settings-close-text'>✕</Text>
              </View>
            </View>

            <View className='settings-body'>
              <button
                type='button'
                className='settings-statistics-entry'
                onClick={() => {
                  setShowBkSettings(false)
                  void Taro.navigateTo({ url: '/pages/expense-statistics/index' })
                }}
              >
                支出統計 <span aria-hidden='true'>›</span>
              </button>

              <View className='settings-section'>
                <Text className='settings-section-title'>圖表顯示</Text>

                {/* 近7日柱状图 */}
                <View className='bk-setting-row'>
                  <View className='mini-chart-card'>
                    <View className='mini-bar-chart'>
                      {[40, 70, 50, 90, 60].map((h, i) => (
                        <View key={i} className='mini-bar' style={{ height: `${h}%` }} />
                      ))}
                    </View>
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
                  <View className='mini-chart-card'>
                    <View className='mini-bar-chart mini-bar-monthly'>
                      {[30, 60, 45, 80, 55, 70, 40].map((h, i) => (
                        <View key={i} className='mini-bar' style={{ height: `${h}%` }} />
                      ))}
                    </View>
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
                  <View className='mini-chart-card'>
                    <View className='mini-pie-chart'>
                      <View className='mini-pie-circle' />
                    </View>
                  </View>
                  <Text className='bk-setting-label'>月度餅狀圖</Text>
                  <Switch
                    checked={bkSettings.showMonthlyPie}
                    onChange={() => toggleBkSetting('showMonthlyPie')}
                    color='#c8b99a'
                  />
                </View>
              </View>

              <View className='settings-divider' />

              <View className='settings-section'>
                <Text className='settings-section-title'>数据备份</Text>
                <View className='settings-backup'>
                  <Text className='settings-backup-btn' onClick={handleExport}>导出备份</Text>
                  <Text className='settings-backup-btn' onClick={handlePickBackup}>导入备份</Text>
                </View>

                {pendingBackup ? (
                  <View>
                    <Text className='settings-notice'>
                      将用备份中的 {pendingBackup.records.length} 条账目覆盖当前的 {listRecords().length} 条账目及记账设置。
                    </Text>
                    <View className='settings-backup-actions'>
                      <Text className='settings-backup-btn' onClick={() => setPendingBackup(null)}>取消</Text>
                      <Text className='settings-backup-btn settings-backup-btn-danger' onClick={handleConfirmImport}>
                        覆盖导入
                      </Text>
                    </View>
                  </View>
                ) : (
                  noticeText && <Text className='settings-notice'>{noticeText}</Text>
                )}
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
        onCancel={closeAmountKeyboard}
      />
    </View>
  )
}

/**
 * 页面壳：等本地库进内存之后再挂载真实界面。
 *
 * 门控只能放在这一层。App 的 children 就是 Taro 的页面宿主元素，把它顶替掉运行时会抛
 * 「没有找到页面实例。」并整树崩掉（真机白屏就是这么来的）；而这里返回占位 View 只影响
 * 页面内容，宿主元素始终在 DOM 里。
 */
export default function Index() {
  const storeReady = useStoreReady()
  if (!storeReady) return <View />
  return <HomeScreen />
}
