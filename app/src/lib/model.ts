/* Fachlogik: Wasserstand, Wassertemperatur, Ausblick, Wetter und Sturmwarnung.
   Übernommen aus der bisherigen App, Rechenwege unverändert. */
import type { Forecast, Outlook, Pt, Temp, Warn, WarnKey, WaterHist } from "./types"

export const DAY = 864e5
/** Mittelwasser, mittleres Niedrigwasser (cm am Pegel Konstanz), Pegelnullpunkt (m ü. NHN) */
export const MW = 341, MNW = 262, ZERO = 391.89
const MONTH_MEAN = [296, 289, 296, 319, 361, 403, 411, 391, 363, 339, 319, 303] // Näherung, Monatsmitte

/* ───────── Formate ───────── */
export const fmtD = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
export const fmtT = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
export const fmtWd = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })
export const fmtC = (v: number) => v.toFixed(1).replace(".", ",")
export const sgn = (v: number) => (Math.round(v) > 0 ? "+" : Math.round(v) < 0 ? "−" : "±") + Math.abs(Math.round(v))
export const sgnC = (v: number) => { const r = Math.round(v * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "±") + fmtC(Math.abs(r)) }
/** Richtung einer Änderung: 1 steigt, −1 fällt, 0 gleich (gerundet auf ganze cm bzw. Zehntelgrad) */
export const dir = (v: number, tenth = false) => Math.sign(Math.round(tenth ? v * 10 : v))
export const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const doy = (d: Date) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / DAY
const parseDay = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d) }
export function inDays(t: number) {
  const n = Math.round((dayStart(new Date(t)).getTime() - dayStart(new Date()).getTime()) / DAY)
  return n === 1 ? "morgen" : `in ${n} Tagen`
}
export const when = (d: Date) => `${fmtD(d)}, ${fmtT(d)} Uhr`

/* ───────── Wasserstand ───────── */
export function meanFor(d: Date) {
  const y = d.getFullYear(), t = doy(d)
  const mids = MONTH_MEAN.map((_, i) => doy(new Date(y, i, 15)))
  const x = t < mids[0] ? t + 365 : t
  for (let i = 0; i < 12; i++) {
    const a = mids[i], b = i < 11 ? mids[i + 1] : mids[0] + 365
    if (x >= a && x <= b) { const f = (x - a) / (b - a); return MONTH_MEAN[i] + (MONTH_MEAN[(i + 1) % 12] - MONTH_MEAN[i]) * f }
  }
  return MW
}
export function nearest(series: Pt[], t: number, tol: number) {
  let best: Pt | null = null, bd = Infinity
  for (const p of series) { const dd = Math.abs(p.t - t); if (dd < bd) { bd = dd; best = p } }
  return bd <= tol ? best : null
}
/** Steigung je x-Einheit (lineare Regression) */
export function slope(pts: [number, number][]) {
  const n = pts.length; if (n < 3) return null
  const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n
  let num = 0, den = 0
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2 }
  return den ? num / den : null
}
export function histAt(h: WaterHist | null, d: Date) {
  if (!h) return null
  const i = Math.round((dayStart(d).getTime() - parseDay(h.start).getTime()) / DAY)
  const v = i >= 0 && i < h.daily.length ? h.daily[i] : null
  return v ?? null
}

