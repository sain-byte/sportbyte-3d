import type { VercelRequest, VercelResponse } from '@vercel/node';

async function fetchOverpass(query: string): Promise<{ elements?: unknown[] } | null> {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SportByte3D/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      return (await resp.json()) as { elements?: unknown[] };
    } catch {
      // try next
    }
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }

  const south = Number(req.query.south);
  const west = Number(req.query.west);
  const north = Number(req.query.north);
  const east = Number(req.query.east);

  if (
    !Number.isFinite(south) || !Number.isFinite(west) ||
    !Number.isFinite(north) || !Number.isFinite(east) ||
    north <= south || east <= west ||
    north - south > 0.09 || east - west > 0.09
  ) {
    res.status(400).json({ error: 'Invalid road bounding box.' });
    return;
  }

  try {
    const query = `[out:json][timeout:7];way["highway"](${south},${west},${north},${east});out geom 320;`;
    const data = await fetchOverpass(query);
    if (!data) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json({ roads: [] });
      return;
    }

    const roads = (data.elements ?? [])
      .map((el) => {
        const e = el as {
          type?: string;
          tags?: Record<string, string>;
          geometry?: Array<{ lat: number; lon: number }>;
        };
        if (e.type !== 'way' || !Array.isArray(e.geometry) || e.geometry.length < 2) return null;
        return {
          highway: e.tags?.highway ?? 'road',
          name: e.tags?.name ?? null,
          geometry: e.geometry.map((g) => ({ lat: g.lat, lon: g.lon })),
        };
      })
      .filter(Boolean);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.json({ roads });
  } catch {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ roads: [] });
  }
}
