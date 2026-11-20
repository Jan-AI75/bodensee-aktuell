/* Wassertemperatur, Messstelle Lindau: aktueller Wert, Vergleiche, Abschätzung, 30 Tage, Jahresgang. */
import { useCallback, useMemo } from "react"
import { Sun } from "lucide-react"
import type { LakeData } from "@/lib/types"
import { addDays, doy, fmtC, fmtD, fmtT, fmtWd, inDays, sgnC, tempSummary, type Climo, type TempModel } from "@/lib/model"
import { Chart, Legend, type Layer, type Probe } from "./Chart"
import { CompareList, Hero, Note, OutlookRow, Section, StatePill, TrendIcon } from "./bits"
import { toneClass } from "@/lib/tone"
import { Thermo } from "./Gauge"

export function TempView({ D }: { D: LakeData }) {
  const j = D.temp!.j
  const S = useMemo(() => tempSummary(j, D.outlook), [j, D.outlook])
  const { cur, c, end, proj, m, today } = S
  const dd = c ? cur - c.mean : 0
  const fd = end ? end.v - cur : 0
  return (
    <div className="view-grid grid gap-x-5 gap-y-6">
      <Hero place="Messstelle Lindau" value={fmtC(cur)} unit="°C"
        sub={S.todayMean != null ? `Tagesmittel heute ${fmtC(S.todayMean)} °C` : `Messung ${fmtT(S.now)} Uhr`}
        visual={<Thermo cur={cur} mean={c ? c.mean : null} fc={end ? end.v : null} />}
        pill={c && (dd > 1 ? <StatePill tone="warm">Wärmer als üblich, {sgnC(dd)} °C</StatePill>
          : dd < -1 ? <StatePill tone="cool">Kühler als üblich, {sgnC(dd)} °C</StatePill>
            : <StatePill tone="ok">Im üblichen Bereich</StatePill>)}
        facts={[
          !!c && { label: "Zum Mittel", value: <span className={toneClass(dd, "temp")}>{sgnC(dd)} °C</span>, note: `Mittel ${fmtC(c.mean)} °C` },
          !!end && {
            label: "Abschätzung",
            value: <span className={`inline-flex items-center gap-1 ${toneClass(fd, "temp")}`}><TrendIcon d={Math.sign(Math.round(fd * 10))} className="size-5" />{fmtC(end.v)} °C</span>,
            note: `${fmtWd(new Date(end.t))}, ${inDays(end.t)}`,
          },
        ]} />

      <Section title="Vergleich" id="t-cmp" area="a" aside="Unterschied zu jetzt">
        <CompareList rows={S.rows} fmt={fmtC} fmtDelta={sgnC} tone="temp" unit="°C" />
      </Section>

      {(proj || S.trend != null || S.wx) && (
        <Section title="Ausblick" id="t-out" area="b">
          <ul className="hairline">
            {end && <OutlookRow icon={<TrendIcon d={Math.sign(Math.round(fd * 10))} />} title={`Abschätzung bis ${fmtWd(new Date(end.t))}`}
              sub="grob, aus der Lufttemperatur" value={`${fmtC(end.v)} °C`} note={`${sgnC(fd)} °C`} valueClass={toneClass(fd, "temp")} />}
            {S.trend != null && (() => {
              const sl = S.trend, flat = Math.abs(sl) < 0.05
              return <OutlookRow icon={<TrendIcon d={flat ? 0 : Math.sign(sl)} />} title="Trend letzte 7 Tage"
                sub={flat ? "nahezu unverändert" : sl > 0 ? "erwärmt sich" : "kühlt ab"}
                value={`${sgnC(sl)} °C`} note="pro Tag" valueClass={toneClass(sl, "temp")} />
            })()}
            {S.wx && (() => {
              const diff = S.wx.airMean - cur
              return <OutlookRow icon={<Sun className="size-4" />} title="Luft in Lindau"
                sub={`nächste 7 Tage, ${diff < -2 ? "deutlich kühler als der See, er kühlt weiter ab" : diff > 2 ? "wärmer als der See, er erwärmt sich eher" : "ähnlich wie der See"}`}
                value={`${fmtC(S.wx.airMean)} °C`} note="Mittel" />
            })()}
          </ul>
          <Note>
            Die Abschätzung nähert die Wassertemperatur Tag für Tag der vorhergesagten Lufttemperatur an. Wie schnell, ist aus den
            letzten 30 Tagen bestimmt. Wind und Sonne fehlen darin, daher nur als Richtung verstehen.
          </Note>
        </Section>
      )}

      <Section title="Letzte 30 Tage" id="t-30" area="c" aside="Tagesmittel">
        <div className="px-3 pt-4 pb-1 sm:px-4"><Temp30 m={m} today={today} cur={cur} proj={proj} /></div>
        <div className="px-5 pb-4">
          <Legend items={[
            { color: "var(--warm)", label: String(m.year) },
            { color: "var(--mean)", label: `Mittel ${m.firstYear}–${m.year - 1}`, kind: "dash" },
            { color: "var(--band)", label: "Spanne der Jahre", kind: "box" },
          ]} />
        </div>
        <Note>Die Fläche reicht vom kältesten bis zum wärmsten Jahr. Rechts der senkrechten Linie die Abschätzung.</Note>
      </Section>

      <Section title="Jahresgang" id="t-year" area="d" aside="Mittel, Spanne und dieses Jahr">
        <div className="px-3 pt-4 pb-1 sm:px-4"><TempYear m={m} today={today} cur={cur} c={c} /></div>
        <div className="px-5 pb-4">
          <Legend items={[
            { color: "var(--warm)", label: String(m.year) },
            { color: "var(--mean)", label: `Mittel ${m.firstYear}–${m.year - 1}` },
            { color: "var(--band)", label: "Spanne", kind: "box" },
          ]} />
        </div>
        <Note>Der Punkt markiert heute, die Zahl daneben den Abstand zum Mittel der Messjahre.</Note>
      </Section>
    </div>
  )
}

