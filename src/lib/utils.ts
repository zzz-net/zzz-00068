import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

export function formatTime(ts: number, timezone?: string): string {
  const d = timezone ? toZonedDate(ts, timezone) : new Date(ts)
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  )
}

export function formatDate(ts: number, timezone?: string): string {
  const d = timezone ? toZonedDate(ts, timezone) : new Date(ts)
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
}

export function formatDurationMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return minutes + "分钟"
  }
  if (minutes === 0) {
    return hours + "小时"
  }
  return hours + "小时" + minutes + "分钟"
}

export function downloadBlob(
  content: string,
  filename: string,
  mime: string = "text/plain",
): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function getTodayStr(timezone?: string): string {
  const d = timezone ? toZonedDate(Date.now(), timezone) : new Date()
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate())
  )
}

export function getTodayStartTs(timezone?: string): number {
  const d = timezone ? toZonedDate(Date.now(), timezone) : new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function toZonedDate(ts: number, ianaTimezone: string): Date {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(new Date(ts))
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
    const year = Number(get('year'))
    const month = Number(get('month')) - 1
    const day = Number(get('day'))
    const hour = Number(get('hour')) === 24 ? 0 : Number(get('hour'))
    const minute = Number(get('minute'))
    const second = Number(get('second'))
    return new Date(year, month, day, hour, minute, second, 0)
  } catch {
    return new Date(ts)
  }
}

export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate())
}

export function parseLocalTime(
  dateStr: string,
  hhmm: string,
  timezone?: string,
): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  const [h, min] = hhmm.split(":").map(Number)
  if (!timezone) {
    return new Date(y, m - 1, d, h, min, 0, 0).getTime()
  }
  const localMidnight = new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, localMidnight)
  const naive = new Date(y, m - 1, d, h, min, 0, 0).getTime()
  return naive + offsetMinutes * 60 * 1000
}

export function getTimezoneOffsetMinutes(ianaTimezone: string, atTs: number = Date.now()): number {
  try {
    const local = new Date(atTs)
    const asZone = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(local)
    const parts = asZone.match(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/)
    if (!parts) return 0
    const zoneDate = new Date(
      Number(parts[3]), Number(parts[1]) - 1, Number(parts[2]),
      Number(parts[4]) === 24 ? 0 : Number(parts[4]),
      Number(parts[5]), Number(parts[6]),
    )
    return Math.round((zoneDate.getTime() - local.getTime()) / 60000)
  } catch {
    return 0
  }
}

export function birthdayMatches(birthday1?: string, birthday2?: string): boolean {
  if (!birthday1 || !birthday2) return false
  const normalize = (s: string) => s.replace(/[./]/g, '-').replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/, (_, y, m, d) => `${y}-${pad(Number(m))}-${pad(Number(d))}`)
  return normalize(birthday1) === normalize(birthday2)
}

export function ageFromBirthday(birthday: string, atTs: number = Date.now()): number {
  const [y, m, d] = birthday.split(/[-/.]/).map(Number)
  if (!y || !m || !d) return 0
  const today = new Date(atTs)
  let age = today.getFullYear() - y
  const monthDiff = today.getMonth() - (m - 1)
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--
  return age
}

export const todayStr = getTodayStr()
