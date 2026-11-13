'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin, RotateCw } from 'lucide-react';
import type { Place } from '../page';
type MapInstance = { setView: (latlng: number[], zoom: number) => MapInstance; fitBounds: (bounds: number[][], options: Record<string, unknown>) => MapInstance; remove: () => void; invalidateSize: () => void };
type Marker = { addTo: (map: MapInstance) => Marker; bindTooltip: (content: HTMLElement, options: Record<string, unknown>) => Marker; on: (event: string, callback: () => void) => Marker; getElement: () => HTMLElement | undefined };
type Leaflet = { map: (element: HTMLElement, options: Record<string, unknown>) => MapInstance; tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: MapInstance) => void; on: (event: string, callback: () => void) => void }; marker: (latlng: number[], options: Record<string, unknown>) => Marker; divIcon: (options: Record<string, unknown>) => unknown };
let loader: Promise<Leaflet> | null = null;
function loadLeaflet() {
  if (loader) return loader;
  loader = new Promise<Leaflet>((resolve, reject) => {
    const existing = (window as unknown as { L?: Leaflet }).L; if (existing) { resolve(existing); return; }
    if (!document.querySelector('link[data-dacha-map]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `${import.meta.env.BASE_URL}map/leaflet.css`; link.dataset.dachaMap = 'true'; document.head.appendChild(link); }
    const script = document.createElement('script'); script.src = `${import.meta.env.BASE_URL}map/leaflet.js`; script.onload = () => { const leaflet = (window as unknown as { L?: Leaflet }).L; if (leaflet) resolve(leaflet); else { loader = null; reject(new Error('map')); } }; script.onerror = () => { loader = null; script.remove(); reject(new Error('map')); }; document.head.appendChild(script);
  }); return loader;
}
export function PropertyMap({ places, onSelect }: { places: Place[]; onSelect: (id: string) => void }) {
  const root = useRef<HTMLDivElement>(null); const callback = useRef(onSelect);
  useEffect(() => { callback.current = onSelect; }, [onSelect]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'); const [attempt, setAttempt] = useState(0); const [tileError, setTileError] = useState(false);
  useEffect(() => {
    let cancelled = false; let map: MapInstance | undefined;
    queueMicrotask(() => { if (!cancelled) { setState('loading'); setTileError(false); } });
    void loadLeaflet().then(L => {
      if (cancelled || !root.current) return;
      map = L.map(root.current, { scrollWheelZoom: false, zoomControl: true }).setView([55.57, 37.3], 8);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }); tiles.on('tileerror', () => { if (!cancelled) setTileError(true); }); tiles.addTo(map);
      const bounds: number[][] = [];
      places.forEach((place, i) => { if (place.latitude === null || place.longitude === null) return; const point = [place.latitude, place.longitude]; bounds.push(point); const label = document.createElement('span'); label.textContent = place.name; const icon = L.divIcon({ className: 'property-marker', html: `<span>${String(i + 1).padStart(2, '0')}</span>`, iconSize: [39, 39], iconAnchor: [19, 39] }); const marker = L.marker(point, { icon, title: `Открыть ${place.name}`, alt: place.name, keyboard: true }).addTo(map as MapInstance).bindTooltip(label, { direction: 'top', offset: [0, -32] }).on('click', () => callback.current(place.id)); marker.getElement()?.setAttribute('aria-label', `Открыть ${place.name}`); });
      if (bounds.length) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 }); setState('ready'); requestAnimationFrame(() => map?.invalidateSize());
    }).catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; map?.remove(); };
  }, [places, attempt]);
  return <div className="map-wrap"><div ref={root} className="property-map" aria-label="Карта расположения загородных комплексов" />{state === 'loading' && <div className="map-loading"><MapPin size={30} /><span>Раскладываем дома по карте…</span></div>}{state === 'error' && <div className="map-loading"><MapPin size={30} /><strong>Карта пока не загрузилась</strong><button type="button" className="outline-button" onClick={() => setAttempt(n => n + 1)}><RotateCw size={16} /> Попробовать снова</button></div>}{tileError && state === 'ready' && <div className="map-tile-warning">Подложка карты загружается с задержкой. Метки домов остаются доступны.</div>}<span className="map-instruction"><MapPin size={14} /> Нажмите на метку, чтобы увидеть дом</span></div>;
}
