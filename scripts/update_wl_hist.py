#!/usr/bin/env python3
"""Pflegt wl_hist.json: Tagesmittel Wasserstand, umgerechnet auf Pegel Konstanz (cm).
Quelle: GKD Bayern, Pegel Lindau (m ü. NN). Konstanz = (Lindau - 391,89 m) * 100 + OFFSET_CM.
Der Versatz wurde aus 29 gemeinsamen Tagen bestimmt (Median 3,9 cm, Streuung 0,4 cm).
"""
import datetime as dt, html, json, os, re, sys, urllib.request

G = "https://www.gkd.bayern.de/de/seen/wasserstand/bayern/lindau-20001001"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
OUT = os.path.join(os.path.dirname(__file__), "..", "wl_hist.json")
ZERO_KN, OFFSET_CM = 391.89, 3.9

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8", "replace")

def daily(beginn, ende):
    s = get(f"{G}/messwerte/tabelle?beginn={beginn:%d.%m.%Y}&ende={ende:%d.%m.%Y}")
    res = {}
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", s, re.S):
        c = [html.unescape(re.sub("<[^>]+>", "", x)).strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)]
        if len(c) >= 2 and re.fullmatch(r"\d\d\.\d\d\.\d{4}", c[0]):
            try: res[dt.datetime.strptime(c[0], "%d.%m.%Y").date()] = float(c[1].replace(",", "."))
            except ValueError: pass
    return res

def build(series_m):
    start, end = min(series_m), max(series_m)
    arr = []
    for i in range((end - start).days + 1):
        v = series_m.get(start + dt.timedelta(i))
        arr.append(None if v is None else round((v - ZERO_KN) * 100 + OFFSET_CM))
    return {"station": "Lindau, umgerechnet auf Pegel Konstanz", "source": "GKD Bayern", "offset_cm": OFFSET_CM,
            "start": start.isoformat(), "daily": arr,
            "updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")}

def main(full=False):
    today = dt.date.today()
    if os.path.exists(OUT) and not full:
        old = json.load(open(OUT))
        s0 = dt.date.fromisoformat(old["start"])
        series = {s0 + dt.timedelta(i): v / 100 + ZERO_KN - OFFSET_CM / 100 for i, v in enumerate(old["daily"]) if v is not None}
        series.update(daily(today - dt.timedelta(45), today))
    else:
        series = daily(dt.date(1990, 1, 1), today)
    if len(series) < 30: sys.exit("zu wenige Tageswerte")
    json.dump(build(series), open(OUT, "w"), separators=(",", ":"))
    print(min(series), max(series), len(series))

if __name__ == "__main__":
    main(full="--full" in sys.argv)
