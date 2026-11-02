#!/usr/bin/env python3
"""Schreibt weather.json: Open-Meteo-Vorhersage für sechs Punkte, zuerst drei auf dem See
(Wind), dann die Orte an Land (Temperatur, Wetter, Regen); jeweils Ost/Lindau,
Mitte/Friedrichshafen, West/Überlingen. Die App ruft dieselbe Abfrage live ab, setzt
die Werte zusammen und nutzt diese Datei nur als Rückfall."""
import json, os, sys, urllib.request
OUT = os.path.join(os.path.dirname(__file__), "..", "weather.json")
URL = ("https://api.open-meteo.com/v1/forecast?latitude=47.535,47.625,47.755,47.5455,47.654,47.767&longitude=9.66,9.47,9.165,9.6829,9.479,9.159"
       "&current=temperature_2m,apparent_temperature,weather_code,cloud_cover,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m"
       "&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m"
       "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset"
       "&forecast_days=4&timezone=Europe%2FBerlin&wind_speed_unit=kmh")
req = urllib.request.Request(URL, headers={"User-Agent": "bodensee-aktuell/1.0 (+https://jan-ai75.github.io/bodensee-aktuell/)"})
try:
    d = json.loads(urllib.request.urlopen(req, timeout=60).read())
    assert isinstance(d, list) and len(d) == 6
except Exception as e:
    sys.exit(f"Wetter nicht geladen: {e}")
json.dump(d, open(OUT, "w"), separators=(",", ":"))
print("ok", d[0]["current"]["time"])
