import { View, Text } from '@tarojs/components'
import './index.scss'

interface CustomNavBarProps {
  timeStr: string
  status: 'working' | 'resting' | 'holiday'
}

export default function CustomNavBar({ timeStr, status }: CustomNavBarProps) {
  return (
    <View className='custom-nav-bar'>
      <View className='nav-content'>
        <Text className='status-time'>{timeStr}</Text>
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
