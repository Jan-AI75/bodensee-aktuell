/* Zeitreihen-Diagramm als SVG in echter Pixelbreite (scharfe Schrift auf jedem Gerät).
   Ebenen werden deklarativ übergeben. Mit „probe“ lässt sich der Verlauf abtasten:
   Zeiger oder Finger waagerecht ziehen, mit Tastatur Pfeil links/rechts. */
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { cn } from "@/lib/utils"

type V = { t: number; v: number | null }
export type Layer =
  | { kind: "area"; pts: V[]; color: string; opacity?: number }
  | { kind: "band"; hi: V[]; lo: V[]; color: string; opacity?: number }
  | { kind: "line"; pts: V[]; color: string; width?: number; dash?: string }
  | { kind: "hline"; v: number; color: string; label?: string; dash?: string }
  | { kind: "vline"; t: number; label?: string }
  | { kind: "dot"; t: number; v: number; color: string; r?: number }
  | { kind: "label"; t: number; v: number; text: string }
  /** Waagerechter Bereich über die volle Breite, z. B. Risikostufe; Beschriftung oben rechts im Bereich */
  | { kind: "zone"; lo: number; hi: number; color: string; label?: string; labelColor?: string }
export type Probe = { t: number; title: string; items: { color: string; label: string; value: string; v: number }[] }

