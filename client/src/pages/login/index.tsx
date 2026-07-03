import { View, Text, Input } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { login, register, setToken } from '../../api'
import './index.scss'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    if (username.length < 3 || password.length < 6) {
      setError('用户名至少 3 位，密码至少 6 位')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const fn = mode === 'login' ? login : register
      const res = await fn(username, password)
      setToken(res.token)
      const { initialSync } = await import('../../utils/sync')
      await initialSync()
      Taro.reLaunch({ url: '/pages/index/index' })
    } catch (err: any) {
      setError(err?.message ?? '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
    setUsername('')
    setPassword('')
  }

  return (
    <View className='login-root'>
      <Text className='login-title'>{mode === 'login' ? '欢迎回来' : '创建账号'}</Text>
      <Text className='login-subtitle'>{mode === 'login' ? '登录以同步你的数据' : '注册后可在多设备同步'}</Text>

      <View className='login-form'>
        <Input
          className='login-input'
          placeholder='用户名（3-20 位字母/数字/下划线）'
          value={username}
          onInput={(e) => setUsername(e.detail.value)}
          maxlength={20}
        />
        <Input
          className='login-input'
          placeholder='密码（6-32 位）'
          password
          value={password}
          onInput={(e) => setPassword(e.detail.value)}
          maxlength={32}
        />

        <View
          className={`login-btn ${loading ? 'login-btn--disabled' : ''}`}
          onClick={loading ? undefined : submit}
        >
          <Text>{loading ? '处理中...' : mode === 'login' ? '登 录' : '注 册'}</Text>
        </View>

        {error && <Text className='login-error'>{error}</Text>}

        <View className='login-switch'>
          <Text>{mode === 'login' ? '还没有账号？' : '已有账号？'}</Text>
          <Text className='login-switch__link' onClick={switchMode}>
            {mode === 'login' ? '立即注册' : '立即登录'}
          </Text>
        </View>
      </View>
    </View>
  )
}
