import { View } from '@tarojs/components'
import { useState, useEffect, useRef, useMemo } from 'react'
import './index.scss'

// 单个字符位 — 独立检测变化并触发动画
// 使用 View 包裹而非 Text，避免 Taro Text 组件对 children key 的干扰
function DigitSlot({ char }: { char: string }) {
  const [animating, setAnimating] = useState(false)
  const prevRef = useRef(char)

  useEffect(() => {
    if (char !== prevRef.current) {
      prevRef.current = char
      setAnimating(false)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true)
        })
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [char])

  return (
    <View className={`animated-char ${animating ? 'char-slide-up' : ''}`}>
      {char}
    </View>
  )
}

interface AnimatedNumberProps {
  value: string
  className?: string
}

// 动画数字组件 — 按数字位独立控制，仅变化的位触发动画
export default function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  // 直接按字符拆分，每个字符一个独立槽位
  // key 使用 "pos-" 前缀 + 绝对位置索引，确保唯一且稳定
  const chars = useMemo(() => {
    return value.split('').map((char, i) => ({
      char,
      key: `pos-${i}`,
    }))
  }, [value])

  return (
    <View className={`animated-number ${className || ''}`}>
      {chars.map((item) => (
        <DigitSlot key={item.key} char={item.char} />
      ))}
    </View>
  )
}