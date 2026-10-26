import type { LngLat } from './types';

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distância acumulada (m) em cada vértice; cum[0] = 0. */
export function cumulativeM(coords: LngLat[]): number[] {
  const cum: number[] = [];
  let acc = 0;
  coords.forEach((c, i) => {
    const prev = coords[i - 1];
    if (prev) acc += haversineM(prev, c);
    cum.push(acc);
  });
  return cum;
}

/** Índice do último vértice com cum[i] <= d (busca binária). */
function lowerIndex(cum: number[], d: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((cum[mid] ?? Infinity) <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function pointAtM(coords: LngLat[], cum: number[], d: number): LngLat {
  const last = coords[coords.length - 1];
  if (!last) throw new Error('Geometria vazia');
  if (d <= 0) return coords[0] ?? last;
  if (d >= (cum[cum.length - 1] ?? 0)) return last;
  const i = lowerIndex(cum, d);
  const a = coords[i] as LngLat;
  const b = coords[i + 1] as LngLat;
  const segLen = (cum[i + 1] ?? 0) - (cum[i] ?? 0);
  const t = segLen === 0 ? 0 : (d - (cum[i] ?? 0)) / segLen;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Trecho da geometria entre as distâncias d0 e d1 (m), com as pontas interpoladas. */
export function sliceBetweenM(coords: LngLat[], cum: number[], d0: number, d1: number): LngLat[] {
  const out: LngLat[] = [pointAtM(coords, cum, d0)];
  coords.forEach((c, i) => {
    const d = cum[i] ?? 0;
    if (d > d0 && d < d1) out.push(c);
  });
  out.push(pointAtM(coords, cum, d1));
  return out;
}

export interface SamplePoint {
  /** Quilômetro percorrido desde a origem. */
  km: number;
  /** Fração da distância total (0–1); usada para estimar o horário de chegada ao ponto. */
  fraction: number;
  lng: number;
  lat: number;
}

/**
 * Pontos igualmente espaçados ao longo da rota, incluindo origem e destino.
 * O espaçamento é `stepKm`, aumentado se necessário para respeitar `max` pontos.
 */
export function samplePoints(
  coords: LngLat[],
  { stepKm = 90, max = 12 }: { stepKm?: number; max?: number } = {},
): SamplePoint[] {
  if (coords.length === 0) return [];
  const cum = cumulativeM(coords);
  const total = cum[cum.length - 1] ?? 0;
  if (total === 0) {
    const [lng, lat] = coords[0] as LngLat;
    return [{ km: 0, fraction: 0, lng, lat }];
  }
  const intervals = Math.max(1, Math.min(Math.ceil(total / (stepKm * 1000)), max - 1));
  const points: SamplePoint[] = [];
  for (let i = 0; i <= intervals; i++) {
    const d = (total * i) / intervals;
    const [lng, lat] = pointAtM(coords, cum, d);
    points.push({ km: d / 1000, fraction: d / total, lng, lat });
  }
  return points;
}

export function boundsOf(coords: LngLat[]): [LngLat, LngLat] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}