export type ChartProps = {
  t0: number; t1: number; lo: number; hi: number; step: number
  yFmt?: (v: number) => string
  xTicks: { t: number; label: string }[]
  layers: Layer[]
  height?: number
  probe?: (t: number) => Probe | null
  /** Schrittweite für Pfeiltasten (Einheit wie t) */
  keyStep?: number
  label: string
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const PAD = { l: 38, r: 10, t: 12, b: 24 }

export function Chart({ t0, t1, lo, hi, step, yFmt = String, xTicks, layers, height = 210, probe, keyStep, label }: ChartProps) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [p, setP] = useState<Probe | null>(null)
  const [focusT, setFocusT] = useState<number | null>(null)
  const clip = useId()
  const H = height
  const x0 = PAD.l, x1 = Math.max(PAD.l + 10, W - PAD.r), y0 = PAD.t, y1 = H - PAD.b
  const X = (t: number) => x0 + ((t - t0) / (t1 - t0 || 1)) * (x1 - x0)
  const Y = (v: number) => y1 - ((v - lo) / (hi - lo || 1)) * (y1 - y0)
  const invX = (x: number) => t0 + ((x - x0) / (x1 - x0)) * (t1 - t0)

  const path = (pts: V[]) => {
    let d = "", pen = false
    for (const q of pts) {
      if (q.v == null) { pen = false; continue }
      d += `${pen ? "L" : "M"}${X(q.t).toFixed(1)} ${Y(q.v).toFixed(1)}`; pen = true
    }
    return d
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!probe) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.max(x0, Math.min(x1, e.clientX - r.left))
    setP(probe(invX(x)))
  }
  const onKey = (e: KeyboardEvent) => {
    if (!probe || !keyStep) return
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const base = focusT ?? p?.t ?? t1
    const nt = Math.max(t0, Math.min(t1, base + (e.key === "ArrowRight" ? keyStep : -keyStep)))
    setFocusT(nt); setP(probe(nt))
  }

  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(v)
  const px = p ? X(p.t) : 0

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: H }}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={label}
          tabIndex={probe && keyStep ? 0 : undefined}
          onKeyDown={onKey} onBlur={() => { setFocusT(null); setP(null) }}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setP(null)}
          className={cn("block rounded-lg", probe && "touch-pan-y")}>
          <defs><clipPath id={clip}><rect x={x0} y={y0 - 4} width={x1 - x0} height={y1 - y0 + 8} /></clipPath></defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={x0} x2={x1} y1={Y(v)} y2={Y(v)} stroke="var(--border)" />
              <text x={x0 - 8} y={Y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{yFmt(v)}</text>
            </g>
          ))}
          {xTicks.map((k, i) => (
            <text key={i} x={X(k.t)} y={H - 6} className="fill-muted-foreground text-[11px]"
              textAnchor={X(k.t) < x0 + 20 ? "start" : X(k.t) > x1 - 20 ? "end" : "middle"}>{k.label}</text>
          ))}
          <g clipPath={`url(#${clip})`}>
            {layers.map((L, i) => {
              switch (L.kind) {
                case "area": {
                  const d = path(L.pts); const q = L.pts.filter((z) => z.v != null)
                  if (q.length < 2) return null
                  return <path key={i} d={`${d}L${X(q.at(-1)!.t)} ${y1}L${X(q[0].t)} ${y1}Z`} fill={L.color} opacity={L.opacity ?? 1} />
                }
                case "band": {
                  const up = L.hi.filter((z) => z.v != null), dn = L.lo.filter((z) => z.v != null).reverse()
                  if (up.length < 2) return null
                  const pts = up.concat(dn).map((z) => `${X(z.t).toFixed(1)} ${Y(z.v!).toFixed(1)}`)
                  return <path key={i} d={"M" + pts.join("L") + "Z"} fill={L.color} opacity={L.opacity ?? 1} />
                }
                case "line":
                  return <path key={i} d={path(L.pts)} fill="none" stroke={L.color} strokeWidth={L.width ?? 2}
                    strokeDasharray={L.dash} strokeLinejoin="round" strokeLinecap="round" />
                case "hline":
                  return (
                    <g key={i}>
                      <line x1={x0} x2={x1} y1={Y(L.v)} y2={Y(L.v)} stroke={L.color} strokeDasharray={L.dash ?? "3 4"} opacity={0.8} />
                      {L.label && <text x={x0 + 4} y={Y(L.v) + 14} textAnchor="start" fill={L.color} className="text-[11px] font-medium">{L.label}</text>}
                    </g>
                  )
                case "vline":
                  return (
                    <g key={i}>
                      <line x1={X(L.t)} x2={X(L.t)} y1={y0} y2={y1} stroke="var(--muted-foreground)" strokeDasharray="2 3" opacity={0.6} />
                      {L.label && <text x={X(L.t) + 5} y={y0 + 10} className="fill-muted-foreground text-[11px]">{L.label}</text>}
                    </g>
                  )
                case "zone": {
                  const top = Y(Math.min(L.hi, hi)), bot = Y(Math.max(L.lo, lo))
                  if (bot <= top) return null
                  return (
                    <g key={i}>
                      <rect x={x0} y={top} width={x1 - x0} height={bot - top} fill={L.color} />
                      <line x1={x0} x2={x1} y1={bot} y2={bot} stroke={L.labelColor ?? L.color} strokeDasharray="2 4" opacity={0.8} />
                      {L.label && bot - top > 16 && <text x={x1 - 6} y={bot - 6} textAnchor="end" fill={L.labelColor} className="text-[11px] font-semibold">{L.label}</text>}
                    </g>
                  )
                }
                case "dot":
                  return <circle key={i} cx={X(L.t)} cy={Y(L.v)} r={L.r ?? 4.5} fill={L.color} stroke="var(--card)" strokeWidth={2} />
                case "label": {
                  const right = X(L.t) < x0 + 70
                  return <text key={i} x={X(L.t) + (right ? 9 : -9)} y={Y(L.v)} textAnchor={right ? "start" : "end"}
                    className="fill-foreground text-[12px] font-semibold">{L.text}</text>
                }
              }
            })}
          </g>
          {p && (
            <g pointerEvents="none">
              <line x1={px} x2={px} y1={y0} y2={y1} stroke="var(--foreground)" opacity={0.25} />
              {p.items.map((it, i) => <circle key={i} cx={px} cy={Y(it.v)} r={4} fill={it.color} stroke="var(--card)" strokeWidth={2} />)}
            </g>
          )}
        </svg>
      )}
      {p && (
        <div aria-live="polite"
          className="glass pointer-events-none absolute top-0 z-10 min-w-32 -translate-x-1/2 rounded-xl px-3 py-2 text-caption"
          style={{ left: Math.max(76, Math.min(W - 76, px)) }}>
          <div className="font-semibold">{p.title}</div>
          {p.items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
              <i className="size-2 rounded-full" style={{ background: it.color }} />
              <span className="flex-1">{it.label}</span>
              <span className="font-semibold text-foreground tabular-nums">{it.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Legende unter einem Diagramm */
export function Legend({ items }: { items: { color: string; label: string; kind?: "line" | "dash" | "box" }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.kind === "box"
            ? <i className="h-2.5 w-3.5 rounded-[3px]" style={{ background: it.color }} />
            : it.kind === "dash"
              ? <i className="h-0.5 w-3.5" style={{ backgroundImage: `linear-gradient(90deg, ${it.color} 60%, transparent 60%)`, backgroundSize: "5px 2px" }} />
              : <i className="h-0.5 w-3.5 rounded-full" style={{ background: it.color }} />}
          {it.label}
        </li>
      ))}
    </ul>
  )
}
