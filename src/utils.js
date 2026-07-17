export const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format
export const shortDate = (v) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${v}T12:00:00`))
export const sum = (items, getter) => items.reduce((total, item) => total + Number(getter(item) || 0), 0)

export function taxEstimate(profit) {
  const personalAllowance = profit > 125140 ? 0 : profit > 100000 ? Math.max(0, 12570 - (profit - 100000) / 2) : 12570
  const taxable = Math.max(0, profit - personalAllowance)
  const basic = Math.min(taxable, 37700) * .2
  const higher = Math.min(Math.max(0, taxable - 37700), 74870) * .4
  const additional = Math.max(0, taxable - 112570) * .45
  const class4 = Math.min(Math.max(0, profit - 12570), 37700) * .06 + Math.max(0, profit - 50270) * .02
  return { incomeTax: basic + higher + additional, ni: class4, total: basic + higher + additional + class4 }
}

export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
