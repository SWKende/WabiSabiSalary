import { View, Text, Input, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { getWindowInfo } from '../../utils/window'
import { login, register, setToken, ApiError } from '../../api'
import { validateCredentials, type LoginMode } from './validation'
import './index.scss'

interface CopyBundle {
  label: string
  title: string
  copy: string
  accountLabel: string
  passwordLabel: string
  primary: string
  loadingLabel: string
  switchPrompt: string
  switchAction: string
}

const COPY: Record<LoginMode, CopyBundle> = {
  login: {
    label: '時 間 の 流 れ',
    title: '登 入',
    copy: '登录后可同步到其他设备。没有服务时，也可以先进入时钟。',
    accountLabel: '账 户',
    passwordLabel: '密 码',
    primary: '登 入',
    loadingLabel: '登录中…',
    switchPrompt: '还没有账号？',
    switchAction: '登 記',
  },
  register: {
    label: '時 間 の 流 れ',
    title: '登 記',
    copy: '创建一个账号，用来同步工资与记账。也可以先进入时钟。',
    accountLabel: '新 账 户',
    passwordLabel: '密 码',
    primary: '登 記',
    loadingLabel: '登记中…',
    switchPrompt: '已有账号？',
    switchAction: '返 回',
  },
}

const PASSWORD_TOGGLE_SHOW = '显 示'
const PASSWORD_TOGGLE_HIDE = '隐 藏'

function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return '用户名或密码错误'
      case 'USERNAME_EXISTS':
        return '该用户名已被占用，请换一个'
      case 'NETWORK_ERROR':
        return '本地服务未启动，或暂时连不上。可先进入时钟离线使用。'
      case 'INVALID_INPUT':
        return err.message || '操作失败'
      default:
        return err.message || '操作失败'
    }
  }
  return '操作失败'
}

const enterClock = () => {
  Taro.reLaunch({ url: '/pages/index/index' })
}

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copy = COPY[mode]

  const switchMode = () => {
    if (loading) return
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
    setUsername('')
    setPassword('')
    setPasswordVisible(false)
    setFocusedField(null)
  }

  const togglePasswordVisible = () => {
    if (loading) return
    setPasswordVisible((v) => !v)
  }

  const submit = async () => {
    if (loading) return
    const result = validateCredentials(mode, username, password)
    if (result.error) {
      setError(result.error)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const fn = mode === 'login' ? login : register
      const res = await fn(result.normalizedUsername, password)
      if (typeof res.token !== 'string' || res.token.length === 0) {
        setError('登录失败，请重试')
        return
      }
      setToken(res.token)
      const { initialSync } = await import('../../utils/sync')
      await initialSync()
      enterClock()
    } catch (err) {
      setError(describeApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const windowInfo = getWindowInfo()
  const statusBarHeight = windowInfo.statusBarHeight ?? 0
  let capsuleBottom = statusBarHeight
  let hasCapsule = false
  try {
    const rect = Taro.getMenuButtonBoundingClientRect()
    if (rect && rect.width > 0) {
      capsuleBottom = rect.bottom
      hasCapsule = true
    }
  } catch {
    /* ignore: 平台不支持时回退状态栏高度 */
  }
  if (!hasCapsule) {
    capsuleBottom = statusBarHeight
  }
  const isShortScreen = (windowInfo.windowHeight ?? 0) > 0 && windowInfo.windowHeight < 720
  const topSpacing = capsuleBottom + (hasCapsule ? (isShortScreen ? 12 : 24) : 8)

  return (
    <View className='login-root' style={{ paddingTop: `${topSpacing}px` }}>
      <View className='login-shell'>
        <View className='login-hero'>
          <Text className='login-hero__label'>{copy.label}</Text>
          <Text className='login-hero__title'>{copy.title}</Text>
          <View className='login-hero__rule' />
          <Text className='login-hero__copy'>{copy.copy}</Text>
          <View
            className='login-hero__skip'
            onClick={() => {
              if (!loading) enterClock()
            }}
          >
            <Text className='login-hero__skip-text'>先 进 入 时 钟</Text>
          </View>
        </View>

        <View className='login-form'>
          <View className={`login-field ${focusedField === 'username' ? 'login-field--focused' : ''}`}>
            <Text className='login-field__label'>{copy.accountLabel}</Text>
            <Input
              className='login-input login-input--text'
              placeholder='3-20 位字母 / 数字 / 下划线'
              placeholderClass='login-input__placeholder'
              value={username}
              onInput={(e) => {
                setUsername(e.detail.value)
                if (error) setError(null)
              }}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField((cur) => (cur === 'username' ? null : cur))}
              maxlength={20}
              disabled={loading}
              confirmType='done'
              onConfirm={submit}
            />
          </View>

          <View className={`login-field ${focusedField === 'password' ? 'login-field--focused' : ''}`}>
            <Text className='login-field__label'>{copy.passwordLabel}</Text>
            <View className='login-field__row'>
              <Input
                className='login-input login-input--password'
                placeholder='6-32 位'
                placeholderClass='login-input__placeholder'
                password={!passwordVisible}
                value={password}
                onInput={(e) => {
                  setPassword(e.detail.value)
                  if (error) setError(null)
                }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField((cur) => (cur === 'password' ? null : cur))}
                maxlength={32}
                disabled={loading}
                confirmType='done'
                onConfirm={submit}
              />
              <Button
                className='login-field__toggle'
                hoverClass='none'
                onClick={togglePasswordVisible}
                disabled={loading}
              >
                {passwordVisible ? PASSWORD_TOGGLE_HIDE : PASSWORD_TOGGLE_SHOW}
              </Button>
            </View>
          </View>

          <View className='login-error-slot'>
            {error && (
              <Text className='login-error'>
                <Text className='login-error__dot'>●</Text>
                <Text className='login-error__text'>{error}</Text>
              </Text>
            )}
          </View>

          <Button
            className='login-btn'
            hoverClass='login-btn--hover'
            loading={loading}
            disabled={loading}
            onClick={submit}
          >
            {loading ? copy.loadingLabel : copy.primary}
          </Button>

          <View className='login-switch'>
            <Text className='login-switch__text'>{copy.switchPrompt}</Text>
            <Text className='login-switch__action' onClick={switchMode}>
              {copy.switchAction}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
