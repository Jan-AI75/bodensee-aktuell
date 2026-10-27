#!/usr/bin/env python3
"""Liest den amtlichen Status der Starkwind- und Sturmwarnung Bodensee
(Kantonspolizei Thurgau) und schreibt warn.json.
Ohne --touch wird die Datei nur bei geänderter Warnlage neu geschrieben
(für den 5-Minuten-Job), mit --touch immer (aktualisiert den Prüfzeitpunkt)."""
import datetime as dt, html, json, os, re, sys, urllib.request
OUT = os.path.join(os.path.dirname(__file__), "..", "warn.json")
URL = "https://www.kttg.ch/kapo/htm/stwarn.shtml"
req = urllib.request.Request(URL, headers={"User-Agent": "bodensee-aktuell/1.0 (+https://jan-ai75.github.io/bodensee-aktuell/)"})
raw = urllib.request.urlopen(req, timeout=30).read().decode("latin-1")
texts = [re.sub(r"\s+", " ", html.unescape(t)).strip() for t in re.findall(r"<strong>(.*?)</strong>", raw, re.S)]
texts = [t for t in texts if t]
if len(texts) < 3:
    sys.exit("Warnstatus nicht gefunden")
def level(t):
    t = t.lower()
    if "sturm" in t: return 2
    if "starkwind" in t: return 1
    if "keine" in t: return 0
    return None
regions = {}
for key, t in zip(["west", "mitte", "ost"], texts[:3]):
    regions[key] = {"text": t, "level": level(t)}
now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
old = json.load(open(OUT)) if os.path.exists(OUT) else {}
changed = old.get("regions") != regions
if changed or "--touch" in sys.argv:
    out = {"source": "Kantonspolizei Thurgau", "url": URL, "checked": now,
           "since": now if changed else old.get("since", now), "regions": regions}
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
print("geändert" if changed else "unverändert", regions)
