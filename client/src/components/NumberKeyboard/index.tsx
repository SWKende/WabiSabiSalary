import { View, Text } from '@tarojs/components'
import './index.scss'

interface NumberKeyboardProps {
  visible: boolean
  value: string
  onChange: (value: string) => void
  onConfirm: (value: string) => void
  onCancel: () => void
}

const NUMBER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'] as const

function appendKey(currentValue: string, key: typeof NUMBER_KEYS[number]) {
  if (key === 'delete') {
    return currentValue.slice(0, -1)
  }

  if (key === '.') {
    if (currentValue.includes('.')) return currentValue
    return currentValue ? `${currentValue}.` : '0.'
  }

  const [integerPart, decimalPart] = currentValue.split('.')

  if (decimalPart !== undefined && decimalPart.length >= 2) {
    return currentValue
  }

  if (!currentValue) {
    return key
  }

  if (currentValue === '0' && key === '0') {
    return currentValue
  }

  if (currentValue === '0' && key !== '0') {
    return key
  }

  return `${currentValue}${key}`
}

export default function NumberKeyboard({
  visible,
  value,
  onChange,
  onConfirm,
  onCancel,
}: NumberKeyboardProps) {
  if (!visible) return null

  return (
    <View className='nk-overlay' onClick={onCancel}>
      <View className='nk-panel' onClick={(e) => e.stopPropagation()}>
        <View className='nk-handle' />
        <View className='nk-header'>
          <Text className='nk-title'>輸入金額</Text>
          <Text className='nk-preview'>{value || '0'}</Text>
        </View>

        <View className='nk-grid'>
          {NUMBER_KEYS.map((key) => {
            const isDelete = key === 'delete'
            return (
              <View
                key={key}
                className={`nk-key ${isDelete ? 'nk-key-delete' : ''}`}
                onClick={() => onChange(appendKey(value, key))}
              >
                <Text className='nk-key-text'>{isDelete ? '刪除' : key}</Text>
              </View>
            )
          })}
        </View>

        <View className='nk-footer'>
          <View className='nk-btn nk-btn-cancel' onClick={onCancel}>
            <Text className='nk-btn-text'>收 起</Text>
          </View>
          <View className='nk-btn nk-btn-confirm' onClick={() => onConfirm(value)}>
            <Text className='nk-btn-text'>確 認</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
