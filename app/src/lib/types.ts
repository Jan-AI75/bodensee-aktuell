/* Datenformate der JSON-Dateien im Hauptordner und der Live-Quellen */

/** Messwert: Zeit in ms, Wert in cm oder °C */
export type Pt = { t: number; v: number }

/** wl_hist.json: Tagesmittel Wasserstand seit 1990, auf Konstanz umgerechnet */
export type WaterHist = { start: string; daily: (number | null)[]; updated?: string }

/** outlook.json: BAFU-Ensemble Romanshorn (m ü. M.) und Wetter im Einzugsgebiet */
export type Outlook = {
  updated?: string
  lake?: {
    base: [string, number]
    median: [string, number][]; p25?: [string, number][]; p75?: [string, number][]
    min?: [string, number][]; max?: [string, number][]
  }
  wx?: { dates: string[]; precip: number[]; snow: number[]; air: number[] }
}

/** temp.json: Tagesmittel Lindau seit 2004 und letzte Messung (Ortszeit) */
export type Temp = { start: string; daily: (number | null)[]; current: { t: string; v: number }; updated?: string }

/** Open-Meteo-Vorhersage für einen Ort */
export type Forecast = {
  current: {
    time: string; temperature_2m: number; apparent_temperature: number; weather_code: number
    wind_speed_10m: number; wind_gusts_10m: number; wind_direction_10m: number
  }
  hourly: {
    time: string[]; temperature_2m: number[]; precipitation: number[]; weather_code: number[]
    wind_speed_10m: number[]; wind_gusts_10m: number[]; wind_direction_10m: number[]
  }
  daily: {
    time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]
    precipitation_sum: number[]; precipitation_probability_max: number[]
    wind_speed_10m_max: number[]; wind_gusts_10m_max: number[]; wind_direction_10m_dominant: number[]
    sunrise: string[]; sunset: string[]
  }
}

export type WarnKey = "west" | "mitte" | "ost"
/** warn.json: Starkwind- und Sturmwarnung der Kantonspolizei Thurgau */
export type Warn = { checked: string; regions: Partial<Record<WarnKey, { level: number | null; text?: string }>> }

export type LakeData = {
  water: { series: Pt[]; live: boolean } | null
  hist: WaterHist | null
  outlook: Outlook | null
  temp: { j: Temp; live: boolean } | null
  wx: { list: Forecast[]; live: boolean } | null
  warn: Warn | null
}
