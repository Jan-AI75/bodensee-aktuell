/* Die zwei Messinstrumente im Kopf der Ansichten: Pegellatte und Thermometer.
   Ruhig gezeichnet, Füllung in Akzentfarbe, Mittel als Schilf-Markierung, Prognose als offenes Dreieck. */
import { motion, useReducedMotion } from "motion/react"

const H = 208, TOP = 8, BOT = 196

export function Staff({ cur, mean, fc }: { cur: number; mean: number; fc: number | null }) {
  const reduce = useReducedMotion()
  const lo = 200, hi = 450
  const y = (v: number) => BOT - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (BOT - TOP)
  const ticks: number[] = []; for (let v = lo; v <= hi; v += 10) ticks.push(v)
  return (
    <svg viewBox={`0 0 72 ${H}`} className="h-[12.5rem] w-auto shrink-0 sm:h-[13rem]" role="img"
      aria-label={`Pegellatte: ${Math.round(cur)} cm, langjähriges Mittel ${Math.round(mean)} cm`}>
      <rect x={28} y={TOP} width={16} height={BOT - TOP} rx={8} fill="var(--fill)" />
      <motion.rect x={28} width={16} rx={8} fill="var(--lake)"
        initial={reduce ? false : { y: BOT, height: 0 }}
        animate={{ y: y(cur), height: BOT - y(cur) }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
      {ticks.map((v) => {
        const big = v % 50 === 0
        return (
          <g key={v}>
            <line x1={big ? 46 : 46} x2={big ? 54 : 50} y1={y(v)} y2={y(v)} stroke="var(--muted-foreground)" strokeWidth={1} opacity={big ? 0.7 : 0.35} />
            {big && <text x={22} y={y(v) + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">{v}</text>}
          </g>
        )
      })}
      <line x1={24} x2={48} y1={y(mean)} y2={y(mean)} stroke="var(--mean)" strokeWidth={2} strokeLinecap="round" />
      <text x={58} y={y(mean) + 3.5} className="fill-mean text-[10px] font-semibold">Ø</text>
      {fc != null && Math.abs(fc - cur) >= 1 && (
        <path d={`M56 ${y(fc)} l9 -5 v10z`} fill="none" stroke="var(--lake)" strokeWidth={1.5} strokeLinejoin="round" />
      )}
    </svg>
  )
}

export function Thermo({ cur, mean, fc }: { cur: number; mean: number | null; fc: number | null }) {
  const reduce = useReducedMotion()
  const lo = 0, hi = 28, bot = 172
  const y = (v: number) => bot - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (bot - TOP)
  const ticks: number[] = []; for (let v = lo; v <= hi; v += 2) ticks.push(v)
  return (
    <svg viewBox={`0 0 72 ${H}`} className="h-[12.5rem] w-auto shrink-0 sm:h-[13rem]" role="img"
      aria-label={`Thermometer: ${cur.toFixed(1).replace(".", ",")} °C`}>
      <rect x={29} y={TOP - 2} width={14} height={bot - TOP + 16} rx={7} fill="var(--fill)" />
      <circle cx={36} cy={188} r={13} fill="var(--fill)" />
      <circle cx={36} cy={188} r={9} fill="var(--warm)" />
      <motion.rect x={32} width={8} rx={4} fill="var(--warm)"
        initial={reduce ? false : { y: 186, height: 0 }}
        animate={{ y: y(cur), height: 186 - y(cur) }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
      {ticks.map((v) => {
        const big = v % 10 === 0
        return (
          <g key={v}>
            <line x1={46} x2={big ? 54 : 50} y1={y(v)} y2={y(v)} stroke="var(--muted-foreground)" strokeWidth={1} opacity={big ? 0.7 : 0.35} />
            {big && <text x={24} y={y(v) + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">{v}°</text>}
          </g>
        )
      })}
      {mean != null && (
        <>
          <line x1={24} x2={48} y1={y(mean)} y2={y(mean)} stroke="var(--mean)" strokeWidth={2} strokeLinecap="round" />
          <text x={58} y={y(mean) + 3.5} className="fill-mean text-[10px] font-semibold">Ø</text>
        </>
      )}
      {fc != null && Math.abs(fc - cur) >= 0.2 && (
        <path d={`M56 ${y(fc)} l9 -5 v10z`} fill="none" stroke="var(--warm)" strokeWidth={1.5} strokeLinejoin="round" />
      )}
    </svg>
  )
}