type Proj = { pts: { n: number; v: number }[] } | null

function Temp30({ m, today, cur, proj }: { m: TempModel; today: Date; cur: number; proj: Proj }) {
  const c = useMemo(() => {
    const ahead = proj ? proj.pts.at(-1)!.n : 0
    const days: Date[] = []; for (let n = -30; n <= ahead; n++) days.push(addDays(today, n))
    const T = (d: Date) => d.getTime()
    const obs = days.slice(0, 31).map((d, i) => ({ t: T(d), v: i === 30 ? (m.at(d) ?? cur) : m.at(d) }))
    const cl = days.map((d) => ({ t: T(d), c: m.climo(d) }))
    let all = obs.filter((o) => o.v != null).map((o) => o.v as number).concat(cl.filter((x) => x.c).flatMap((x) => [x.c!.min, x.c!.max]), [cur])
    if (proj) all = all.concat(proj.pts.map((p) => p.v))
    const lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1)
    const hasC = cl.filter((x) => x.c)
    const pj = proj ? proj.pts.map((p) => ({ t: T(addDays(today, p.n)), v: p.v })) : []
    const layers: Layer[] = [
      { kind: "band", hi: hasC.map((x) => ({ t: x.t, v: x.c!.max })), lo: hasC.map((x) => ({ t: x.t, v: x.c!.min })), color: "var(--band)" },
      { kind: "line", pts: hasC.map((x) => ({ t: x.t, v: x.c!.mean })), color: "var(--mean)", width: 1.75, dash: "5 4" },
    ]
    if (proj) {
      layers.push({ kind: "vline", t: T(today) })
      layers.push({ kind: "line", pts: pj, color: "var(--warm)", width: 2, dash: "4 4" })
    }
    layers.push({ kind: "line", pts: obs, color: "var(--warm)", width: 2.25 })
    layers.push({ kind: "dot", t: T(today), v: cur, color: "var(--warm)" })
    const N = days.length - 1
    const xTicks = [0, 1, 2, 3, 4].map((k) => { const d = days[Math.round((N * k) / 4)]; return { t: T(d), label: fmtD(d) } })
    return { t0: T(days[0]), t1: T(days.at(-1)!), lo, hi, layers, xTicks, obs, cl, pj }
  }, [m, today, cur, proj])

  const probe = useCallback((t: number): Probe | null => {
    const i = Math.round((t - c.t0) / 864e5)
    const x = c.cl[i]; if (!x) return null
    const items: Probe["items"] = []
    const o = c.obs[i], p = c.pj.find((q) => Math.abs(q.t - x.t) < 3600e3 * 2)
    if (o && o.v != null) items.push({ color: "var(--warm)", label: "Gemessen", value: `${fmtC(o.v)} °C`, v: o.v })
    else if (p) items.push({ color: "var(--warm)", label: "Abschätzung", value: `${fmtC(p.v)} °C`, v: p.v })
    if (x.c) items.push({ color: "var(--mean)", label: "Mittel", value: `${fmtC(x.c.mean)} °C`, v: x.c.mean })
    if (!items.length) return null
    return { t: x.t, title: fmtWd(new Date(x.t)), items }
  }, [c])

  return <Chart t0={c.t0} t1={c.t1} lo={c.lo} hi={c.hi} step={c.hi - c.lo > 12 ? 4 : 2} yFmt={(v) => v + "°"}
    xTicks={c.xTicks} layers={c.layers} probe={probe} keyStep={864e5} label="Wassertemperatur der letzten 30 Tage mit Mittel und Spanne" />
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]

