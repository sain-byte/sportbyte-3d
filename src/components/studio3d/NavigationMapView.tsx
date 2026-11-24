import React, { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Studio3DTrack, Studio3DTrackPoint } from '../../types/studio3d';

/** OpenFreeMap vector styles — no API key required. */
export type NavMapStyleId = 'liberty' | 'bright';

const NAV_STYLES: Record<NavMapStyleId, { url: string; label: string }> = {
  liberty: {
    url: 'https://tiles.openfreemap.org/styles/liberty',
    label: 'Liberty',
  },
  bright: {
    url: 'https://tiles.openfreemap.org/styles/bright',
    label: 'Bright',
  },
};

export { NAV_STYLES };

interface NavigationMapViewProps {
  track: Studio3DTrack;
  progress: number; // 0..1 timeline
  isPlaying: boolean;
  runnerName?: string;
  jerseyColor?: string;
  navStyle?: NavMapStyleId;
  className?: string;
}

function bearingDeg(from: Studio3DTrackPoint, to: Studio3DTrackPoint): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function samplePointAtProgress(track: Studio3DTrack, progress: number): {
  point: Studio3DTrackPoint;
  bearing: number;
  traveled: Array<[number, number]>;
} {
  const pts = track.points;
  if (pts.length === 0) {
    const fallback = {
      lat: track.centerLat,
      lon: track.centerLon,
      xM: 0,
      zM: 0,
      elevationM: 0,
      elapsedSec: 0,
      distanceKm: 0,
      paceSecPerKm: 360,
      hr: 0,
      cadence: 0,
    };
    return { point: fallback, bearing: 0, traveled: [] };
  }
  if (pts.length === 1) {
    return {
      point: pts[0],
      bearing: 0,
      traveled: [[pts[0].lon, pts[0].lat]],
    };
  }

  const p = Math.min(1, Math.max(0, progress));
  const targetDist = p * track.totalDistanceKm;
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].distanceKm < targetDist) i += 1;

  const a = pts[i];
  const b = pts[Math.min(i + 1, pts.length - 1)];
  const seg = Math.max(1e-9, b.distanceKm - a.distanceKm);
  const t = Math.min(1, Math.max(0, (targetDist - a.distanceKm) / seg));
  const point: Studio3DTrackPoint = {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    xM: a.xM + (b.xM - a.xM) * t,
    zM: a.zM + (b.zM - a.zM) * t,
    elevationM: a.elevationM + (b.elevationM - a.elevationM) * t,
    elapsedSec: a.elapsedSec + (b.elapsedSec - a.elapsedSec) * t,
    distanceKm: targetDist,
    paceSecPerKm: b.paceSecPerKm || a.paceSecPerKm,
    hr: Math.round(a.hr + (b.hr - a.hr) * t),
    cadence: Math.round(a.cadence + (b.cadence - a.cadence) * t),
  };

  const bearing = bearingDeg(a, b.distanceKm > a.distanceKm ? b : a);
  const traveled: Array<[number, number]> = [];
  for (let k = 0; k <= i; k += 1) traveled.push([pts[k].lon, pts[k].lat]);
  traveled.push([point.lon, point.lat]);

  return { point, bearing, traveled };
}

export const NavigationMapView: React.FC<NavigationMapViewProps> = ({
  track,
  progress,
  isPlaying,
  runnerName = 'Pelari',
  jerseyColor = '#2563eb',
  navStyle = 'liberty',
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const followRef = useRef(true);
  const styleUrl = NAV_STYLES[navStyle]?.url ?? NAV_STYLES.liberty.url;

  const fullLine = useMemo(
    () => track.points.map((p) => [p.lon, p.lat] as [number, number]),
    [track],
  );

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [track.centerLon, track.centerLat],
      zoom: 14,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      map.addSource('route-full', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: fullLine },
        },
      });
      map.addSource('route-traveled', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        },
      });

      // Casing (white outline) like Google/Grab nav
      map.addLayer({
        id: 'route-full-casing',
        type: 'line',
        source: 'route-full',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 10,
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'route-full-line',
        type: 'line',
        source: 'route-full',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#93c5fd',
          'line-width': 6,
          'line-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'route-traveled-line',
        type: 'line',
        source: 'route-traveled',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#2563eb',
          'line-width': 6,
          'line-opacity': 1,
        },
      });

      if (fullLine.length >= 2) {
        const bounds = fullLine.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(fullLine[0], fullLine[0]),
        );
        map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 0 });
      }
    });

    // User pans → stop auto-follow until play again
    map.on('dragstart', () => {
      followRef.current = false;
    });

    const el = document.createElement('div');
    el.className = 'sportbyte-nav-marker';
    el.innerHTML = `
      <div class="sportbyte-nav-marker-dot" style="background:${jerseyColor}"></div>
      <div class="sportbyte-nav-marker-label">${runnerName.replace(/[<>&]/g, '')}</div>
    `;
    const marker = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat([track.centerLon, track.centerLat])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Style switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onStyle = () => {
      if (!map.getSource('route-full')) {
        map.addSource('route-full', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: fullLine },
          },
        });
        map.addSource('route-traveled', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [] },
          },
        });
        map.addLayer({
          id: 'route-full-casing',
          type: 'line',
          source: 'route-full',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: 'route-full-line',
          type: 'line',
          source: 'route-full',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#93c5fd', 'line-width': 6, 'line-opacity': 0.95 },
        });
        map.addLayer({
          id: 'route-traveled-line',
          type: 'line',
          source: 'route-traveled',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 6, 'line-opacity': 1 },
        });
      }
    };
    map.setStyle(styleUrl);
    map.once('style.load', onStyle);
  }, [styleUrl, fullLine]);

  // Track change → update full route + fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('route-full') as GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: fullLine },
      });
    }
    if (fullLine.length >= 2) {
      const bounds = fullLine.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(fullLine[0], fullLine[0]),
      );
      map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 600 });
      followRef.current = true;
    }
  }, [fullLine, track.id]);

  // Progress → marker + traveled line + optional follow
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const finishThreshold = 0.88;
    const routeP = Math.min(1, Math.max(0, progress / finishThreshold));
    const { point, bearing, traveled } = samplePointAtProgress(track, routeP);

    marker.setLngLat([point.lon, point.lat]);
    marker.setRotation(bearing);

    const traveledSrc = map.getSource('route-traveled') as GeoJSONSource | undefined;
    if (traveledSrc && traveled.length >= 2) {
      traveledSrc.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: traveled },
      });
    }

    if (isPlaying) followRef.current = true;
    if (followRef.current && map.isStyleLoaded()) {
      map.easeTo({
        center: [point.lon, point.lat],
        bearing: isPlaying ? bearing : map.getBearing(),
        duration: isPlaying ? 280 : 0,
        essential: true,
      });
    }
  }, [progress, isPlaying, track]);

  return (
    <div className={className ?? 'absolute inset-0'} data-testid="navigation-map-view">
      <div ref={containerRef} className="w-full h-full" />
      <style>{`
        .sportbyte-nav-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }
        .sportbyte-nav-marker-dot {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        }
        .sportbyte-nav-marker-label {
          margin-top: 2px;
          padding: 1px 6px;
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.82);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .maplibregl-ctrl-attrib {
          font-size: 10px;
        }
      `}</style>
    </div>
  );
};
