import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxies OSRM foot map-matching for GPS track snap-to-road.
 * Body: { points: Array<{ lat: number; lon: number }> }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawPoints = (req.body as { points?: unknown })?.points;
  if (!Array.isArray(rawPoints) || rawPoints.length < 2) {
    res.status(400).json({ error: 'At least 2 GPS coordinates are required.' });
    return;
  }

  const validPoints = rawPoints
    .map((p) => ({
      lat: Number((p as { lat?: unknown })?.lat),
      lon: Number((p as { lon?: unknown })?.lon),
    }))
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        p.lat >= -85 &&
        p.lat <= 85 &&
        p.lon >= -180 &&
        p.lon <= 180,
    );

  if (validPoints.length < 2) {
    res.status(400).json({ error: 'Invalid GPS coordinates for map matching.' });
    return;
  }

  const maxPts = 80;
  const sampled: Array<{ lat: number; lon: number }> = [];
  if (validPoints.length <= maxPts) {
    sampled.push(...validPoints);
  } else {
    const step = (validPoints.length - 1) / (maxPts - 1);
    for (let i = 0; i < maxPts; i += 1) {
      const idx = i === maxPts - 1 ? validPoints.length - 1 : Math.round(i * step);
      sampled.push(validPoints[idx]);
    }
  }

  const coordStr = sampled.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const radii25 = sampled.map(() => '25').join(';');
  const urls = [
    `https://router.project-osrm.org/match/v1/foot/${coordStr}?overview=full&geometries=geojson&gaps=ignore&tidy=true&radiuses=${radii25}`,
    `https://router.project-osrm.org/match/v1/foot/${coordStr}?overview=full&geometries=geojson&gaps=ignore&tidy=true`,
  ];

  const extract = (pairs: Array<[number, number]>) => {
    const out: Array<{ lat: number; lon: number }> = [];
    for (const pair of pairs) {
      if (Array.isArray(pair) && pair.length >= 2) {
        const lon = Number(pair[0]);
        const lat = Number(pair[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const prev = out[out.length - 1];
          if (!prev || Math.abs(prev.lat - lat) > 1e-7 || Math.abs(prev.lon - lon) > 1e-7) {
            out.push({ lat, lon });
          }
        }
      }
    }
    return out;
  };

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'SportByte3D/1.0' },
      });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        code?: string;
        matchings?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
      };
      if (data.code !== 'Ok' || !Array.isArray(data.matchings) || data.matchings.length === 0) {
        continue;
      }
      const coords: Array<{ lat: number; lon: number }> = [];
      for (const m of data.matchings) {
        const pairs = m.geometry?.coordinates;
        if (Array.isArray(pairs)) coords.push(...extract(pairs));
      }
      if (coords.length >= 2) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ matched: true, coordinates: coords });
        return;
      }
    } catch {
      // next
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ matched: false, coordinates: validPoints });
}
