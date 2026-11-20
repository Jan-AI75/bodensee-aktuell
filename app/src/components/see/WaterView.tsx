/* Wasserstand am Pegel Konstanz: aktueller Stand, Vergleiche, Ausblick, 30-Tage-Verlauf, Jahresgang. */
import { useCallback, useMemo } from "react"
import { Umbrella } from "lucide-react"
import type { LakeData, Pt, WaterHist } from "@/lib/types"
import {
  DAY, MNW, dayStart, doy, fmtC, fmtD, fmtT, fmtWd, histAt, inDays, meanFor, rainText, sgn, waterModel, type LakeForecast,
} from "@/lib/model"
import { Chart, Legend, type Layer, type Probe } from "./Chart"
import { CompareList, Hero, Note, OutlookRow, Section, StatePill, TrendIcon } from "./bits"
import { toneClass } from "@/lib/tone"
import { Staff } from "./Gauge"

const cmF = (v: number) => String(Math.round(v))

export function WaterView({ D }: { D: LakeData }) {
  const series = D.water!.series
  const W = useMemo(() => waterModel(series, D.hist, D.outlook), [series, D.hist, D.outlook])
  const { cur, meanToday, fc } = W
  const fd = fc ? fc.end.v - cur : 0
  return (
    <div className="view-grid grid gap-x-5 gap-y-6">
      <Hero place="Pegel Konstanz" value={cmF(cur)} unit="cm" sub={W.nhn}
        visual={<Staff cur={cur} mean={meanToday} fc={fc ? fc.end.v : null} />}
        pill={W.low
          ? <StatePill tone="low">Niedrigwasser, {Math.round(MNW - cur)} cm unter MNW</StatePill>
          : <StatePill tone="ok">Im üblichen Bereich</StatePill>}
        facts={[
          { label: "Zum Mittel", value: <span className={toneClass(cur - meanToday, "level")}>{sgn(cur - meanToday)} cm</span>, note: `Mittel ${cmF(meanToday)} cm` },
          !!fc && {
            label: "Prognose",
            value: <span className={`inline-flex items-center gap-1 ${toneClass(fd, "level")}`}><TrendIcon d={Math.round(fd)} className="size-5" />{cmF(fc.end.v)} cm</span>,
            note: `${fmtWd(new Date(fc.end.t))}, ${inDays(fc.end.t)}`,
          },
        ]} />

      <Section title="Vergleich" id="w-cmp" area="a" aside="Unterschied zu heute">
        <CompareList rows={W.rows} fmt={cmF} fmtDelta={sgn} tone="level" unit="cm" />
      </Section>

      {(fc || W.trend != null || W.wx) && (
        <Section title="Ausblick" id="w-out" area="b">
          <ul className="hairline">
            {fc && (() => {
              const a = Math.round(Math.min(fc.rLo.v, fc.rHi.v)), b = Math.round(Math.max(fc.rLo.v, fc.rHi.v))
              return <OutlookRow icon={<TrendIcon d={Math.round(fd)} />} title={`Vorhersage bis ${fmtWd(new Date(fc.end.t))}`}
                sub={a === b ? "alle Modellläufe einig" : `Modellläufe zwischen ${a} und ${b} cm`}
                value={`${cmF(fc.end.v)} cm`} note={`${sgn(fd)} cm`} valueClass={toneClass(fd, "level")} />
            })()}
            {W.trend != null && (() => {
              const w = W.trend, flat = Math.abs(w) < 1.5
              return <OutlookRow icon={<TrendIcon d={flat ? 0 : Math.sign(w)} />} title="Trend letzte 7 Tage"
                sub={flat ? "nahezu unverändert" : w > 0 ? "steigend" : "fallend"}
                value={`${sgn(w)} cm`} note="pro Woche" valueClass={toneClass(w, "level")} />
            })()}
            {W.wx && (() => {
              const mm = W.wx.precip, { t, sub } = rainText(mm, W.wx.snow)
              return <OutlookRow icon={<Umbrella className="size-4" />} title={`${t} im Einzugsgebiet`} sub={sub} value={`${fmtC(mm)} mm`} note="7 Tage" />
            })()}
          </ul>
          <Note>
            Vorhersage: amtliches Ensemble des BAFU für den Pegel Romanshorn, als Veränderung auf Konstanz übertragen.
            Regen: Summe der nächsten 7 Tage, gemittelt über Alpenrhein, Montafon, Prättigau und Bodenseeraum (Open-Meteo).
          </Note>
        </Section>
      )}

      <Section title="Letzte 30 Tage" id="w-30" area="c" aside="Stundenwerte">
        <div className="px-3 pt-4 pb-1 sm:px-4"><Water30 series={series} fc={fc} /></div>
        <div className="px-5 pb-4">
          <Legend items={[
            { color: "var(--lake)", label: "Gemessen" },
            { color: "var(--mean)", label: "Mittel", kind: "dash" },
            ...(fc ? [{ color: "var(--lake-soft)", label: "Vorhersage, mittlere Hälfte", kind: "box" as const }] : []),
          ]} />
        </div>
        <Note>Gestrichelt das mittlere Niveau zum gleichen Datum. Rechts der senkrechten Linie die Vorhersage. Zum Ablesen über das Diagramm streichen.</Note>
      </Section>

      <Section title="Jahresgang" id="w-year" area="d" aside="Lage von heute im Jahr">
        <div className="px-3 pt-4 pb-1 sm:px-4"><WaterYear series={series} hist={D.hist} cur={cur} meanToday={meanToday} now={W.now} /></div>
        <div className="px-5 pb-4">
          <Legend items={[
            { color: "var(--lake)", label: String(W.now.getFullYear()) },
            { color: "var(--mean)", label: "Mittel" },
            { color: "var(--down)", label: "MNW, übliches Jahresminimum", kind: "dash" },
          ]} />
        </div>
        <Note>Der Punkt markiert heute, die Zahl daneben den Abstand zum langjährigen Mittel.</Note>
      </Section>
    </div>
  )
}

