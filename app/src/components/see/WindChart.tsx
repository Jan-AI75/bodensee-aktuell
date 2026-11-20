/* Wind und Wetter stündlich, 48 Stunden, wie im Boot-Cockpit: oben die Wind- und Böenkurve mit den Bändern
   für Starkwind und Sturm, darunter ohne Bruch die Stundenspalten. Jeder Kurvenpunkt steht über seiner Stunde,
   beides scrollt gemeinsam. Die Warngrenzen am Bodensee beziehen sich auf Böen:
   Starkwind ab 25 kn (46 km/h), Sturm ab 34 kn (63 km/h). */
import { useMemo } from "react"
import type { Forecast } from "@/lib/types"
import { cn } from "@/lib/utils"
import { fmtC, fmtT, isNight, wxKind } from "@/lib/model"
import { Legend } from "./Chart"
import { Note, Section, StatePill, WeatherIcon, WindArrow } from "./bits"

export const GALE = 46, STORM = 63
const HOURS = 48
const COL = 64          // Breite einer Stundenspalte in px
const CH = 168, PT = 12, PB = 8 // Höhe der Kurve und Innenabstände
const kn = (v: number) => Math.round(v / 1.852)
const level = (g: number) => (g >= STORM ? 2 : g >= GALE ? 1 : 0)
const GUST_TXT = ["text-muted-foreground", "font-semibold text-gale", "font-semibold text-storm"]

