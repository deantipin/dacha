'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin, RotateCw } from 'lucide-react';
import type { Place } from '../page';
type ScreenPoint = { x: number; y: number };
type MapInstance = { latLngToContainerPoint: (latlng: number[]) => ScreenPoint; containerPointToLatLng: (point: number[]) => unknown; getSize: () => ScreenPoint; on: (events: string, callback: () => void) => MapInstance; setView: (latlng: number[], zoom: number) => MapInstance; fitBounds: (bounds: number[][], options: Record<string, unknown>) => MapInstance; stop: () => MapInstance; remove: () => void; invalidateSize: () => void };
type Marker = { setIcon: (icon: unknown) => Marker; addTo: (map: MapInstance) => Marker; bindTooltip: (content: HTMLElement, options: Record<string, unknown>) => Marker; on: (event: string, callback: () => void) => Marker; getElement: () => HTMLElement | undefined };
type MapLine = { setStyle: (options: Record<string, unknown>) => MapLine; addTo: (map: MapInstance) => MapLine; setLatLngs: (points: unknown[]) => MapLine };
type Leaflet = { polyline: (latlngs: unknown[], options: Record<string, unknown>) => MapLine; circleMarker: (latlng: number[], options: Record<string, unknown>) => { addTo: (map: MapInstance) => unknown }; map: (element: HTMLElement, options: Record<string, unknown>) => MapInstance; tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: MapInstance) => void; on: (event: string, callback: () => void) => void }; marker: (latlng: number[], options: Record<string, unknown>) => Marker; divIcon: (options: Record<string, unknown>) => unknown };
let loader: Promise<Leaflet> | null = null;
function loadLeaflet() {
  if (loader) return loader;
  loader = new Promise<Leaflet>((resolve, reject) => {
    const existing = (window as unknown as { L?: Leaflet }).L; if (existing) { resolve(existing); return; }
    if (!document.querySelector('link[data-dacha-map]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `${import.meta.env.BASE_URL}map/leaflet.css`; link.dataset.dachaMap = 'true'; document.head.appendChild(link); }
    const script = document.createElement('script'); script.src = `${import.meta.env.BASE_URL}map/leaflet.js`; script.onload = () => { const leaflet = (window as unknown as { L?: Leaflet }).L; if (leaflet) resolve(leaflet); else { loader = null; reject(new Error('map')); } }; script.onerror = () => { loader = null; script.remove(); reject(new Error('map')); }; document.head.appendChild(script);
  }); return loader;
}
export type MapPoint = { id: string; name: string; latitude: number; longitude: number; label: string };
export function PropertyMap({ places, points, onSelect }: { places: Place[]; points?: MapPoint[]; onSelect: (id: string) => void }) {
  const root = useRef<HTMLDivElement>(null); const callback = useRef(onSelect);
  useEffect(() => { callback.current = onSelect; }, [onSelect]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'); const [attempt, setAttempt] = useState(0); const [tileError, setTileError] = useState(false);
  useEffect(() => {
    let cancelled = false; let map: MapInstance | undefined; let frame: number | undefined;
    queueMicrotask(() => { if (!cancelled) { setState('loading'); setTileError(false); } });
    void loadLeaflet().then(L => {
      if (cancelled || !root.current) return;
      map = L.map(root.current, { scrollWheelZoom: false, zoomControl: true, zoomAnimation: false, markerZoomAnimation: false }).setView([55.57, 37.3], 8);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }); tiles.on('tileerror', () => { if (!cancelled) setTileError(true); }); tiles.addTo(map);
      const bounds: number[][] = [];
      const entries = points ?? places.flatMap((place, i) => place.latitude === null || place.longitude === null ? [] : [{ id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude, label: String(i + 1).padStart(2, '0') }]);
      const priceMarkers: { entry: MapPoint; marker: Marker; line: MapLine }[] = [];
      entries.forEach(entry => {
        const point = [entry.latitude, entry.longitude]; bounds.push(point);
        const tooltip = document.createElement('span'); tooltip.textContent = entry.name;
        const badge = document.createElement('span'); badge.textContent = entry.label;
        const icon = L.divIcon({ className: points ? 'property-marker weekend-marker' : 'property-marker', html: badge, iconSize: points ? [130, 39] : [39, 39], iconAnchor: points ? [65, 39] : [19, 39] });
        const marker = L.marker(point, { icon, title: `Открыть ${entry.name} · ${entry.label}`, alt: entry.name, keyboard: true }).addTo(map as MapInstance).bindTooltip(tooltip, { direction: 'top', offset: [0, -32] }).on('click', () => callback.current(entry.id));
        marker.getElement()?.setAttribute('aria-label', `Открыть ${entry.name} · ${entry.label}`);
        if (points) {
          const line = L.polyline([point, point], { color: '#245edb', weight: 1.5, opacity: 0.8, interactive: false }).addTo(map as MapInstance);
          L.circleMarker(point, { radius: 4, color: '#fff', weight: 2, fillColor: '#245edb', fillOpacity: 1, interactive: false }).addTo(map as MapInstance);
          priceMarkers.push({ entry, marker, line });
        }
      });
      const layoutPrices = () => {
        if (cancelled || !map || !points) return;
        const size = map.getSize(); const width = 130; const height = 39; const gap = 8;
        const occupied = [{ x: 8, y: 8, width: 38, height: 88 }];
        const offsets: { x: number; y: number }[] = [];
        for (let y = -Math.ceil(size.y / (height + gap)); y <= Math.ceil(size.y / (height + gap)); y += 1) {
          for (let x = -2; x <= 2; x += 1) offsets.push({ x: x * (width + gap), y: y * (height + gap) });
        }
        offsets.sort((a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y);
        const projected = priceMarkers.map(item => ({ ...item, point: map!.latLngToContainerPoint([item.entry.latitude, item.entry.longitude]) })).sort((a, b) => a.point.y - b.point.y || a.point.x - b.point.x);
        projected.forEach(({ entry, marker, line, point }) => {
          if (point.x < -8 || point.y < -8 || point.x > size.x + 8 || point.y > size.y + 8) {
            const element = marker.getElement(); if (element) element.style.display = 'none';
            line.setStyle({ opacity: 0 }); return;
          }
          line.setStyle({ opacity: 0.8 });
          const candidates = offsets.map(offset => ({ x: Math.max(12, Math.min(size.x - width - 12, point.x - width / 2 + offset.x)), y: Math.max(12, Math.min(size.y - height - 60, point.y - height + offset.y)), width, height }));
          const rect = candidates.find(candidate => occupied.every(other => candidate.x + width + gap <= other.x || other.x + other.width + gap <= candidate.x || candidate.y + height + gap <= other.y || other.y + other.height + gap <= candidate.y)) ?? candidates[0];
          occupied.push(rect);
          const badge = document.createElement('span'); badge.textContent = entry.label;
          marker.setIcon(L.divIcon({ className: 'property-marker weekend-marker', html: badge, iconSize: [width, height], iconAnchor: [point.x - rect.x, point.y - rect.y] }));
          const element = marker.getElement(); if (element) { element.style.display = ''; element.setAttribute('aria-label', `Открыть ${entry.name} · ${entry.label}`); }
          line.setLatLngs([[entry.latitude, entry.longitude], map!.containerPointToLatLng([rect.x + width / 2, rect.y + height])]);
        });
      };
      map.on('zoomend moveend resize', layoutPrices);
      if (bounds.length) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 11 });
      layoutPrices(); setState('ready'); frame = requestAnimationFrame(() => { if (cancelled) return; map?.invalidateSize(); layoutPrices(); });
    }).catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; if (frame !== undefined) cancelAnimationFrame(frame); map?.stop(); map?.remove(); map = undefined; };
  }, [places, points, attempt]);
  return <div className="map-wrap"><div ref={root} className="property-map" aria-label="Карта расположения загородных комплексов" />{state === 'loading' && <div className="map-loading"><MapPin size={30} /><span>Раскладываем дома по карте…</span></div>}{state === 'error' && <div className="map-loading"><MapPin size={30} /><strong>Карта пока не загрузилась</strong><button type="button" className="outline-button" onClick={() => setAttempt(n => n + 1)}><RotateCw size={16} /> Попробовать снова</button></div>}{tileError && state === 'ready' && <div className="map-tile-warning">Подложка карты загружается с задержкой. Метки домов остаются доступны.</div>}<span className="map-instruction"><MapPin size={14} /> Нажмите на метку, чтобы увидеть дом</span></div>;
}
