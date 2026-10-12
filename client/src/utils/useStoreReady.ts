import { useSyncExternalStore } from 'react'
import { isStoreReady, subscribeStoreReady } from './store'

/**
 * store 就绪前返回 false。页面用它决定挂载真实内容——
 * 因为页面里的配置与记账记录是在首次渲染时用同步读拿的，必须等本地库进内存之后。
 */
export function useStoreReady(): boolean {
  return useSyncExternalStore(subscribeStoreReady, isStoreReady, isStoreReady)
}
