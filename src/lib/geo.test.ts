import { describe, expect, it } from 'vitest';
import { cumulativeM, haversineM, pointAtM, samplePoints, sliceBetweenM } from './geo';
import type { LngLat } from './types';

// São Paulo → Rio de Janeiro em linha reta: ~ 360 km
const SP: LngLat = [-46.6333, -23.5505];
const RJ: LngLat = [-43.1729, -22.9068];

describe('geo', () => {
  it('haversine: SP–RJ ≈ 360 km', () => {
    const km = haversineM(SP, RJ) / 1000;
    expect(km).toBeGreaterThan(355);
    expect(km).toBeLessThan(365);
  });

  it('cumulativeM começa em 0 e é crescente', () => {
    const cum = cumulativeM([SP, [-45, -23], RJ]);
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeGreaterThan(0);
    expect(cum[2]).toBeGreaterThan(cum[1] ?? 0);
  });

  it('pointAtM interpola e respeita os limites', () => {
    const coords: LngLat[] = [[0, 0], [0, 1]];
    const cum = cumulativeM(coords);
    const total = cum[1] ?? 0;
    const mid = pointAtM(coords, cum, total / 2);
    expect(mid[0]).toBeCloseTo(0, 6);
    expect(mid[1]).toBeCloseTo(0.5, 3);
    expect(pointAtM(coords, cum, -10)).toEqual([0, 0]);
    expect(pointAtM(coords, cum, total + 10)).toEqual([0, 1]);
  });

  it('sliceBetweenM devolve as pontas interpoladas e os vértices internos', () => {
    const coords: LngLat[] = [[0, 0], [0, 1], [0, 2]];
    const cum = cumulativeM(coords);
    const total = cum[2] ?? 0;
    const slice = sliceBetweenM(coords, cum, total * 0.25, total * 0.75);
    expect(slice).toHaveLength(3);
    expect(slice[0]?.[1]).toBeCloseTo(0.5, 2);
    expect(slice[1]).toEqual([0, 1]);
    expect(slice[2]?.[1]).toBeCloseTo(1.5, 2);
  });
});

describe('samplePoints', () => {
  const line: LngLat[] = [[0, 0], [0, 4]]; // ~ 445 km

  it('inclui origem e destino e espaça ~ stepKm', () => {
    const pts = samplePoints(line, { stepKm: 90, max: 12 });
    expect(pts[0]?.km).toBe(0);
    expect(pts[0]?.fraction).toBe(0);
    expect(pts[pts.length - 1]?.fraction).toBeCloseTo(1, 6);
    // 445 km / 90 km → 5 intervalos → 6 pontos
    expect(pts).toHaveLength(6);
  });

  it('nunca passa de max pontos', () => {
    const long: LngLat[] = [[0, 0], [0, 40]]; // ~ 4450 km
    const pts = samplePoints(long, { stepKm: 90, max: 12 });
    expect(pts).toHaveLength(12);
  });

  it('rota curta tem pelo menos origem e destino', () => {
    const pts = samplePoints([[0, 0], [0, 0.05]], { stepKm: 90 });
    expect(pts).toHaveLength(2);
  });

  it('geometria degenerada não quebra', () => {
    expect(samplePoints([])).toEqual([]);
    expect(samplePoints([[1, 1], [1, 1]])).toHaveLength(1);
  });

  it('km cresce monotonicamente', () => {
    const pts = samplePoints(line);
    for (let i = 1; i < pts.length; i++) expect(pts[i]?.km ?? 0).toBeGreaterThan(pts[i - 1]?.km ?? 0);
  });
});
