import type { BackupFile } from './backup'

/** 备份文件名。带上日期便于在微信/网盘里区分多次备份 */
export function backupFileName(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `salary-clock-backup-${stamp}.json`
}

function serialize(file: BackupFile): string {
  return JSON.stringify(file, null, 2)
}

function downloadAsFile(content: string, name: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 交给浏览器取走后再回收，过早 revoke 会让下载拿不到数据
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * 导出：优先走系统分享面板（安卓 WebView 原生支持，可发到微信/文件/网盘），
 * 不支持时退回下载链接。两条路都成，调用方不需要区分环境。
 */
export async function exportBackupFile(file: BackupFile): Promise<'shared' | 'downloaded'> {
  const name = backupFileName()
  const content = serialize(file)
  const share = (navigator as { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> })

  if (typeof share.canShare === 'function' && typeof share.share === 'function') {
    const candidate = new File([content], name, { type: 'application/json' })
    if (share.canShare({ files: [candidate] })) {
      await share.share({ files: [candidate], title: name })
      return 'shared'
    }
  }

  downloadAsFile(content, name)
  return 'downloaded'
}

/** 用系统文件选择器取一个文本文件内容；用户取消时返回 null */
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'

    input.onchange = () => {
      const chosen = input.files && input.files[0]
      if (!chosen) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsText(chosen)
    }
    // 取消选择不会触发任何事件，无法据此判定；交给调用方处理空内容
    input.click()
  })
}
