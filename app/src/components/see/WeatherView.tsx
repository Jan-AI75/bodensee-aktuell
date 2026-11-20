/* Wetter für drei Seeteile: jetzt, Wind und Wetter stündlich (48 Stunden), die nächsten Tage, Starkwind- und Sturmwarnung. */
import { motion, useReducedMotion } from "motion/react"
import { ExternalLink, Wind } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LakeData, Warn } from "@/lib/types"
import {
  REGIONS, WARNAREA, WARN_KEYS, bft, dirName, fmtC, fmtD, fmtT, isNight, warnInfo, warnName, wdDay, wxKind, wxText,
} from "@/lib/model"
import { WindHours } from "./WindChart"
import { Hero, Note, Section, StatePill, WeatherIcon, WindArrow } from "./bits"

const WARN_URL = "https://www.kttg.ch/kapo/htm/stwarn.shtml"

export function WeatherView({ D, region, setRegion }: { D: LakeData; region: number; setRegion: (r: number) => void }) {
  const p = D.wx!.list[region]
  const R = REGIONS[region], c = p.current, Dd = p.daily
  const night = isNight(c.time, Dd)
  const wr = D.warn?.regions?.[R.warn]

  return (
    <div className="grid gap-6">
      <RegionPicker region={region} setRegion={setRegion} />
      <div className="view-grid grid gap-x-5 gap-y-6" data-layout="wide-a">
        <Hero place={`${R.n}, ${R.town}`} value={String(Math.round(c.temperature_2m))} unit="°C"
          sub={`${wxText(c.weather_code)}, gefühlt ${Math.round(c.apparent_temperature)} °C`}
          visual={<div className="grid size-20 shrink-0 place-items-center rounded-[22px] bg-fill sm:size-24">
            <WeatherIcon kind={wxKind(c.weather_code)} night={night} code={c.weather_code} label className="size-11 sm:size-12" />
          </div>}
          pill={wr && wr.level != null
            ? <StatePill tone={wr.level === 2 ? "storm" : wr.level === 1 ? "gale" : "ok"}>
              {wr.level === 0 ? `Keine Warnung, Warngebiet ${WARNAREA[R.warn].n}` : `${warnName(wr.level)}, Warngebiet ${WARNAREA[R.warn].n}`}
            </StatePill>
            : undefined}
          facts={[
            {
              label: `Wind aus ${dirName(c.wind_direction_10m)}`,
              value: <span className="inline-flex items-center gap-1.5"><WindArrow deg={c.wind_direction_10m} className="size-5 text-lake" />{Math.round(c.wind_speed_10m)} km/h</span>,
              note: `${bft(c.wind_speed_10m)} Bft, Böen ${Math.round(c.wind_gusts_10m)} km/h (${bft(c.wind_gusts_10m)} Bft)`,
            },
            {
              label: "Heute",
              value: <>{Math.round(Dd.temperature_2m_max[0])}°<span className="text-muted-foreground"> / {Math.round(Dd.temperature_2m_min[0])}°</span></>,
              note: Dd.precipitation_sum[0] >= 0.1 ? `${fmtC(Dd.precipitation_sum[0])} mm Regen` : "trocken",
            },
          ]} />

        <WindHours p={p} area={`${R.n}, ${R.town}`} />

        <Section title="Die nächsten Tage" id="x-days" area="c">
          <ul className="hairline">
            {Dd.time.map((t, i) => {
              const d = wdDay(t), lbl = i === 0 ? "Heute" : i === 1 ? "Morgen" : d.toLocaleDateString("de-DE", { weekday: "long" })
              const rain = Dd.precipitation_sum[i]
              return (
                <li key={t} className="grid grid-cols-[4.75rem_1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 px-5 py-3 sm:grid-cols-[6rem_1.75rem_minmax(0,1fr)_auto] sm:gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{lbl}</div>
                    <div className="text-caption text-muted-foreground">{fmtD(d)}</div>
                  </div>
                  <WeatherIcon kind={wxKind(Dd.weather_code[i])} code={Dd.weather_code[i]} label />
                  <div className="min-w-0 text-caption text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <WindArrow deg={Dd.wind_direction_10m_dominant[i]} className="size-3 text-lake" />
                      <span className="truncate">{dirName(Dd.wind_direction_10m_dominant[i])} <b className="font-semibold text-foreground">{Math.round(Dd.wind_speed_10m_max[i])}</b> km/h</span>
                    </div>
                    <div className="truncate">{bft(Dd.wind_speed_10m_max[i])}&nbsp;Bft, Böen {Math.round(Dd.wind_gusts_10m_max[i])}</div>
                  </div>
                  <div className="text-right whitespace-nowrap tabular-nums">
                    <span className="text-headline font-semibold">{Math.round(Dd.temperature_2m_max[i])}°</span>
                    <span className="text-muted-foreground"> / {Math.round(Dd.temperature_2m_min[i])}°</span>
                    <div className={cn("text-caption", rain >= 0.1 ? "text-lake" : "text-muted-foreground")}>{rain >= 0.1 ? `${fmtC(rain)} mm` : "trocken"}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>

        <WarnSection W={D.warn} active={R.warn} />
      </div>
    </div>
  )
}

/** Seeteil wählen: Segmented Control im iOS-Stil */
function RegionPicker({ region, setRegion }: { region: number; setRegion: (r: number) => void }) {
  const reduce = useReducedMotion()
  return (
    <div role="radiogroup" aria-label="Seeteil" className="grid grid-cols-3 gap-1 rounded-2xl bg-fill p-1 lg:max-w-xl">
      {REGIONS.map((r, i) => {
        const on = i === region
        return (
          <button key={r.n} type="button" role="radio" aria-checked={on} onClick={() => setRegion(i)}
            className={cn("relative flex min-h-12 flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-colors",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {on && <motion.span layoutId="region-pill" className="absolute inset-0 rounded-xl bg-card shadow-sm ring-1 ring-border"
              transition={{ type: "spring", bounce: 0.15, duration: reduce ? 0 : 0.35 }} />}
            <span className="relative text-body font-semibold">{r.n}</span>
            <span className="relative text-[0.6875rem]">{r.town}</span>
          </button>
        )
      })}
    </div>
  )
}

function WarnSection({ W, active }: { W: Warn | null; active: string }) {
  const info = warnInfo(W)
  const link = <a href={WARN_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
    Offizieller Status<ExternalLink className="size-3" /></a>
  return (
    <Section title="Starkwind- und Sturmwarnung" id="warns" area="d" aside={info ? `Stand ${fmtT(info.checked)} Uhr` : undefined}>
      {info && W ? (
        <ul className="hairline">
          {WARN_KEYS.map((k) => {
            const r = W.regions[k], a = WARNAREA[k], lv = r?.level
            const txt = warnName(lv) ?? (r?.text || "unbekannt")
            return (
              <li key={k} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3", k === active && "bg-accent/40")}>
                <div className="min-w-0">
                  <div className="font-medium">{a.n}</div>
                  <div className="text-caption text-muted-foreground">{a.d}</div>
                </div>
                {lv === 2 ? <StatePill tone="storm">{txt}</StatePill>
                  : lv === 1 ? <StatePill tone="gale">{txt}</StatePill>
                    : lv === 0 ? <StatePill tone="ok">{txt}</StatePill>
                      : <span className="rounded-full bg-fill px-2.5 py-1 text-caption font-semibold text-muted-foreground">{txt}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex items-center gap-3 px-5 py-4 text-muted-foreground"><Wind className="size-5" />Warnstatus nicht verfügbar.</div>
      )}
      <Note>
        {info && <>Stand {fmtD(info.checked)}, {fmtT(info.checked)} Uhr{info.stale ? ", möglicherweise veraltet" : ""}. </>}
        Starkwind: Böen etwa 25–33 kn (Bft 6–7), Sturm: ab 34 kn (Bft 8). Verbindlich sind allein die Warnleuchten am Ufer. {link}
      </Note>
    </Section>
  )
}
