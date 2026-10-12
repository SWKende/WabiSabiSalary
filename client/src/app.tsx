import { PropsWithChildren } from 'react'
import { View } from '@tarojs/components'
import './app.scss'
import { bootstrapStore } from './utils/store'
import { useStoreReady } from './utils/useStoreReady'

/**
 * 入口即开始打开本地库，不等 React 挂载，尽量让就绪时刻早于用户可见的第一帧。
 */
void bootstrapStore()

/**
 * 应用外壳。
 *
 * 注意：**任何情况下都必须渲染 children**。Taro H5 的页面宿主元素是随 children 挂进 DOM 的，
 * 一旦在这里用占位内容顶替 children，运行时取不到页面实例就会抛「没有找到页面实例。」并整树崩溃。
 * 需要等本地库的界面请自行用 useStoreReady 门控页面内容（见 pages/index/index.tsx）。
 */
export default function App({ children }: PropsWithChildren) {
  const ready = useStoreReady()

  return (
    <>
      {children}
      {!ready && <View className='app-boot' />}
    </>
  )
}
