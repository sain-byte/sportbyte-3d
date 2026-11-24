# Sport Byte — Studio 3D

Standalone 3D run visualization (guest mode). No sign-in required.

Upload `.FIT` / `.GPX`, customize runner / map / music, export video.

## Stack

- Vite + React 19 + TypeScript
- React Three Fiber + Three.js
- Tailwind CSS 4

## Local

```bash
npm install
npm run dev
```

## Deploy (Vercel)

1. Push this repo to GitHub (`sportbyte-3d`, private OK).
2. Import in Vercel → Framework Preset: **Vite**
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. (Optional) Env: `VITE_MAIN_APP_URL=https://your-main-app.vercel.app`

## Main app link

In the main Sport Byte project, point the Studio 3D button/link to this deployment URL  
(e.g. `https://sportbyte-3d.vercel.app`).


## Map tiles (Vercel)

Serverless proxies under `/api`:

- `GET /api/map-tiles/:style/:z/:x/:y` — OSM / Esri / Carto raster tiles
- `GET /api/map-elevation` — Open-Meteo DEM
- `GET /api/map-roads` — Overpass highways
- `GET /api/map-buildings` — Overpass buildings
- `POST /api/map-match` — OSRM foot snap

Default map style is **hybrid** (Esri World Imagery + road labels overlay).

## Mode Navigasi (MapLibre)

Default view after upload: **Navigasi** (MapLibre + OpenFreeMap, no API key).

- Styles: Liberty, Bright (`https://tiles.openfreemap.org/styles/...`)
- Blue route + moving marker follows playback
- Toggle **Studio 3D** for the original R3F runner scene

3D basemap styles kept: Hybrid, Satellite, Street only.
