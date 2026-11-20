/* Laden der Daten: live von den Quellen, sonst die Kopien im Hauptordner (GitHub Action, alle 30 Min.),
   sonst der zuletzt gespeicherte Stand im Gerät. Gleiche Speicherschlüssel wie die bisherige App. */
import { useCallback, useEffect, useRef, useState } from "react"
import type { Forecast, LakeData, Outlook, Pt, Temp, Warn, WaterHist } from "./types"
import { WX_URL, mergeWx } from "./model"

const API = "https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/aa9179c1-17ef-4c61-a48a-74193fa7bfdf/W"
const BASE = (import.meta.env.VITE_DATA_BASE as string | undefined) ?? "./"
const file = (name: string) => `${BASE}${name}?t=${Date.now()}`
const K = {
  water: "pegel-kn-v1", temp: "pegel-kn-temp-v1", hist: "pegel-kn-hist-v1",
  outlook: "pegel-kn-outlook-v1", wx: "pegel-kn-wx-v1", warn: "pegel-kn-warn-v1",
}

export function load<T>(k: string): T | null {
  try { return (JSON.parse(localStorage.getItem(k) ?? "null") as T) || null } catch { return null }
}
export function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* Speicher voll oder gesperrt */ }
}

async function getJSON<T>(url: string): Promise<T> {
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" })
    if (!r.ok) throw new Error("HTTP " + r.status)
    return (await r.json()) as T
  } finally { clearTimeout(to) }
}

/* Letzter Notstand Wasserstand (26.10.2026), falls weder Netz noch Gerätespeicher etwas liefern */
const SNAPSHOT: Pt[] = (() => {
  const d: Record<string, number> = {
    "2026-09-26": 255, "2026-09-27": 254, "2026-09-28": 254, "2026-09-29": 252, "2026-09-30": 252, "2026-10-01": 251,
    "2026-10-02": 250, "2026-10-03": 250, "2026-10-04": 250, "2026-10-05": 248, "2026-10-06": 248, "2026-10-07": 248,
    "2026-10-08": 247, "2026-10-09": 249, "2026-10-10": 250, "2026-10-11": 251, "2026-10-12": 250, "2026-10-13": 250,
    "2026-10-14": 251, "2026-10-15": 249, "2026-10-16": 250, "2026-10-17": 250, "2026-10-18": 250, "2026-10-19": 249,
    "2026-10-20": 249, "2026-10-21": 249, "2026-10-22": 248, "2026-10-23": 250, "2026-10-24": 249, "2026-10-25": 248, "2026-10-26": 249,
  }
  const s = Object.keys(d).sort().map((k) => ({ t: new Date(k + "T00:00:00" + (k >= "2026-10-25" ? "+01:00" : "+02:00")).getTime(), v: d[k] }))
  s.push({ t: new Date("2026-10-26T23:30:00+01:00").getTime(), v: 250 })
  return s
})()

function initial(): LakeData {
  const w = load<{ series: Pt[] }>(K.water), t = load<Temp>(K.temp), x = mergeWx(load(K.wx))
  return {
    water: { series: w?.series?.length ? w.series : SNAPSHOT, live: false },
    hist: load<WaterHist>(K.hist),
    outlook: load<Outlook>(K.outlook),
    temp: t?.daily && t.current ? { j: t, live: false } : null,
    wx: x ? { list: x, live: false } : null,
    warn: load<Warn>(K.warn),
  }
}

type Measurement = { timestamp: string; value: number }
const toSeries = (arr: Measurement[]) =>
  arr.map((m) => ({ t: new Date(m.timestamp).getTime(), v: m.value })).filter((p) => isFinite(p.v)).sort((a, b) => a.t - b.t)

export function useLakeData() {
  const [data, setData] = useState<LakeData>(initial)
  const [loading, setLoading] = useState(true)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true; setLoading(true)
    const [w, t, h, o, x, n] = await Promise.allSettled([
      (async () => {
        let arr: Measurement[]
        try { arr = await getJSON<Measurement[]>(`${API}/measurements.json?start=P31D`) }
        catch { arr = await getJSON<Measurement[]>(file("data.json")) } // Kopie, die GitHub alle 30 Min. aktualisiert
        const s = toSeries(arr); if (!s.length) throw new Error("leer")
        return s
      })(),
      getJSON<Temp>(file("temp.json")).then((j) => { if (!j?.daily || !j.current) throw new Error("leer"); return j }),
      getJSON<WaterHist>(file("wl_hist.json")).then((j) => { if (!j?.daily) throw new Error("leer"); return j }),
      getJSON<Outlook>(file("outlook.json")).then((j) => { if (!j || (!j.lake && !j.wx)) throw new Error("leer"); return j }),
      (async () => {
        try { const r = mergeWx(await getJSON(WX_URL)); if (!r) throw new Error("Format"); return { list: r, live: true } }
        catch { const r = mergeWx(await getJSON(file("weather.json"))); if (!r) throw new Error("Format"); return { list: r, live: false } }
      })(),
      getJSON<Warn>(file("warn.json")),
    ])
    setData((prev) => {
      const next = { ...prev }
      if (w.status === "fulfilled") { save(K.water, { series: w.value }); next.water = { series: w.value, live: true } }
      else if (prev.water) next.water = { ...prev.water, live: false }
      if (t.status === "fulfilled") { save(K.temp, t.value); next.temp = { j: t.value, live: true } }
      else if (prev.temp) next.temp = { ...prev.temp, live: false }
      if (h.status === "fulfilled") { save(K.hist, h.value); next.hist = h.value }
      if (o.status === "fulfilled") { save(K.outlook, o.value); next.outlook = o.value }
      if (x.status === "fulfilled") { save(K.wx, x.value.list); next.wx = x.value as { list: Forecast[]; live: boolean } }
      else if (prev.wx) next.wx = { ...prev.wx, live: false }
      if (n.status === "fulfilled" && n.value?.regions) { save(K.warn, n.value); next.warn = n.value }
      return next
    })
    setLoading(false)
    busy.current = false
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => { if (document.visibilityState === "visible") void refresh() }, 15 * 60 * 1000)
    const vis = () => { if (document.visibilityState === "visible") void refresh() }
    document.addEventListener("visibilitychange", vis)
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis) }
  }, [refresh])

  return { data, loading, refresh }
}
