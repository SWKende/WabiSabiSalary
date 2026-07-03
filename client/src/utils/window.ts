import Taro from '@tarojs/taro'

// 获取窗口信息（兼容新旧版本基础库）
export function getWindowInfo() {
  try {
    if (typeof Taro.getWindowInfo === 'function') {
      return Taro.getWindowInfo()
    }
  } catch {
    /* ignore */
  }
  // 回退：旧版 API
  const fallback = Taro.getSystemInfoSync()
  return {
    statusBarHeight: fallback.statusBarHeight ?? 20,
    windowWidth: fallback.windowWidth ?? 375,
  }
}