/** Binäre Suche nach dem nächsten Punkt */
function near(pts: Pt[], t: number) {
  if (!pts.length) return null
  let a = 0, b = pts.length - 1
  while (b - a > 1) { const m = (a + b) >> 1; if (pts[m].t < t) a = m; else b = m }
  return Math.abs(pts[a].t - t) <= Math.abs(pts[b].t - t) ? pts[a] : pts[b]
}

function Water30({ series, fc }: { series: Pt[]; fc: LakeForecast | null }) {
  const c = useMemo(() => {
    const tNow = series.at(-1)!.t, tStart = tNow - 30 * DAY
    const pts: Pt[] = []; let lastH = -1
    for (const p of series) { if (p.t < tStart) continue; const h = Math.floor(p.t / 3600e3); if (h !== lastH) { pts.push(p); lastH = h } }
    if (pts.at(-1) !== series.at(-1)) pts.push(series.at(-1)!)
    if (pts.length < 2) return null
    const tEnd = fc ? Math.max(tNow, fc.end.t) : tNow
    const means: Pt[] = []
    for (let t = pts[0].t; t <= tEnd; t += DAY / 2) means.push({ t, v: meanFor(new Date(t)) })
    means.push({ t: tEnd, v: meanFor(new Date(tEnd)) })
    let all = pts.map((p) => p.v).concat(means.map((m) => m.v))
    if (fc) all = all.concat(fc.lo.map((p) => p.v), fc.hi.map((p) => p.v))
    const lo = Math.floor((Math.min(...all) - 6) / 10) * 10, hi = Math.ceil((Math.max(...all) + 6) / 10) * 10
    const t0 = pts[0].t
    const layers: Layer[] = [
      { kind: "area", pts, color: "var(--lake-soft)" },
      { kind: "line", pts: means, color: "var(--mean)", width: 1.75, dash: "5 4" },
    ]
    if (fc) {
      layers.push({ kind: "vline", t: tNow })
      if (fc.hi.length > 1) layers.push({ kind: "band", hi: fc.hi, lo: fc.lo, color: "var(--lake)", opacity: 0.2 })
      layers.push({ kind: "line", pts: fc.med, color: "var(--lake)", width: 2, dash: "4 4" })
    }
    layers.push({ kind: "line", pts, color: "var(--lake)", width: 2.25 })
    layers.push({ kind: "dot", t: tNow, v: pts.at(-1)!.v, color: "var(--lake)" })
    const xTicks = [0, 1, 2, 3, 4].map((i) => { const t = t0 + ((tEnd - t0) * i) / 4; return { t, label: fmtD(new Date(t)) } })
    return { t0, tEnd, tNow, lo, hi, layers, xTicks, pts, means }
  }, [series, fc])

  const probe = useCallback((t: number): Probe | null => {
    if (!c) return null
    const m = near(c.means, t)
    if (t > c.tNow && fc) {
      const q = near(fc.med, t); if (!q) return null
      const items = [{ color: "var(--lake)", label: "Vorhersage", value: `${cmF(q.v)} cm`, v: q.v }]
      if (m) items.push({ color: "var(--mean)", label: "Mittel", value: `${cmF(meanFor(new Date(q.t)))} cm`, v: meanFor(new Date(q.t)) })
      return { t: q.t, title: fmtWd(new Date(q.t)), items }
    }
    const p = near(c.pts, t); if (!p) return null
    const mv = meanFor(new Date(p.t))
    return {
      t: p.t, title: `${fmtWd(new Date(p.t))}, ${fmtT(new Date(p.t))} Uhr`,
      items: [
        { color: "var(--lake)", label: "Gemessen", value: `${cmF(p.v)} cm`, v: p.v },
        { color: "var(--mean)", label: "Mittel", value: `${cmF(mv)} cm`, v: mv },
      ],
    }
  }, [c, fc])

  if (!c) return <div className="grid h-[210px] place-items-center text-caption text-muted-foreground">Zu wenige Messwerte für den Verlauf</div>
  return <Chart t0={c.t0} t1={c.tEnd} lo={c.lo} hi={c.hi} step={c.hi - c.lo > 80 ? 20 : 10} xTicks={c.xTicks} layers={c.layers}
    probe={probe} keyStep={6 * 3600e3} label="Wasserstand der letzten 30 Tage mit Mittel und Vorhersage" />
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]

