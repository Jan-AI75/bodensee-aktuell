/* Darstellung: Automatisch (folgt dem System), Hell, Dunkel, Nachtsee, Nachtsicht. */
import { useEffect, useState } from "react"

export type Palette = "auto" | "hell" | "dunkel" | "nachtsee" | "nacht"
export const PALETTES: { id: Palette; name: string; swatch: string[] }[] = [
  { id: "auto", name: "Automatisch", swatch: ["#f2f5f6", "#0b6f8f", "#172024"] },
  { id: "hell", name: "Hell", swatch: ["#f2f5f6", "#ffffff", "#0b6f8f"] },
  { id: "dunkel", name: "Dunkel", swatch: ["#0e1316", "#172024", "#6cc3e0"] },
  { id: "nachtsee", name: "Nachtsee", swatch: ["#0b1a20", "#5fb6d3", "#e0a957"] },
  { id: "nacht", name: "Nachtsicht (rot)", swatch: ["#070303", "#e8604f", "#ff8a7c"] },
]
const KEY = "pegel-kn-palette"
/* Frühere Paletten auf die neuen abbilden */
const migrate = (p: string | null): Palette => {
  const m: Record<string, Palette> = { graphit: "dunkel", marine: "dunkel", schwarz: "dunkel" }
  const v = (p && (m[p] ?? p)) as Palette
  return PALETTES.some((x) => x.id === v) ? v : "auto"
}
const mq = () => window.matchMedia("(prefers-color-scheme: dark)")

function apply(p: Palette) {
  const html = document.documentElement
  const dark = p === "auto" ? mq().matches : p !== "hell"
  html.classList.toggle("dark", dark)
  if (p === "nachtsee" || p === "nacht") html.dataset.palette = p
  else delete html.dataset.palette
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute("content", getComputedStyle(html).getPropertyValue("--background").trim())
}

export function usePalette() {
  const [palette, setPalette] = useState<Palette>(() => {
    try { return migrate(localStorage.getItem(KEY)) } catch { return "auto" }
  })
  useEffect(() => {
    apply(palette)
    try { localStorage.setItem(KEY, palette) } catch { /* egal */ }
    if (palette !== "auto") return
    const m = mq(), on = () => apply("auto")
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [palette])
  return [palette, setPalette] as const
}
