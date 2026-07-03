import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import App from './app'
import { Provider } from '@tarojs/components'

const container = document.getElementById('app')
if (container) {
  const root = createRoot(container)
  root.render(
    createElement(Provider, {}, createElement(App))
  )
}
