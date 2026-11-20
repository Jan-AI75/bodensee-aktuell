# Bodensee aktuell

Handy-Web-App (GitHub Pages) für den Bodensee: Wasserstand am Pegel Konstanz mit Vergleich zu gestern, Vorwoche,
Vormonat, Vorjahr und langjährigem Mittel, Vorhersage und Jahresgang; Wassertemperatur Lindau; Wetter für drei
Seeteile; Starkwind- und Sturmwarnung.

## Dateien
- `app/` – Quellcode der App (React, TypeScript, Tailwind, shadcn/ui, Motion); Anleitung in `app/README.md`
- `index.html`, `assets/` – die gebaute App (erzeugt die Action „App bauen“, nicht von Hand ändern)
- `data.json` – Wasserstand Konstanz, 31 Tage (PEGELONLINE); die App lädt live und nimmt diese Kopie nur als Rückfall
- `scripts/update_temp.py` → `temp.json` (Wassertemperatur Lindau, GKD Bayern)
- `scripts/update_wl_hist.py` → `wl_hist.json` (Tagesmittel seit 1990, Lindau auf Konstanz umgerechnet)
- `scripts/update_outlook.py` → `outlook.json` (BAFU-Vorhersage Romanshorn, Wetter im Einzugsgebiet)
- `scripts/update_weather.py` → `weather.json` (Rückfall, wenn Open-Meteo nicht erreichbar)
- `scripts/update_warn.py` → `warn.json` (Kantonspolizei Thurgau)
- `sw.js`, `manifest.webmanifest`, `icon.svg`, `icon-*.png`, `apple-touch-icon.png` – installierbare Web-App (Logo: Quelle `app/public/icon.svg`)
- `.github/workflows/update-data.yml` – Daten, alle 30 Minuten
- `.github/workflows/storm-warn.yml` – Sturmwarnung, alle 5 Minuten
- `.github/workflows/build-app.yml` – baut die App bei Änderungen in `app/`
