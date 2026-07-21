import { View, Text, Input, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { getWindowInfo } from '../../utils/window'
import { login, register, setToken, ApiError } from '../../api'
import { validateCredentials, type LoginMode } from './validation'
import './index.scss'

interface CopyBundle {
  kicker: string
  title: string
  copy: string
  accountLabel: string
  passwordLabel: string
  primary: string
  loadingLabel: string
  switchPrompt: string
  switchAction: string
  folio: string
  footerMark: string
}

const COPY: Record<LoginMode, CopyBundle> = {
  login: {
    kicker: 'Salary Clock · Personal Ledger',
    title: '入 帐',
    copy: '登录工资时钟，继续记录时间、收入与日常。',
    accountLabel: '账 户',
    passwordLabel: '密 码',
    primary: '登 录',
    loadingLabel: '登录中…',
    switchPrompt: '还没有账号？',
    switchAction: '登记新账户',
    folio: '账户 · 第〇一页',
    footerMark: '专注每一刻的价值',
  },
  register: {
    kicker: 'Salary Clock · New Account',
    title: '登 记',
    copy: '创建一份只属于你的账簿，从今天开始记录。',
    accountLabel: '新账户',
    passwordLabel: '设置密码',
    primary: '注 册',
    loadingLabel: '注册中…',
    switchPrompt: '已经有账号？',
    switchAction: '返回登录',
    folio: '账户 · 新建页',
    footerMark: '让记录从此处开始',
  },
}

const PASSWORD_TOGGLE_SHOW = '显示密码'
const PASSWORD_TOGGLE_HIDE = '隐藏密码'

function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return '用户名或密码错误'
      case 'USERNAME_EXISTS':
        return '该用户名已被占用，请换一个'
      case 'NETWORK_ERROR':
        return '网络连接失败，请稍后重试'
      case 'INVALID_INPUT':
        // 优先展示服务端返回的具体中文校验消息
        return err.message || '操作失败'
      default:
        return err.message || '操作失败'
    }
  }
  return '操作失败'
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
      Taro.reLaunch({ url: '/pages/index/index' })
    } catch (err) {
      setError(describeApiError(err))
    } finally {
      setLoading(false)
    }
  }

  // 顶部起点:仅当胶囊矩形有有效宽度时按微信胶囊底部定位,否则回退状态栏高度。
  // 两条路径都不再叠加 env(safe-area-inset-top)。API 返回的 CSS 像素仅用于设备几何。
  const windowInfo = getWindowInfo()
  const statusBarHeight = windowInfo.statusBarHeight ?? 20
  let capsuleBottom = statusBarHeight + 36
  try {
    const rect = Taro.getMenuButtonBoundingClientRect()
    if (rect && rect.width > 0) {
      capsuleBottom = rect.bottom
    }
  } catch {
    /* ignore: 平台不支持时回退状态栏高度 */
  }
  const topSpacing = capsuleBottom + 24

  return (
    <View className={`login-root login-root--${mode}`} style={{ paddingTop: `${topSpacing}px` }}>
      <View className='login-binding'>
        <View className='login-binding__node login-binding__node--top' />
        <View className='login-binding__node login-binding__node--bottom' />
      </View>

      <View className='login-folio'>
        {copy.folio.split('').map((ch, i) => (
          <Text key={i} className='login-folio__char'>
            {ch === ' ' ? '\u00a0' : ch}
          </Text>
        ))}
      </View>

      <View className='login-shell'>
        <View className='login-hero'>
          <Text className='login-hero__kicker'>{copy.kicker}</Text>
          <Text className='login-hero__title'>{copy.title}</Text>
          <Text className='login-hero__copy'>{copy.copy}</Text>
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
                <Text className='login-error__text'>错误：{error}</Text>
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

      <View className='login-footer-mark'>
        <Text className='login-footer-mark__text'>{copy.footerMark}</Text>
      </View>
    </View>
  )
}