/** Summe/Mittel der nächsten Tage ab heute aus dem Einzugsgebiet */
export function wxNext(o: Outlook | null, days: number) {
  const w = o?.wx; if (!w) return null
  const i = w.dates.indexOf(keyOf(new Date())); if (i < 0) return null
  const sl = (a: number[]) => a.slice(i, i + days)
  const precip = sl(w.precip).reduce((a, b) => a + b, 0), snow = sl(w.snow).reduce((a, b) => a + b, 0)
  const air = sl(w.air)
  return { precip, snow, airMean: air.reduce((a, b) => a + b, 0) / air.length }
}
export function rainText(mm: number, snow: number) {
  const t = mm < 5 ? "Trocken" : mm < 20 ? "Wenig Regen" : mm < 50 ? "Regen" : "Viel Regen"
  let sub = mm < 5 ? "kaum Zufluss, See bleibt eher auf dem Niveau" : mm < 20 ? "geringer Einfluss auf den Seespiegel" : mm < 50 ? "leichter Anstieg möglich" : "deutlicher Anstieg wahrscheinlich"
  if (snow > 10) sub += ", in den Bergen teils als Schnee"
  return { t, sub }
}
export type LakeForecast = { med: Pt[]; lo: Pt[]; hi: Pt[]; end: Pt; rLo: Pt; rHi: Pt }
/** Amtliche Vorhersage Romanshorn als Veränderung auf Konstanz übertragen */
export function lakeForecast(o: Outlook | null, cur: number): LakeForecast | null {
  const L = o?.lake; if (!L || !L.median || !L.base) return null
  const base = L.base[1], f = (v: number) => cur + (v - base) * 100
  const conv = (a?: [string, number][]) => (a || []).map(([x, v]) => ({ t: new Date(x).getTime(), v: f(v) }))
  const med = conv(L.median), lo = conv(L.p25), hi = conv(L.p75)
  if (!med.length || med.at(-1)!.t < Date.now() - DAY) return null // veraltet
  const mn = conv(L.min), mx = conv(L.max)
  return { med, lo, hi, end: med.at(-1)!, rLo: (mn.length ? mn : lo).at(-1) ?? med.at(-1)!, rHi: (mx.length ? mx : hi).at(-1) ?? med.at(-1)! }
}

export type CompareRow = { label: string; sub: string; value: number; delta: number; mean?: boolean }
export function waterModel(series: Pt[], hist: WaterHist | null, outlook: Outlook | null) {
  const last = series.at(-1)!
  const now = new Date(last.t), today = dayStart(now)
  const cur = last.v, meanToday = meanFor(now)
  const rows: CompareRow[] = []
  for (const [label, n] of [["Vor einem Tag", 1], ["Vor einer Woche", 7], ["Vor einem Monat", 30]] as const) {
    const p = nearest(series, last.t - n * DAY, n === 1 ? 3 * 3600e3 : 12 * 3600e3)
    if (p) rows.push({ label, sub: `${fmtD(new Date(p.t))}, ${fmtT(new Date(p.t))}`, value: p.v, delta: cur - p.v })
  }
  const ly = new Date(today); ly.setFullYear(ly.getFullYear() - 1)
  const pv = histAt(hist, ly)
  if (pv != null) rows.push({ label: "Vorjahr", sub: `${fmtD(ly)}${ly.getFullYear()}, Tagesmittel`, value: pv, delta: cur - pv })
  rows.push({ label: `Mittel am ${fmtD(today)}`, sub: "langjährig, Näherung", value: meanToday, delta: cur - meanToday, mean: true })

  const wk = series.filter((p) => p.t >= last.t - 7 * DAY).map((p) => [(p.t - last.t) / DAY, p.v] as [number, number])
  const sl = slope(wk)
  const fc = lakeForecast(outlook, cur)
  const wx = wxNext(outlook, 7)
  return {
    now, today, cur, meanToday, rows, fc, wx,
    trend: sl == null ? null : sl * 7,
    nhn: `${(ZERO + cur / 100).toFixed(2).replace(".", ",")} m ü. NHN`,
    low: cur < MNW,
  }
}

