/* App-Gerüst: Desktop mit Glas-Sidebar, Handy/Tablet mit schwebender Tab-Leiste unten.
   Ansicht steht im Hash (#wasserstand, #temperatur, #wetter), damit Links und Zurück funktionieren. */
import { useCallback, useEffect, useState, type ComponentType } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronRight, CloudSun, Contrast, RotateCw, Thermometer, TriangleAlert, Waves } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLakeData } from "@/lib/data"
import { PALETTES, usePalette, type Palette } from "@/lib/theme"
import { MNW, WARNAREA, fmtC, meanFor, sgn, warnInfo, when } from "@/lib/model"
import type { LakeData } from "@/lib/types"
import { WaterView } from "@/components/see/WaterView"
import { TempView } from "@/components/see/TempView"
import { WeatherView } from "@/components/see/WeatherView"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type ViewId = "wasserstand" | "temperatur" | "wetter"
const VIEWS: { id: ViewId; title: string; tab: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "wasserstand", title: "Wasserstand", tab: "Wasserstand", icon: Waves },
  { id: "temperatur", title: "Wassertemperatur", tab: "Temperatur", icon: Thermometer },
  { id: "wetter", title: "Wetter", tab: "Wetter", icon: CloudSun },
]
const VKEY = "pegel-kn-view", RKEY = "pegel-kn-region"
const OLD: Record<string, ViewId> = { w: "wasserstand", t: "temperatur", x: "wetter" }
const isView = (v: string): v is ViewId => VIEWS.some((x) => x.id === v)

function readView(): ViewId {
  const h = decodeURIComponent(location.hash.slice(1))
  if (isView(h)) return h
  try { const s = localStorage.getItem(VKEY) ?? ""; return OLD[s] ?? (isView(s) ? s : "wasserstand") } catch { return "wasserstand" }
}

function useView() {
  const [view, setViewState] = useState<ViewId>(readView)
  useEffect(() => {
    const on = () => setViewState(readView())
    window.addEventListener("hashchange", on)
    window.addEventListener("popstate", on)
    return () => { window.removeEventListener("hashchange", on); window.removeEventListener("popstate", on) }
  }, [])
  const setView = useCallback((v: ViewId) => {
    try { localStorage.setItem(VKEY, v) } catch { /* egal */ }
    if (v === readView() && location.hash === "#" + v) return
    history.pushState(null, "", "#" + v)
    setViewState(v)
    window.scrollTo({ top: 0 })
  }, [])
  return [view, setView] as const
}

function useRegion() {
  const [r, setR] = useState(() => { try { return Math.min(2, Math.max(0, Number(localStorage.getItem(RKEY)) || 0)) } catch { return 0 } })
  const set = useCallback((v: number) => { setR(v); try { localStorage.setItem(RKEY, String(v)) } catch { /* egal */ } }, [])
  return [r, set] as const
}

/** Statuszeile je Ansicht: live oder gespeichert, Zeit der Messung */
function statusOf(D: LakeData, v: ViewId, loading: boolean): { text: string; live: boolean } {
  if (v === "wasserstand") {
    const w = D.water; if (!w) return { text: "Wasserstand nicht erreichbar", live: false }
    const t = new Date(w.series.at(-1)!.t)
    if (loading && !w.live) return { text: "Lädt aktuelle Werte …", live: true }
    return w.live ? { text: `Live, Messung vom ${when(t)}`, live: true } : { text: `Keine Verbindung, letzter Stand vom ${when(t)}`, live: false }
  }
  if (v === "temperatur") {
    const T = D.temp
    if (!T) return { text: loading ? "Lädt aktuelle Werte …" : "Temperaturdaten nicht erreichbar", live: loading }
    const [d, h] = T.j.current.t.split("T"), [y, m, dd] = d.split("-").map(Number), [hh, mi] = h.split(":").map(Number)
    const t = new Date(y, m - 1, dd, hh, mi)
    if (loading && !T.live) return { text: "Lädt aktuelle Werte …", live: true }
    return T.live ? { text: `Messung Lindau vom ${when(t)}`, live: true } : { text: `Keine Verbindung, letzter Stand vom ${when(t)}`, live: false }
  }
  const X = D.wx
  if (!X) return { text: loading ? "Lädt aktuelle Werte …" : "Wetterdaten nicht erreichbar", live: loading }
  const t = new Date(X.list[0].current.time)
  if (loading && !X.live) return { text: "Lädt aktuelle Werte …", live: true }
  return X.live ? { text: `Live, Wetter von ${when(t)}`, live: true } : { text: `Gespeicherte Vorhersage vom ${when(t)}`, live: false }
}

