# Bodensee aktuell – App (React)

Quellcode der App. Gebaut wird sie von der Action „App bauen“: `index.html` und `assets/` landen im Hauptordner,
den GitHub Pages ausliefert. Die Daten (`*.json` im Hauptordner) aktualisieren die Actions „Pegeldaten aktualisieren“
und „Sturmwarnung prüfen“.

```bash
npm ci
npm run dev     # lädt die echten Daten von GitHub Pages (.env.development)
npm run build   # baut nach app/dist
npm run lint
```
