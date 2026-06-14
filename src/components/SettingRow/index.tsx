import { View, Text, Input } from '@tarojs/components'
import './index.scss'

interface SettingRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
}

// 设置面板项
export default function SettingRow({ label, value, onChange, suffix }: SettingRowProps) {
  return (
    <View className='setting-row'>
      <Text className='setting-label'>{label}</Text>
      <View className='setting-input-wrap'>
        <Input
          className='setting-input'
          type='number'
          value={value}
          onInput={(e) => onChange(e.detail.value)}
        />
        {suffix && <Text className='setting-suffix'>{suffix}</Text>}
      </View>
    </View>
  )
}