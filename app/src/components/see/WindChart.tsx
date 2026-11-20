/* Windprognose 48 Stunden mit Risikobändern wie im Boot-Cockpit.
   Die Warngrenzen am Bodensee beziehen sich auf Böen: Starkwind ab 25 kn (46 km/h), Sturm ab 34 kn (63 km/h). */
import { useCallback, useMemo } from "react"
import type { Forecast } from "@/lib/types"
import { bft, dirName, fmtT } from "@/lib/model"
import { Chart, Legend, type Layer, type Probe } from "./Chart"
import { Note, Section, StatePill } from "./bits"

export const GALE = 46, STORM = 63
const HOURS = 48
const kn = (v: number) => Math.round(v / 1.852)
const parse = (s: string) => new Date(s).getTime() // Ortszeit ohne Zone, wie von Open-Meteo geliefert
const level = (g: number) => (g >= STORM ? 2 : g >= GALE ? 1 : 0)
const dayLabel = (t: number) => new Date(t).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "")

export function WindForecast({ p, area }: { p: Forecast; area?: string }) {
  const H = p.hourly
  const c = useMemo(() => {
    const nowH = p.current.time.slice(0, 13)
    let i0 = H.time.findIndex((t) => t.slice(0, 13) >= nowH); if (i0 < 0) i0 = 0
    const i1 = Math.min(H.time.length - 1, i0 + HOURS)
    const idx = Array.from({ length: i1 - i0 + 1 }, (_, k) => i0 + k)
    const wind = idx.map((i) => ({ t: parse(H.time[i]), v: H.wind_speed_10m[i] }))
    const gust = idx.map((i) => ({ t: parse(H.time[i]), v: H.wind_gusts_10m[i] }))
    const t0 = wind[0].t, t1 = wind.at(-1)!.t
    const maxG = Math.max(...gust.map((g) => g.v))
    const hi = Math.max(80, Math.ceil((maxG + 6) / 10) * 10)
    const peak = gust.reduce((a, b) => (b.v > a.v ? b : a), gust[0])
    const layers: Layer[] = [
      { kind: "zone", lo: GALE, hi: STORM, color: "color-mix(in srgb, var(--gale) 13%, transparent)", label: "Starkwind", labelColor: "var(--gale)" },
      { kind: "zone", lo: STORM, hi, color: "color-mix(in srgb, var(--storm) 12%, transparent)", label: "Sturm", labelColor: "var(--storm)" },
    ]
    // Mitternacht als Tagesgrenze
    const ticks: { t: number; label: string }[] = []
    for (const q of wind) {
      const d = new Date(q.t)
      if (d.getHours() === 0 && q.t > t0) layers.push({ kind: "vline", t: q.t })
      if (d.getHours() % 12 === 0) ticks.push({ t: q.t, label: d.getHours() === 0 ? dayLabel(q.t) : "12 Uhr" })
    }
    layers.push(
      { kind: "area", pts: wind, color: "var(--lake-soft)" },
      { kind: "line", pts: gust, color: "var(--muted-foreground)", width: 1.75, dash: "5 4" },
      { kind: "line", pts: wind, color: "var(--lake)", width: 2.5 },
      { kind: "dot", t: peak.t, v: peak.v, color: peak.v >= STORM ? "var(--storm)" : peak.v >= GALE ? "var(--gale)" : "var(--muted-foreground)", r: 4 },
    )
    return { t0, t1, hi, layers, ticks, wind, gust, idx, peak }
  }, [H, p.current.time])

  const probe = useCallback((t: number): Probe | null => {
    const k = Math.max(0, Math.min(c.wind.length - 1, Math.round((t - c.t0) / 3600e3)))
    const w = c.wind[k], g = c.gust[k], i = c.idx[k]
    if (!w || !g) return null
    const d = new Date(w.t)
    const lv = level(g.v)
    return {
      t: w.t,
      title: `${d.toLocaleDateString("de-DE", { weekday: "short" })} ${fmtT(d)} Uhr${lv ? lv === 2 ? ", Sturm" : ", Starkwind" : ""}`,
      items: [
        { color: "var(--lake)", label: `Wind aus ${dirName(H.wind_direction_10m[i])}`, value: `${Math.round(w.v)} km/h, ${bft(w.v)} Bft`, v: w.v },
        { color: lv === 2 ? "var(--storm)" : lv === 1 ? "var(--gale)" : "var(--muted-foreground)", label: "Böen", value: `${Math.round(g.v)} km/h, ${kn(g.v)} kn`, v: g.v },
      ],
    }
  }, [c, H.wind_direction_10m])

  const pk = c.peak, pkLv = level(pk.v), pkD = new Date(pk.t)
  const pkWhen = `${pkD.toLocaleDateString("de-DE", { weekday: "long" })} ${fmtT(pkD)} Uhr`
  return (
    <Section title="Windprognose" id="x-wind" area="w" aside={area ? `48 Stunden, ${area}` : "48 Stunden"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4">
        {pkLv === 2 ? <StatePill tone="storm">Böen im Sturmbereich</StatePill>
          : pkLv === 1 ? <StatePill tone="gale">Böen im Starkwindbereich</StatePill>
            : <StatePill tone="ok">Böen unter der Starkwindgrenze</StatePill>}
        <span className="text-caption text-muted-foreground">
          Höchste Böen <b className="font-semibold text-foreground">{Math.round(pk.v)} km/h ({kn(pk.v)} kn)</b>, {pkWhen}
        </span>
      </div>
      <div className="px-3 pt-3 pb-1 sm:px-4">
        <Chart t0={c.t0} t1={c.t1} lo={0} hi={c.hi} step={c.hi > 100 ? 20 : 10} xTicks={c.ticks} layers={c.layers}
          probe={probe} keyStep={3600e3} height={230} label="Wind und Böen der nächsten 48 Stunden mit Starkwind- und Sturmbereich" />
      </div>
      <div className="px-5 pb-4">
        <Legend items={[
          { color: "var(--lake)", label: "Wind" },
          { color: "var(--muted-foreground)", label: "Böen", kind: "dash" },
          { color: "color-mix(in srgb, var(--gale) 35%, transparent)", label: "Starkwind, Böen ab 25 kn (46 km/h)", kind: "box" },
          { color: "color-mix(in srgb, var(--storm) 35%, transparent)", label: "Sturm, Böen ab 34 kn (63 km/h)", kind: "box" },
        ]} />
      </div>
      <Note>
        Modellwerte über dem See in km/h. Die Bänder zeigen die Grenzen der Starkwind- und Sturmwarnung am Bodensee, sie sind keine Warnung.
        Verbindlich sind allein die Warnleuchten am Ufer. Zum Ablesen über das Diagramm streichen.
      </Note>
    </Section>
  )
}
