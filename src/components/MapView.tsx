import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl';
// O Vite copia o worker com hash para assets/; sem isto o MapLibre procura o arquivo ao lado do chunk e falha.
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { RoutePlan } from '../lib/plan';
import type { Place } from '../lib/types';
import { boundsOf } from '../lib/geo';
import { RISK_COLORS } from './riskColors';

setWorkerUrl(mapWorkerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const BRAZIL_CENTER: [number, number] = [-51.9, -14.2];

const EMPTY = { type: 'FeatureCollection', features: [] } as const;

interface Props {
  plans: RoutePlan[];
  selected: number;
  origin: Place | null;
  destination: Place | null;
  highlight: { lng: number; lat: number } | null;
  /** Margens para o enquadramento não ficar atrás do painel (desktop) ou da folha (mobile). */
  padding: { top: number; right: number; bottom: number; left: number };
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function MapView({ plans, selected, origin, destination, highlight, padding }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(() =>
    webglAvailable() ? null : 'Não foi possível iniciar o mapa neste navegador (WebGL indisponível).',
  );

  // Criação única do mapa; a limpeza remove o WebGL ao desmontar (StrictMode monta duas vezes).
  useEffect(() => {
    if (!container.current || !webglAvailable()) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: container.current,
        style: STYLE_URL,
        center: BRAZIL_CENTER,
        zoom: 3.6,
        attributionControl: { compact: true },
      });
    } catch {
      return;
    }
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => setMapError((prev) => prev ?? 'O mapa não carregou os tiles. A lista de rotas continua disponível.'));
    map.on('load', () => {
      map.addSource('alt', { type: 'geojson', data: EMPTY });
      map.addSource('sel', { type: 'geojson', data: EMPTY });
      map.addSource('hl', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'alt-line',
        type: 'line',
        source: 'alt',
        paint: { 'line-color': '#4f5d69', 'line-width': 4, 'line-opacity': 0.75 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      map.addLayer({
        id: 'sel-casing',
        type: 'line',
        source: 'sel',
        paint: { 'line-color': '#ffffff', 'line-width': 9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      map.addLayer({
        id: 'sel-line',
        type: 'line',
        source: 'sel',
        paint: {
          'line-color': ['match', ['get', 'state'], 'ok', RISK_COLORS.ok, 'attention', RISK_COLORS.attention, 'severe', RISK_COLORS.severe, RISK_COLORS.unknown],
          'line-width': 5,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      // Trecho sem previsão: traço branco tracejado sobre a cinza, para não depender só de cor.
      map.addLayer({
        id: 'sel-unknown-dash',
        type: 'line',
        source: 'sel',
        filter: ['==', ['get', 'state'], 'unknown'],
        paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [1.2, 1.6] },
        layout: { 'line-cap': 'butt' },
      });
      map.addLayer({
        id: 'hl-dot',
        type: 'circle',
        source: 'hl',
        paint: { 'circle-radius': 9, 'circle-color': '#ffffff', 'circle-stroke-color': '#12171c', 'circle-stroke-width': 3 },
      });
      mapRef.current = map;
      setReady(true);
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    mapRef.current = map;
    return () => {
      resize.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Rotas, seleção e marcadores.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const alt = plans.filter((_, i) => i !== selected).map((p) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: p.route.coordinates },
    }));
    (map.getSource('alt') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: alt });
    const current = plans[selected];
    const segments = (current?.segments ?? []).map((s) => ({
      type: 'Feature' as const,
      properties: { state: s.state },
      geometry: { type: 'LineString' as const, coordinates: s.coords },
    }));
    (map.getSource('sel') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: segments });

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    for (const [place, kind, label] of [
      [origin, 'origin', 'A'],
      [destination, 'destination', 'B'],
    ] as const) {
      if (!place) continue;
      const el = document.createElement('div');
      el.className = 'pin';
      el.dataset.kind = kind;
      el.textContent = label;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', kind === 'origin' ? `Origem: ${place.name}` : `Destino: ${place.name}`);
      markersRef.current.push(new Marker({ element: el }).setLngLat([place.lng, place.lat]).addTo(map));
    }
  }, [ready, plans, selected, origin, destination]);

  // Enquadramento: só quando o conjunto de rotas muda (não a seleção).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const coords = plans.flatMap((p) => p.route.coordinates);
    if (coords.length === 0) return;
    map.fitBounds(boundsOf(coords) as LngLatBoundsLike, {
      padding,
      duration: reduceMotion() ? 0 : 700,
      maxZoom: 9,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- padding muda com o layout; não reenquadra ao mudar só a margem
  }, [ready, plans]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('hl') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: highlight
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [highlight.lng, highlight.lat] } }]
        : [],
    });
  }, [ready, highlight]);

  return (
    <div className="relative h-full w-full">
      {/* Estilo inline: o CSS do MapLibre (sem camada) redefine position e vence os utilitários do Tailwind. */}
      <div
        ref={container}
        data-testid="map"
        role="region"
        aria-label="Mapa da rota"
        style={{ position: 'absolute', inset: 0 }}
      />
      {mapError && (
        <div role="alert" className="absolute left-3 top-3 z-10 max-w-sm rounded-[var(--radius-ui)] border border-[var(--color-severe)] bg-asphalt-900/95 px-3 py-2 text-[13px] text-asphalt-100">
          {mapError}
        </div>
      )}
    </div>
  );
}