function WaterYear({ series, hist, cur, meanToday, now }: { series: Pt[]; hist: WaterHist | null; cur: number; meanToday: number; now: Date }) {
  const y = now.getFullYear(), lo = 220, hi = 440
  const c = useMemo(() => {
    const clamp = (v: number) => Math.max(lo, Math.min(hi, v))
    const mean: Pt[] = []; for (let t = 0; t <= 364; t += 3) mean.push({ t, v: meanFor(new Date(y, 0, 1 + t)) })
    const byDay = new Map<number, number>()
    for (let t = 0; t <= doy(now); t++) { const v = histAt(hist, new Date(y, 0, 1 + t)); if (v != null) byDay.set(t, v) }
    for (const p of series) { const dt = new Date(p.t); if (dt.getFullYear() === y) byDay.set(doy(dt), p.v) }
    const ist: { t: number; v: number | null }[] = []
    for (let t = 0; t <= doy(now); t++) { const v = byDay.get(t); ist.push({ t, v: v == null ? null : clamp(v) }) }
    const tx = doy(now)
    const layers: Layer[] = [
      { kind: "line", pts: mean, color: "var(--mean)", width: 2 },
      { kind: "hline", v: MNW, color: "var(--down)", label: `MNW ${MNW}` },
      { kind: "line", pts: ist, color: "var(--lake)", width: 2.5 },
      { kind: "line", pts: [{ t: tx, v: clamp(meanToday) }, { t: tx, v: clamp(cur) }], color: "var(--muted-foreground)", width: 1 },
      { kind: "dot", t: tx, v: clamp(meanToday), color: "var(--mean)", r: 3.5 },
      { kind: "dot", t: tx, v: clamp(cur), color: "var(--lake)" },
      { kind: "label", t: tx, v: (clamp(cur) + clamp(meanToday)) / 2 + 4, text: `${sgn(cur - meanToday)} cm` },
    ]
    const xTicks = MONTHS.map((label, i) => ({ t: doy(new Date(y, i, 15)), label }))
    return { layers, xTicks, byDay }
  }, [series, hist, cur, meanToday, now, y])

  const probe = useCallback((t: number): Probe => {
    const d = Math.round(t), date = new Date(y, 0, 1 + d), mv = meanFor(date)
    const v = c.byDay.get(d)
    const items = [{ color: "var(--mean)", label: "Mittel", value: `${cmF(mv)} cm`, v: Math.max(lo, Math.min(hi, mv)) }]
    if (v != null) items.unshift({ color: "var(--lake)", label: String(y), value: `${cmF(v)} cm`, v: Math.max(lo, Math.min(hi, v)) })
    return { t: d, title: dayStart(date).toLocaleDateString("de-DE", { day: "numeric", month: "long" }), items }
  }, [c, y])

  return <Chart t0={0} t1={364} lo={lo} hi={hi} step={40} xTicks={c.xTicks} layers={c.layers} probe={probe} keyStep={7}
    label="Jahresgang des Wasserstands: mittlerer Verlauf, dieses Jahr und MNW" />
}
