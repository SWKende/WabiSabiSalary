import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 配置：把 Taro H5 产物套成安卓 App。
 *
 * - webDir 指向 `npm run build:h5` 的产物目录（Taro 的 outputRoot 就是 dist）。
 * - androidScheme https：WebView 以 https 源加载，避免 http/https 混用与 Cookie/存储限制。
 */
const config: CapacitorConfig = {
  appId: 'com.swkende.salaryclock',
  appName: '记账',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#f5f0e8',
    allowMixedContent: false,
  },
}

export default config
