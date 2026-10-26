#!/usr/bin/env python3
"""Holt Wassertemperatur Lindau (GKD Bayern) und pflegt temp.json.
temp.json: {start: 'YYYY-MM-DD', daily: [Tagesmittel °C | null], current: {t, v}, updated}
"""
import datetime as dt, html, json, os, re, sys, urllib.request

G = "https://www.gkd.bayern.de/de/seen/wassertemperatur/bayern/lindau-20001001"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
OUT = os.path.join(os.path.dirname(__file__), "..", "temp.json")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")

def rows(s):
    out = []
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", s, re.S):
        c = [html.unescape(re.sub("<[^>]+>", "", x)).strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)]
        if len(c) >= 2 and re.match(r"\d\d\.\d\d\.\d{4}", c[0]):
            out.append(c)
    return out

def num(x):
    try: return float(x.replace(",", "."))
    except ValueError: return None

def daily(beginn, ende):
    s = get(f"{G}/messwerte/tabelle?beginn={beginn:%d.%m.%Y}&ende={ende:%d.%m.%Y}")
    res = {}
    for c in rows(s):
        d = dt.datetime.strptime(c[0][:10], "%d.%m.%Y").date()
        v = num(c[1])
        if v is not None: res[d] = v
    return res

def main(full=False):
    today = dt.date.today()
    data = None
    if os.path.exists(OUT) and not full:
        data = json.load(open(OUT))
    if data:
        start = dt.date.fromisoformat(data["start"])
        series = {start + dt.timedelta(i): v for i, v in enumerate(data["daily"]) if v is not None}
        series.update(daily(today - dt.timedelta(45), today))
    else:
        series = daily(dt.date(1980, 1, 1), today)
    if len(series) < 30: sys.exit("zu wenige Tageswerte")
    start, end = min(series), max(series)
    arr = [series.get(start + dt.timedelta(i)) for i in range((end - start).days + 1)]
    # letzter Viertelstundenwert
    cur = None
    for c in rows(get(f"{G}/messwerte/tabelle")):
        v = num(c[1])
        if v is not None and "Uhr" in c[0]:
            t = dt.datetime.strptime(c[0].replace(" Uhr", ""), "%d.%m.%Y %H:%M")
            cur = {"t": t.strftime("%Y-%m-%dT%H:%M"), "v": v}
            break
    out = {"station": "Lindau (Bodensee)", "source": "GKD Bayern", "start": start.isoformat(),
           "daily": [None if v is None else round(v, 1) for v in arr], "current": cur,
           "updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")}
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print(f"{start}..{end}, {sum(v is not None for v in arr)} Tage, aktuell {cur}")

if __name__ == "__main__":
    main(full="--full" in sys.argv)
