import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED = new Set([
  'standard', 'liberty', 'liberty-nolabels', 'satellite', 'terrain',
  'monochrome', 'monochrome-labels', 'hybrid', 'city3d', 'satellite-labels',
  'voyager', 'topo', 'street', 'night',
]);

const UA = 'SportByte3D/1.0 (https://github.com/sain-byte/sportbyte-3d; map-tiles)';

function upstreamUrls(style: string, z: number, x: number, y: number): string[] {
  const sub = ['a', 'b', 'c'][(x + y) % 3];
  const c: Record<string, string[]> = {
    standard: [
      `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
      `https://${sub}.tile.openstreetmap.fr/hot/${z}/${x}/${y}.png`,
    ],
    liberty: [
      `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
      `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
    ],
    'liberty-nolabels': [
      `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/${z}/${x}/${y}.png`,
      `https://${sub}.basemaps.cartocdn.com/light_nolabels/${z}/${x}/${y}.png`,
    ],
    voyager: [
      `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
      `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
    ],
    city3d: [
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
      `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`,
    ],
    terrain: [
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
      `https://${sub}.tile.opentopomap.org/${z}/${x}/${y}.png`,
    ],
    topo: [
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
      `https://${sub}.tile.opentopomap.org/${z}/${x}/${y}.png`,
    ],
    street: [
      `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
    ],
    satellite: [
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    ],
    monochrome: [
      `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`,
      `https://${sub}.basemaps.cartocdn.com/light_nolabels/${z}/${x}/${y}.png`,
    ],
    'monochrome-labels': [
      `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/${z}/${y}/${x}`,
      `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/${z}/${y}/${x}`,
    ],
    hybrid: [
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    ],
    'satellite-labels': [
      `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/${z}/${y}/${x}`,
      `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
    ],
    night: [
      `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`,
    ],
  };
  return c[style] ?? [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }

  const style = String(req.query.style ?? '');
  const z = Number(req.query.z);
  const x = Number(req.query.x);
  const y = Number(req.query.y);

  const maxTileIdx = Number.isInteger(z) && z >= 0 && z <= 19 ? 2 ** z : 0;
  if (
    !ALLOWED.has(style) ||
    !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) ||
    z < 0 || z > 19 || x < 0 || y < 0 || x >= maxTileIdx || y >= maxTileIdx
  ) {
    res.status(400).json({ error: 'Invalid map tile coordinates or style.' });
    return;
  }

  for (const url of upstreamUrls(style, z, x, y)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const upstream = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': UA,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);
      if (!upstream.ok) continue;
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length < 100) continue;
      const contentType = upstream.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).send(buf);
      return;
    } catch {
      // next
    }
  }

  res.status(502).json({ error: 'Upstream map tile unavailable.' });
}
