// 格式化：固定小数位，避免 toLocaleString 的不确定性
export function formatMoney2(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatMoney4(amount: number): string {
  return amount.toFixed(4)
}