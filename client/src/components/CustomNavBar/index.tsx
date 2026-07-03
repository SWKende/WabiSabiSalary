import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getWindowInfo } from '../../utils/window'
import './index.scss'

interface CustomNavBarProps {
  timeStr: string
  status: 'working' | 'resting' | 'holiday'
  capsuleRight: number
  hasCapsule: boolean
}

// 自定义导航栏 — 适配微信小程序胶囊按钮
export default function CustomNavBar({
  timeStr,
  status,
  capsuleRight,
  hasCapsule,
}: CustomNavBarProps) {
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
  } catch {
    /* ignore */
  }

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
        <View className={`status-badge ${status}`}>
          <View className='status-dot' />
          {status === 'holiday' && <Text className='status-icon'>🏖</Text>}
          <Text className='status-text'>
            {status === 'working' ? '稼働中' : status === 'holiday' ? '放假中' : '休憩中'}
          </Text>
        </View>
      </View>
    </View>
  )
}
