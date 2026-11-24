import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxies Open-Meteo elevation API for DEM sampling.
 * Query: ?lats=a,b,c&lons=d,e,f
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }

  const latsRaw = String(req.query.lats ?? '');
  const lonsRaw = String(req.query.lons ?? '');
  const lats = latsRaw.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n));
  const lons = lonsRaw.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n));

  if (lats.length === 0 || lats.length !== lons.length || lats.length > 100) {
    res.status(400).json({ error: 'Invalid elevation coordinates.' });
    return;
  }

  try {
    const chunkSize = 40;
    const merged: number[] = [];
    for (let i = 0; i < lats.length; i += chunkSize) {
      const chunkLats = lats.slice(i, i + chunkSize);
      const chunkLons = lons.slice(i, i + chunkSize);
      const url =
        `https://api.open-meteo.com/v1/elevation?latitude=${chunkLats.map((v) => v.toFixed(5)).join(',')}` +
        `&longitude=${chunkLons.map((v) => v.toFixed(5)).join(',')}`;
      const elevRes = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'SportByte3D/1.0' },
      });
      if (!elevRes.ok) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ elevations: [] });
        return;
      }
      const data = (await elevRes.json()) as { elevation?: number[] };
      if (!Array.isArray(data.elevation) || data.elevation.length !== chunkLats.length) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ elevations: [] });
        return;
      }
      for (const n of data.elevation) {
        merged.push(typeof n === 'number' && Number.isFinite(n) ? n : 0);
      }
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ elevations: merged });
  } catch {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ elevations: [] });
  }
}
