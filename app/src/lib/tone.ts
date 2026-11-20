export type Tone = "level" | "temp"
/** Farbe einer Änderung: Wasserstand grün/rot, Temperatur warm/kühl */
export const toneClass = (d: number, tone: Tone) => {
  const s = Math.sign(Math.round(tone === "temp" ? d * 10 : d))
  if (s === 0) return "text-muted-foreground"
  return tone === "temp" ? (s > 0 ? "text-warm" : "text-cool") : (s > 0 ? "text-up" : "text-down")
}
