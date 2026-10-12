import { PropsWithChildren, useEffect, useState } from 'react'
import { View } from '@tarojs/components'
import './app.scss'
import { bootstrapStore, isStoreReady } from './utils/store'

/**
 * 应用入口：先把本地库（真机 SQLite / 开发环境 storage）载入内存，再渲染页面。
 *
 * 页面里读工资配置、记账记录都是同步读内存缓存，因此必须等 bootstrap 完成，
 * 否则首帧会拿到默认值并可能立刻覆盖掉真实数据。3 秒超时兜底避免白屏卡死。
 */
export default function App({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(isStoreReady())

  useEffect(() => {
    if (ready) return
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      setReady(true)
    }
    const timer = setTimeout(finish, 3000)
    bootstrapStore()
      .then(finish)
      .catch(finish)
      .finally(() => clearTimeout(timer))
    return () => clearTimeout(timer)
  }, [ready])

  if (!ready) return <View className='app-boot' />

  return children
}
