export function cny(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(n) >= 1000) {
    return `¥${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  }
  const sign = n < 0 ? "-" : "";
  return `${sign}¥${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

export function usd(n: number, digits = 2): string {
  return `$${n.toFixed(digits)}`;
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function signedPt(n: number): string {
  return `${n > 0 ? "+" : ""}${n}pt`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const h = diff / 3.6e6;
  if (h < 1) return "刚刚";
  if (h < 24) return `${Math.floor(h)} 小时前`;
  const d = Math.floor(h / 24);
  if (d === 1) return "昨天";
  return `${d} 天前`;
}

export function compactNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}