export function WindHours({ p, area }: { p: Forecast; area: string }) {
  const H = p.hourly, Dd = p.daily
  const c = useMemo(() => {
    const nowH = p.current.time.slice(0, 13)
    let i0 = H.time.findIndex((t) => t.slice(0, 13) >= nowH); if (i0 < 0) i0 = 0
    const idx = Array.from({ length: Math.min(HOURS + 1, H.time.length - i0) }, (_, k) => i0 + k)
    const gust = idx.map((i) => H.wind_gusts_10m[i]), wind = idx.map((i) => H.wind_speed_10m[i])
    const hi = Math.max(80, Math.ceil((Math.max(...gust) + 6) / 10) * 10)
    let pk = 0; gust.forEach((g, k) => { if (g > gust[pk]) pk = k })
    return { idx, gust, wind, hi, pk }
  }, [H, p.current.time])

  const W = c.idx.length * COL
  const x = (k: number) => (k + 0.5) * COL
  const y = (v: number) => PT + (1 - Math.min(v, c.hi) / c.hi) * (CH - PT - PB)
  const line = (a: number[]) => a.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)} ${y(v).toFixed(1)}`).join("")
  const area0 = `${line(c.wind)}L${x(c.wind.length - 1)} ${CH - PB}L${x(0)} ${CH - PB}Z`
  const grid: number[] = []; for (let v = 20; v < c.hi; v += 20) grid.push(v)
  const midnights = c.idx.map((i, k) => (k > 0 && H.time[i].slice(11, 13) === "00" ? k : -1)).filter((k) => k > 0)

  const pkG = c.gust[c.pk], pkLv = level(pkG), pkD = new Date(H.time[c.idx[c.pk]])

  return (
    <Section title="Wind und Wetter" id="x-wind" area="w" aside={`48 Stunden, ${area}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4 pb-1">
        {pkLv === 2 ? <StatePill tone="storm">Böen im Sturmbereich</StatePill>
          : pkLv === 1 ? <StatePill tone="gale">Böen im Starkwindbereich</StatePill>
            : <StatePill tone="ok">Böen unter der Starkwindgrenze</StatePill>}
        <span className="text-caption text-muted-foreground">
          Höchste Böen <b className="font-semibold text-foreground">{Math.round(pkG)} km/h ({kn(pkG)} kn)</b>,{" "}
          {pkD.toLocaleDateString("de-DE", { weekday: "long" })} {fmtT(pkD)} Uhr
        </span>
      </div>

      <div className="relative">
        {/* Achse bleibt beim Scrollen stehen */}
        <div aria-hidden className="pointer-events-none absolute top-0 left-0 z-10 w-9 bg-linear-to-r from-card via-card/85 to-transparent" style={{ height: CH }}>
          {grid.map((v) => <span key={v} className="absolute left-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ top: y(v) }}>{v}</span>)}
        </div>
        <div className="no-scrollbar overflow-x-auto overscroll-x-contain" tabIndex={0}
          aria-label="Wind und Wetter der nächsten 48 Stunden, waagerecht scrollbar">
          <div style={{ width: W }}>
            <svg width={W} height={CH} role="img" aria-label="Wind und Böen der nächsten 48 Stunden mit Starkwind- und Sturmbereich" className="block">
              <rect x={0} y={y(STORM)} width={W} height={y(GALE) - y(STORM)} fill="color-mix(in srgb, var(--gale) 14%, transparent)" />
              <rect x={0} y={y(c.hi)} width={W} height={y(STORM) - y(c.hi)} fill="color-mix(in srgb, var(--storm) 12%, transparent)" />
              <line x1={0} x2={W} y1={y(GALE)} y2={y(GALE)} stroke="var(--gale)" strokeDasharray="2 4" opacity={0.8} />
              <line x1={0} x2={W} y1={y(STORM)} y2={y(STORM)} stroke="var(--storm)" strokeDasharray="2 4" opacity={0.8} />
              {[0, ...midnights].map((k) => (
                <g key={k} className="text-[11px] font-semibold">
                  <text x={k * COL + 40} y={y(GALE) - 6} fill="var(--gale)">Starkwind</text>
                  <text x={k * COL + 40} y={y(STORM) - 6} fill="var(--storm)">Sturm</text>
                </g>
              ))}
              {grid.map((v) => <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--border)" />)}
              {midnights.map((k) => <line key={k} x1={k * COL} x2={k * COL} y1={0} y2={CH} stroke="var(--muted-foreground)" strokeDasharray="2 3" opacity={0.5} />)}
              <path d={area0} fill="var(--lake-soft)" />
              <path d={line(c.gust)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.75} strokeDasharray="5 4" strokeLinejoin="round" />
              <path d={line(c.wind)} fill="none" stroke="var(--lake)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {c.gust.map((g, k) => level(g) > 0 && (
                <circle key={k} cx={x(k)} cy={y(g)} r={3} fill={level(g) === 2 ? "var(--storm)" : "var(--gale)"} />
              ))}
            </svg>

            <ol className="flex">
              {c.idx.map((i, k) => {
                const t = H.time[i], r = H.precipitation[i], g = H.wind_gusts_10m[i], now = k === 0
                const midnight = k > 0 && t.slice(11, 13) === "00"
                return (
                  <li key={t} style={{ width: COL }}
                    className={cn("grid shrink-0 justify-items-center gap-1.5 rounded-2xl py-3 tabular-nums", now && "bg-accent",
                      midnight && "rounded-none border-l border-dashed border-muted-foreground/40")}>
                    <span className={cn("text-caption", now ? "font-semibold text-accent-foreground" : midnight ? "font-semibold" : "text-muted-foreground")}>
                      {now ? "Jetzt" : midnight ? new Date(t).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "") : `${t.slice(11, 13)} Uhr`}
                    </span>
                    <WeatherIcon kind={wxKind(H.weather_code[i])} night={isNight(t, Dd)} className="size-6" />
                    <span className="text-headline font-semibold">{Math.round(H.temperature_2m[i])}°</span>
                    <span className="flex items-center gap-0.5 text-caption"><WindArrow deg={H.wind_direction_10m[i]} className="size-3 text-lake" />{Math.round(H.wind_speed_10m[i])}</span>
                    <span className={cn("text-[0.6875rem]", GUST_TXT[level(g)])}>Böen {Math.round(g)}</span>
                    <span className="min-h-4 text-[0.6875rem] font-medium text-lake">{r >= 0.1 ? `${fmtC(r)} mm` : ""}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>

      <div className="px-5 pt-1 pb-4">
        <Legend items={[
          { color: "var(--lake)", label: "Wind" },
          { color: "var(--muted-foreground)", label: "Böen", kind: "dash" },
          { color: "color-mix(in srgb, var(--gale) 35%, transparent)", label: "Starkwind, Böen ab 25 kn (46 km/h)", kind: "box" },
          { color: "color-mix(in srgb, var(--storm) 35%, transparent)", label: "Sturm, Böen ab 34 kn (63 km/h)", kind: "box" },
        ]} />
      </div>
      <Note>
        Wind und Böen in km/h über dem See, Temperatur und Regen am Ufer. Die Bänder zeigen die Grenzen der Starkwind- und
        Sturmwarnung am Bodensee, sie sind keine Warnung. Verbindlich sind allein die Warnleuchten am Ufer.
      </Note>
    </Section>
  )
}
