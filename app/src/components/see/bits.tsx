/* Wiederverwendete Bausteine: Abschnitt, Vergleichsliste, Ausblickzeile, Zustand, Wetter-Icon, Windpfeil. */
import type { ReactNode } from "react"
import {
  ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain,
  CloudSnow, CloudSun, Moon, Sun,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CompareRow, Kind } from "@/lib/model"
import { wxText } from "@/lib/model"
import { toneClass, type Tone } from "@/lib/tone"

/** Abschnitt im iOS-Stil: Überschrift über der Fläche, Inhalt auf der Fläche. */
export function Section({ title, aside, children, className, id, area }: {
  title: string; aside?: ReactNode; children: ReactNode; className?: string; id?: string
  /** Platz im Raster ab 1024 px, siehe .view-grid in index.css */
  area?: string
}) {
  return (
    <section aria-labelledby={id} data-area={area} id={id ? id + "-section" : undefined} className={cn("flex min-w-0 scroll-mt-6 flex-col", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 id={id} className="font-heading text-headline font-semibold tracking-[-0.015em]">{title}</h2>
        {aside && <span className="shrink-0 text-right text-caption text-muted-foreground">{aside}</span>}
      </div>
      <div className="surface flex flex-1 flex-col overflow-hidden [&>*:last-child:not(:first-child)]:mt-auto">{children}</div>
    </section>
  )
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("border-t px-5 py-3.5 text-caption text-muted-foreground", className)}>{children}</p>
}

/** Vergleich mit gestern, Vorwoche, Vormonat, Vorjahr und Mittel */
export function CompareList({ rows, fmt, fmtDelta, tone, unit }: {
  rows: CompareRow[]; fmt: (v: number) => string; fmtDelta: (v: number) => string; tone: Tone; unit: string
}) {
  return (
    <ul className="hairline">
      {rows.map((r) => (
        <li key={r.label} className={cn("grid grid-cols-[minmax(0,1fr)_auto_4.75rem] items-center gap-3 px-5 py-3", r.mean && "bg-band")}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium">
              {r.mean && <i aria-hidden className="h-0.5 w-3 shrink-0 rounded-full bg-mean" />}
              {r.label}
            </div>
            <div className="truncate text-caption text-muted-foreground">{r.sub}</div>
          </div>
          <div className="text-caption text-muted-foreground tabular-nums">{fmt(r.value)} {unit}</div>
          <div className={cn("text-right text-headline font-semibold tabular-nums", toneClass(r.delta, tone))}
            aria-label={`Unterschied ${fmtDelta(r.delta)} ${unit}`}>
            {fmtDelta(r.delta)}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Pfeil für eine Tendenz: steigt, fällt, gleich */
export function TrendIcon({ d, className }: { d: number; className?: string }) {
  const I = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : ArrowRight
  return <I aria-hidden className={cn("size-4 shrink-0", className)} strokeWidth={2.25} />
}

/** Zeile im Ausblick: Symbol, Text mit Erklärung, Wert mit Zusatz */
export function OutlookRow({ icon, title, sub, value, note, valueClass }: {
  icon: ReactNode; title: string; sub: string; value: string; note?: string; valueClass?: string
}) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
      <span className="grid size-8 place-items-center rounded-full bg-fill text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-caption text-muted-foreground">{sub}</div>
      </div>
      <div className="text-right tabular-nums">
        <div className={cn("font-semibold whitespace-nowrap", valueClass)}>{value}</div>
        {note && <div className="text-caption whitespace-nowrap text-muted-foreground">{note}</div>}
      </div>
    </li>
  )
}

/** Zustand als ruhige Pille */
export function StatePill({ tone, children }: { tone: "ok" | "low" | "warm" | "cool" | "gale" | "storm"; children: ReactNode }) {
  const c = {
    ok: "bg-up/12 text-up", low: "bg-down/12 text-down", warm: "bg-warm/12 text-warm", cool: "bg-cool/12 text-cool",
    gale: "bg-gale/14 text-gale", storm: "bg-storm/14 text-storm",
  }[tone]
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold", c)}>{children}</span>
}

const ICONS = {
  clear: [Sun, Moon], partly: [CloudSun, CloudMoon], cloud: [Cloud, Cloud], fog: [CloudFog, CloudFog],
  drizzle: [CloudDrizzle, CloudDrizzle], rain: [CloudRain, CloudRain], snow: [CloudSnow, CloudSnow], storm: [CloudLightning, CloudLightning],
} as const
const TONE: Record<Kind, string> = {
  clear: "text-warm", partly: "text-warm", cloud: "text-muted-foreground", fog: "text-muted-foreground",
  drizzle: "text-lake", rain: "text-lake", snow: "text-lake", storm: "text-gale",
}
export function WeatherIcon({ kind, code, night, className, label }: { kind: Kind; code?: number; night?: boolean; className?: string; label?: boolean }) {
  const I = ICONS[kind][night ? 1 : 0]
  return <I className={cn("size-6 shrink-0", night && (kind === "clear" || kind === "partly") ? "text-muted-foreground" : TONE[kind], className)}
    strokeWidth={1.75} aria-hidden={!label} aria-label={label && code != null ? wxText(code) : undefined} role={label ? "img" : undefined} />
}

/** Windpfeil: zeigt, wohin der Wind weht (Richtung „aus“ + 180°) */
export function WindArrow({ deg, className }: { deg: number; className?: string }) {
  return <ArrowDown aria-hidden className={cn("size-3.5 shrink-0", className)} strokeWidth={2.25} style={{ transform: `rotate(${deg}deg)` }} />
}

export type Fact = { label: string; value: ReactNode; note?: string }
/** Kopf einer Ansicht: Instrument, großer Messwert, Zustand, rechts zwei Kennzahlen */
export function Hero({ visual, value, unit, sub, pill, facts, place }: {
  visual: ReactNode; value: string; unit: string; sub: ReactNode; pill?: ReactNode; place: string; facts: (Fact | null | false)[]
}) {
  const F = facts.filter(Boolean) as Fact[]
  return (
    <section data-area="hero" aria-label={place} className="surface flex items-center gap-4 p-5 sm:gap-7 sm:p-7">
      {visual}
      <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="text-caption text-muted-foreground">{place}</div>
          <div className="mt-1 font-heading text-[3.5rem] leading-[0.95] font-semibold tracking-[-0.045em] tabular-nums sm:text-display">
            {value}<span className="ml-1.5 text-title font-medium tracking-[-0.01em] text-muted-foreground">{unit}</span>
          </div>
          <div className="mt-2 text-body text-muted-foreground">{sub}</div>
          {pill && <div className="mt-3">{pill}</div>}
        </div>
        {F.length > 0 && (
          <dl className="grid grid-cols-2 gap-3 border-t pt-3 md:grid-cols-none md:auto-cols-fr md:grid-flow-col md:gap-0 md:border-t-0 md:pt-0 md:[&>*+*]:border-l">
            {F.map((f) => (
              <div key={f.label} className="min-w-0 md:px-6 md:last:pr-0">
                <dt className="text-caption text-muted-foreground">{f.label}</dt>
                <dd className="text-headline font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums sm:text-title">{f.value}</dd>
                {f.note && <dd className="text-caption text-muted-foreground">{f.note}</dd>}
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}