/* ───────── Wassertemperatur ───────── */
export type Climo = { mean: number; min: number; max: number; n: number }
export function tempModel(j: Temp) {
  const start = parseDay(j.start), sy = start.getFullYear()
  const at = (d: Date) => {
    const i = Math.round((dayStart(d).getTime() - start.getTime()) / DAY)
    return i >= 0 && i < j.daily.length ? j.daily[i] ?? null : null
  }
  const [cd, ct] = j.current.t.split("T"); const [cy, cm, cdd] = cd.split("-").map(Number); const [ch, cmi] = ct.split(":").map(Number)
  const now = new Date(cy, cm - 1, cdd, ch, cmi)
  const year = now.getFullYear()
  const cache = new Map<string, Climo | null>()
  /** Klimatologie je Kalendertag: Mittel der Jahre (±3 Tage geglättet), dazu kältestes/wärmstes Jahr */
  const climo = (d: Date): Climo | null => {
    const k = `${d.getMonth()}-${d.getDate()}`
    if (cache.has(k)) return cache.get(k)!
    const per: number[] = []
    for (let y = sy; y < year; y++) {
      const vals: number[] = []
      for (let q = -3; q <= 3; q++) { const v = at(new Date(y, d.getMonth(), d.getDate() + q)); if (v != null) vals.push(v) }
      if (vals.length >= 4) per.push(vals.reduce((a, b) => a + b, 0) / vals.length)
    }
    const r = per.length < 5 ? null : { mean: per.reduce((a, b) => a + b, 0) / per.length, min: Math.min(...per), max: Math.max(...per), n: per.length }
    cache.set(k, r)
    return r
  }
  return { at, now, year, climo, cur: j.current.v, firstYear: sy }
}
export type TempModel = ReturnType<typeof tempModel>

/** Wassertemperatur Tag für Tag an die vorhergesagte Luft annähern; Rate aus den letzten 30 Tagen */
export function tempProjection(m: TempModel, today: Date, cur: number, o: Outlook | null) {
  const w = o?.wx; if (!w) return null
  const air: Record<string, number> = {}; w.dates.forEach((d, i) => (air[d] = w.air[i]))
  let num = 0, den = 0
  for (let n = 30; n >= 1; n--) {
    const d = addDays(today, -n), d2 = addDays(d, 1)
    const t1 = m.at(d), t2 = m.at(d2), a = air[keyOf(d)]
    if (t1 == null || t2 == null || a == null) continue
    const x = a - t1; num += (t2 - t1) * x; den += x * x
  }
  let k = den > 0 ? num / den : 0.08; k = Math.max(0.02, Math.min(0.3, k))
  const pts = [{ n: 0, v: cur }]; let T = cur
  for (let n = 0; n < 7; n++) { const a = air[keyOf(addDays(today, n))]; if (a == null) break; T += k * (a - T); pts.push({ n: n + 1, v: T }) }
  return pts.length > 1 ? { pts, k } : null
}

export function tempSummary(j: Temp, o: Outlook | null) {
  const m = tempModel(j)
  const { now, cur } = m
  const today = dayStart(now)
  const c = m.climo(today)
  const todayMean = m.at(today)
  const rows: CompareRow[] = []
  const add = (label: string, sub: string, v: number | null, mean = false) => { if (v != null) rows.push({ label, sub, value: v, delta: cur - v, mean }) }
  const ly = new Date(today); ly.setFullYear(ly.getFullYear() - 1)
  add("Vor einem Tag", `${fmtD(addDays(today, -1))}, Tagesmittel`, m.at(addDays(today, -1)))
  add("Vor einer Woche", `${fmtD(addDays(today, -7))}, Tagesmittel`, m.at(addDays(today, -7)))
  add("Vor einem Monat", `${fmtD(addDays(today, -30))}, Tagesmittel`, m.at(addDays(today, -30)))
  add("Vorjahr", `${fmtD(ly)}${ly.getFullYear()}, Tagesmittel`, m.at(ly))
  if (c) add(`Mittel am ${fmtD(today)}`, `${m.firstYear}–${m.year - 1}, ${c.n} Jahre`, c.mean, true)
  const wk: [number, number][] = []
  for (let n = 7; n >= 0; n--) { const v = n === 0 ? cur : m.at(addDays(today, -n)); if (v != null) wk.push([-n, v]) }
  const proj = tempProjection(m, today, cur, o)
  const end = proj ? { v: proj.pts.at(-1)!.v, t: addDays(today, proj.pts.at(-1)!.n).getTime() } : null
  return { m, now, today, cur, c, todayMean, rows, trend: slope(wk), proj, end, wx: wxNext(o, 7) }
}

