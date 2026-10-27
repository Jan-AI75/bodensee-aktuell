#!/usr/bin/env python3
"""Schreibt outlook.json mit
- lake: amtliche Ensemble-Vorhersage Bodensee-Obersee, Pegel Romanshorn (BAFU), in m ü. M.
        Die App rechnet sie als Veränderung gegenüber dem letzten Messwert auf Konstanz um.
- wx:   Wetter (Open-Meteo): Niederschlag als Mittel über Punkte im Einzugsgebiet,
        Lufttemperatur Lindau; jeweils 31 Tage zurück und 8 Tage voraus.
"""
import datetime as dt, json, os, sys, urllib.request

UA = "bodensee-aktuell/1.0 (+https://jan-ai75.github.io/bodensee-aktuell/)"
OUT = os.path.join(os.path.dirname(__file__), "..", "outlook.json")
BAFU = "https://www.hydrodaten.admin.ch/plots/p_forecast/2032_p_forecast_de.json"
# Lindau, Rheintal, Chur, Prättigau/Davos, Montafon, Appenzell/Säntis
LAT = "47.55,47.45,46.85,46.80,47.08,47.30"
LON = "9.68,9.65,9.53,9.83,9.90,9.40"
OM = ("https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&daily=precipitation_sum,snowfall_sum,temperature_2m_mean&past_days=31&forecast_days=8&timezone=Europe%2FBerlin")

def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))

def lake():
    d = get_json(BAFU)["plot"]["data"]
    by = {}
    for t in d:
        by.setdefault(t.get("name"), []).append(t)
    pts = lambda t: [[x, y] for x, y in zip(t["x"], t["y"]) if y is not None]
    med = pts(by["Median"][0])
    band = pts(by["25.-75. Perzentil"][0])
    half = len(band) // 2
    a, b = band[:half + 1], list(reversed(band[half:]))
    mm = [pts(t) for t in by.get("Min. / Max.", [])]
    meas = pts(by["Gemessen"][0])
    lo = [[x, min(y1, y2)] for (x, y1), (_, y2) in zip(a, b)]
    hi = [[x, max(y1, y2)] for (x, y1), (_, y2) in zip(a, b)]
    out = {"station": "Romanshorn", "source": "BAFU", "unit": "m ü. M.",
           "base": meas[-1], "median": med, "p25": lo, "p75": hi}
    if len(mm) == 2:
        out["min"] = [[x, min(y1, y2)] for (x, y1), (_, y2) in zip(mm[0], mm[1])]
        out["max"] = [[x, max(y1, y2)] for (x, y1), (_, y2) in zip(mm[0], mm[1])]
    return out

def wx():
    d = get_json(OM)
    if isinstance(d, dict): d = [d]
    dates = d[0]["daily"]["time"]
    n = len(d)
    mean = lambda key: [round(sum((p["daily"][key][i] or 0) for p in d) / n, 1) for i in range(len(dates))]
    return {"source": "Open-Meteo", "dates": dates, "precip": mean("precipitation_sum"),
            "snow": mean("snowfall_sum"), "air": d[0]["daily"]["temperature_2m_mean"]}

def main():
    old = json.load(open(OUT)) if os.path.exists(OUT) else {}
    out = {"updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")}
    for key, fn in (("lake", lake), ("wx", wx)):
        try:
            out[key] = fn()
        except Exception as e:  # alten Stand behalten, wenn eine Quelle ausfällt
            print(f"{key}: {e}", file=sys.stderr)
            if key in old: out[key] = old[key]
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print({k: (len(v) if isinstance(v, dict) else v) for k, v in out.items()})

if __name__ == "__main__":
    main()