function TempYear({ m, today, cur, c: cToday }: { m: TempModel; today: Date; cur: number; c: Climo | null }) {
  const y = m.year
  const c = useMemo(() => {
    const up: { t: number; v: number }[] = [], dn: typeof up = [], mean: typeof up = []
    for (let t = 0; t <= 364; t += 4) { const cc = m.climo(new Date(y, 0, 1 + t)); if (!cc) continue; up.push({ t, v: cc.max }); dn.push({ t, v: cc.min }); mean.push({ t, v: cc.mean }) }
    const ist: { t: number; v: number | null }[] = []
    for (let t = 0; t <= doy(today); t++) ist.push({ t, v: m.at(new Date(y, 0, 1 + t)) })
    const tx = doy(today)
    const layers: Layer[] = []
    if (up.length > 1) layers.push({ kind: "band", hi: up, lo: dn, color: "var(--band)" }, { kind: "line", pts: mean, color: "var(--mean)", width: 2 })
    layers.push({ kind: "line", pts: ist, color: "var(--warm)", width: 2.25 })
    if (cToday) layers.push({ kind: "dot", t: tx, v: cToday.mean, color: "var(--mean)", r: 3.5 })
    layers.push({ kind: "dot", t: tx, v: cur, color: "var(--warm)" })
    if (cToday) layers.push({ kind: "label", t: tx, v: Math.max(cur, cToday.mean) + 3.6, text: `${sgnC(cur - cToday.mean)} °C` })
    return { layers, xTicks: MONTHS.map((label, i) => ({ t: doy(new Date(y, i, 15)), label })) }
  }, [m, today, cur, cToday, y])

  const probe = useCallback((t: number): Probe | null => {
    const d = Math.round(t), date = new Date(y, 0, 1 + d), cc = m.climo(date), v = d <= doy(today) ? m.at(date) : null
    const items: Probe["items"] = []
    if (v != null) items.push({ color: "var(--warm)", label: String(y), value: `${fmtC(v)} °C`, v })
    if (cc) items.push({ color: "var(--mean)", label: "Mittel", value: `${fmtC(cc.mean)} °C`, v: cc.mean })
    if (!items.length) return null
    return { t: d, title: date.toLocaleDateString("de-DE", { day: "numeric", month: "long" }), items }
  }, [m, y, today])

  return <Chart t0={0} t1={364} lo={0} hi={28} step={7} yFmt={(v) => v + "°"} xTicks={c.xTicks} layers={c.layers}
    probe={probe} keyStep={7} label="Jahresgang der Wassertemperatur: Mittel, Spanne der Jahre und dieses Jahr" />
}