/* ───────── Wetter ───────── */
export const REGIONS: { n: string; town: string; warn: WarnKey }[] = [
  { n: "Ost", town: "Lindau", warn: "ost" },
  { n: "Mitte", town: "Friedrichshafen", warn: "mitte" },
  { n: "West", town: "Überlingen", warn: "west" },
]
export const WARNAREA: Record<WarnKey, { n: string; d: string }> = {
  west: { n: "West", d: "Überlinger See und Untersee, westlich der Linie Konstanz–Meersburg" },
  mitte: { n: "Mitte", d: "Konstanz, Meersburg, Friedrichshafen bis Arbon–Langenargen" },
  ost: { n: "Ost", d: "Langenargen, Lindau, Bregenz, östlich von Arbon–Langenargen" },
}
export const WARN_KEYS: WarnKey[] = ["west", "mitte", "ost"]

// Reihenfolge: drei Punkte auf dem See (Wind), dann drei Orte an Land (Temperatur, Wetter, Regen)
export const WX_URL = "https://api.open-meteo.com/v1/forecast?latitude=47.535,47.625,47.755,47.5455,47.654,47.767&longitude=9.66,9.47,9.165,9.6829,9.479,9.159"
  + "&current=temperature_2m,apparent_temperature,weather_code,cloud_cover,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m"
  + "&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m"
  + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset"
  + "&forecast_days=4&timezone=Europe%2FBerlin&wind_speed_unit=kmh"
const WINDKEYS = ["wind_speed_10m", "wind_gusts_10m", "wind_direction_10m", "wind_speed_10m_max", "wind_gusts_10m_max", "wind_direction_10m_dominant"]
/** Wind vom See, alles andere vom Ort an Land */
export function mergeWx(arr: unknown): Forecast[] | null {
  if (!Array.isArray(arr)) return null
  if (arr.length === 3) return arr as Forecast[]
  if (arr.length !== 6) return null
  return [0, 1, 2].map((i) => {
    const lake = arr[i] as Record<string, Record<string, unknown>>, land = arr[i + 3]
    const out = structuredClone(land) as Record<string, Record<string, unknown>>
    for (const part of ["current", "hourly", "daily"]) for (const k of WINDKEYS) if (lake[part] && k in lake[part]) out[part][k] = lake[part][k]
    return out as unknown as Forecast
  })
}

const BFT = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]
export const bft = (v: number) => { let b = 0; while (b < BFT.length && v >= BFT[b]) b++; return b }
const DIRS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"]
export const dirName = (deg: number) => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
export function wxText(c: number) {
  if (c === 0) return "Klar"; if (c === 1) return "Überwiegend klar"; if (c === 2) return "Teils bewölkt"; if (c === 3) return "Bedeckt"
  if (c === 45 || c === 48) return "Nebel"; if (c >= 51 && c <= 57) return "Nieselregen"; if (c >= 61 && c <= 67) return c >= 65 ? "Starker Regen" : "Regen"
  if (c >= 71 && c <= 77) return "Schnee"; if (c >= 80 && c <= 82) return "Schauer"; if (c === 85 || c === 86) return "Schneeschauer"; if (c >= 95) return "Gewitter"
  return "–"
}
export type Kind = "clear" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm"
export function wxKind(c: number): Kind {
  if (c === 0) return "clear"; if (c === 1 || c === 2) return "partly"; if (c === 45 || c === 48) return "fog"
  if (c >= 95) return "storm"; if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow"
  if (c >= 51 && c <= 57) return "drizzle"; if (c >= 61) return "rain"
  return "cloud"
}
export function isNight(iso: string, daily: Forecast["daily"]) {
  const i = daily.time.indexOf(iso.slice(0, 10)); if (i < 0) return false
  return iso < daily.sunrise[i] || iso >= daily.sunset[i]
}
export const wdDay = parseDay

export function warnInfo(W: Warn | null) {
  if (!W || !W.regions) return null
  const checked = new Date(W.checked)
  const stale = (Date.now() - checked.getTime()) / 60000 > 45
  const active = WARN_KEYS.filter((k) => (W.regions[k]?.level ?? 0) > 0)
  const max = active.length ? Math.max(...active.map((k) => W.regions[k]!.level!)) : 0
  return { checked, stale, active, max }
}
export const warnName = (lv: number | null | undefined) => lv === 2 ? "Sturmwarnung" : lv === 1 ? "Starkwindwarnung" : lv === 0 ? "Keine Warnung" : null
