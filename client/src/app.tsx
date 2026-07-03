import { PropsWithChildren } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { getToken } from './api'
import './app.scss'

export default function App({ children }: PropsWithChildren) {
  useDidShow(() => {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const currentPath = current?.route ?? ''

    // 在登录页不需要检查
    if (currentPath.startsWith('pages/login')) return

    const token = getToken()
    if (!token) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  return children
}