/** Kurzwert je Ansicht für Sidebar */
function valueOf(D: LakeData, v: ViewId) {
  if (v === "wasserstand" && D.water) {
    const last = D.water.series.at(-1)!, d = last.v - meanFor(new Date(last.t))
    return `${Math.round(last.v)} cm, ${sgn(d)} zum Mittel${last.v < MNW ? ", Niedrigwasser" : ""}`
  }
  if (v === "temperatur" && D.temp) return `${fmtC(D.temp.j.current.v)} °C in Lindau`
  if (v === "wetter" && D.wx) { const c = D.wx.list[0].current; return `${Math.round(c.temperature_2m)} °C, Wind ${Math.round(c.wind_speed_10m)} km/h` }
  return "–"
}

export default function App() {
  const { data: D, loading, refresh } = useLakeData()
  const [palette, setPalette] = usePalette()
  const [view, setView] = useView()
  const [region, setRegion] = useRegion()
  const reduce = useReducedMotion()
  const V = VIEWS.find((x) => x.id === view)!
  useEffect(() => { document.title = view === "wasserstand" ? "Bodensee aktuell" : `${V.title} – Bodensee aktuell` }, [view, V.title])

  const openWarnings = useCallback(() => {
    setView("wetter")
    setTimeout(() => document.getElementById("warns-section")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }), 320)
  }, [setView, reduce])

  const actions = <Actions loading={loading} onRefresh={refresh} palette={palette} setPalette={setPalette} />
  const st = statusOf(D, view, loading)

  let body
  if (view === "wasserstand") body = D.water ? <WaterView D={D} /> : <ErrorState what="Wasserstand" onRetry={refresh} />
  else if (view === "temperatur") body = D.temp ? <TempView D={D} /> : loading ? <ViewSkeleton /> : <ErrorState what="Temperaturdaten" onRetry={refresh} />
  else body = D.wx ? <WeatherView D={D} region={region} setRegion={setRegion} /> : loading ? <ViewSkeleton /> : <ErrorState what="Wetterdaten" onRetry={refresh} />

  return (
    <SidebarProvider className="min-h-dvh">
      {/* Desktop: Glas-Sidebar */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 p-3 lg:block">
        <Sidebar collapsible="none" className="glass h-full rounded-[22px] bg-transparent">
          <SidebarHeader className="px-4 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <img src="./icon-192.png" alt="" className="size-8 rounded-[9px] shadow-sm" />
              <span className="font-heading text-headline font-semibold tracking-[-0.015em]">Bodensee aktuell</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu className="gap-1">
                {VIEWS.map((x) => (
                  <SidebarMenuItem key={x.id}>
                    <SidebarMenuButton isActive={view === x.id} onClick={() => setView(x.id)} size="lg" className="h-auto gap-3 rounded-xl py-2.5">
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-[9px]", view === x.id ? "bg-primary text-primary-foreground" : "bg-fill text-muted-foreground")}>
                        <x.icon className="size-[1.125rem]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium">{x.title}</span>
                        <span className="block truncate text-caption text-muted-foreground">{valueOf(D, x.id)}</span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">{actions}</SidebarFooter>
        </Sidebar>
      </aside>

      <main className="min-w-0 flex-1 px-[max(1rem,env(safe-area-inset-left))] pt-[max(1.25rem,env(safe-area-inset-top))] pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-heading text-[1.875rem] leading-[1.1] font-bold tracking-[-0.03em] sm:text-large lg:text-[2.5rem]">{V.title}</h1>
              <p className="mt-1.5 flex items-center gap-2 text-caption text-muted-foreground" aria-live="polite">
                <span className={cn("size-2 shrink-0 rounded-full", loading ? "animate-pulse bg-muted-foreground" : st.live ? "bg-up" : "bg-gale")} />
                {st.text}
              </p>
            </div>
            <div className="lg:hidden">{actions}</div>
          </header>

          <WarnBanner D={D} onOpen={openWarnings} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
              {body}
            </motion.div>
          </AnimatePresence>

          <footer className="mt-10 grid max-w-3xl gap-2 px-1 text-[0.75rem] leading-relaxed text-muted-foreground [&_a]:underline [&_a]:underline-offset-2">
            <p>
              Wasserstand live von <a href="https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=906" target="_blank" rel="noopener">PEGELONLINE (WSV)</a>,
              Pegel Konstanz (906), Pegelnullpunkt 391,89 m ü. NHN. Das langjährige Mittel ist eine Näherung aus Monatswerten;
              das Vorjahr stammt aus den Tagesmitteln des Pegels Lindau, auf Konstanz umgerechnet.
            </p>
            <p>
              Wassertemperatur: Messstelle Lindau des <a href="https://www.gkd.bayern.de/de/seen/wassertemperatur/bayern/lindau-20001001" target="_blank" rel="noopener">Gewässerkundlichen Dienstes Bayern</a> (Konstanz
              misst keine Temperatur). Das Mittel je Kalendertag ist aus den Messjahren seit 2004 berechnet.
            </p>
            <p>
              Ausblick: Wasserstandsvorhersage des <a href="https://www.hydrodaten.admin.ch/de/seen-und-fluesse/stationen-und-daten/2032" target="_blank" rel="noopener">BAFU</a> (Romanshorn).
              Wetter: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>, Wind über dem See, alles andere am Ufer.
              Starkwind- und Sturmwarnung: <a href="https://www.kttg.ch/kapo/htm/stwarn.shtml" target="_blank" rel="noopener">Kantonspolizei Thurgau</a>,
              verbindlich sind allein die Warnleuchten am Ufer. Alle Angaben ohne Gewähr.
            </p>
          </footer>
        </div>
      </main>

      {/* Handy und Tablet: schwebende Tab-Leiste */}
      <nav aria-label="Ansichten"
        className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md rounded-full p-1.5 lg:hidden">
        {VIEWS.map((t) => {
          const on = view === t.id
          return (
            <button key={t.id} type="button" onClick={() => setView(t.id)} aria-current={on ? "page" : undefined}
              className={cn("relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[0.6875rem] font-semibold transition-colors",
                on ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", bounce: 0.18, duration: reduce ? 0 : 0.4 }} />}
              <t.icon className="relative size-5" />
              <span className="relative max-w-full truncate">{t.tab}</span>
            </button>
          )
        })}
      </nav>
    </SidebarProvider>
  )
}

/** Hinweis über allen Ansichten, solange eine Starkwind- oder Sturmwarnung gilt */
function WarnBanner({ D, onOpen }: { D: LakeData; onOpen: () => void }) {
  const info = warnInfo(D.warn)
  const reduce = useReducedMotion()
  const show = !!info && info.active.length > 0
  return (
    <AnimatePresence initial={false}>
      {show && info && D.warn && (
        <motion.button key="warn" type="button" onClick={onOpen}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={cn("group mb-6 flex w-full items-center gap-3 rounded-[22px] px-5 py-3.5 text-left ring-1 transition-[filter] hover:brightness-[1.03]",
            info.max === 2 ? "bg-storm/10 ring-storm/30" : "bg-gale/10 ring-gale/30")}>
          <TriangleAlert className={cn("size-6 shrink-0", info.max === 2 ? "text-storm" : "text-gale")} strokeWidth={2} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{info.max === 2 ? "Sturmwarnung" : "Starkwindwarnung"} Bodensee</span>
            <span className="block text-caption text-muted-foreground">
              {info.active.map((k) => `${WARNAREA[k].n}${D.warn!.regions[k]?.level === 2 ? " (Sturm)" : ""}`).join(", ")}, Stand {when(info.checked)}
              {info.stale ? ", möglicherweise veraltet" : ""}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

function ViewSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Daten werden geladen">
      <div className="surface flex items-center gap-6 p-7"><Skeleton className="h-48 w-14 rounded-full" /><div className="grid flex-1 gap-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-14 w-40" /><Skeleton className="h-4 w-48" /></div></div>
      <div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-64 rounded-[22px]" /><Skeleton className="h-64 rounded-[22px]" /></div>
    </div>
  )
}

function ErrorState({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="surface grid justify-items-center gap-3 px-6 py-12 text-center">
      <div className="text-headline font-semibold">{what} nicht erreichbar</div>
      <p className="max-w-sm text-caption text-muted-foreground">
        Weder die Quelle noch die gespeicherte Kopie ließen sich laden, und auf diesem Gerät ist noch kein Stand gespeichert.
        Prüfe die Internetverbindung und lade neu.
      </p>
      <Button onClick={onRetry} className="mt-2 h-11 rounded-full px-5"><RotateCw className="size-4" />Erneut laden</Button>
    </div>
  )
}

function Actions({ loading, onRefresh, palette, setPalette }: {
  loading: boolean; onRefresh: () => void; palette: Palette; setPalette: (p: Palette) => void
}) {
  const btn = "glass grid size-11 place-items-center rounded-full text-primary transition-transform duration-150 active:scale-92 disabled:cursor-default"
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger render={<button type="button" className={btn} onClick={onRefresh} disabled={loading} aria-label="Aktualisieren" />}>
          <RotateCw className={cn("size-5", loading && "animate-spin")} />
        </TooltipTrigger>
        <TooltipContent>Aktualisieren</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger render={<DropdownMenuTrigger render={<button type="button" className={btn} aria-label="Darstellung" />} />}>
            <Contrast className="size-5" />
          </TooltipTrigger>
          <TooltipContent>Darstellung</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="glass w-56 rounded-2xl p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-caption">Darstellung</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={palette} onValueChange={(v) => setPalette(v as Palette)}>
              {PALETTES.map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.id} closeOnClick className="min-h-10 gap-3 rounded-xl text-body">
                  <span className="flex overflow-hidden rounded-md ring-1 ring-border">
                    {p.swatch.map((c) => <i key={c} className="h-5 w-2.5" style={{ background: c }} />)}
                  </span>
                  {p.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
