import { describe, expect, it } from 'vitest';
import { assessTrip, buildAlerts, etaMs, segmentStates, weatherAt, worstState, type PointForecast } from './trip';
import { HOUR_MS } from './time';
import type { SamplePoint } from './geo';

const T0 = Date.UTC(2026, 9, 27, 0, 0); // 27/10/2026 00:00 UTC

function forecast(hours: { p?: number; g?: number; c?: number }[]): PointForecast {
  return {
    times: hours.map((_, i) => T0 / 1000 + i * 3600),
    precipitation: hours.map((h) => h.p ?? 0),
    gusts: hours.map((h) => h.g ?? 10),
    codes: hours.map((h) => h.c ?? 1),
  };
}

const pt = (km: number, fraction: number): SamplePoint => ({ km, fraction, lng: 0, lat: 0 });

describe('etaMs', () => {
  it('interpola linearmente pela duração', () => {
    expect(etaMs(T0, 7200, 0)).toBe(T0);
    expect(etaMs(T0, 7200, 0.5)).toBe(T0 + HOUR_MS);
    expect(etaMs(T0, 7200, 1)).toBe(T0 + 2 * HOUR_MS);
  });
});

describe('weatherAt', () => {
  const f = forecast([{ p: 0 }, { p: 5, c: 63 }, { p: 9, c: 65 }]);

  it('pega a hora mais próxima', () => {
    expect(weatherAt(f, T0 + HOUR_MS + 10 * 60_000)?.precipitationMm).toBe(5);
    expect(weatherAt(f, T0 + 2 * HOUR_MS - 10 * 60_000)?.precipitationMm).toBe(9);
  });

  it('fora da janela prevista → null', () => {
    expect(weatherAt(f, T0 - 3 * HOUR_MS)).toBeNull();
    expect(weatherAt(f, T0 + 10 * HOUR_MS)).toBeNull();
    expect(weatherAt(null, T0)).toBeNull();
  });

  it('valor nulo na hora → null', () => {
    const g = forecast([{ p: 0 }]);
    g.precipitation[0] = null;
    expect(weatherAt(g, T0)).toBeNull();
  });
});

describe('assessTrip, segmentStates, alertas', () => {
  // 4 pontos a cada 100 km; viagem de 3 h saindo às 00:00 UTC → chegadas 0h, 1h, 2h, 3h
  const points = [pt(0, 0), pt(100, 1 / 3), pt(200, 2 / 3), pt(300, 1)];
  const f = forecast([{}, { p: 8, c: 65 }, { p: 3, c: 61 }, {}]);
  const samples = assessTrip(points, [f, f, f, f], T0, 3 * 3600);

  it('cada ponto usa a previsão da hora em que o veículo chega', () => {
    expect(samples.map((s) => s.risk.state)).toEqual(['ok', 'severe', 'attention', 'ok']);
  });

  it('trecho assume o pior dos dois extremos', () => {
    expect(segmentStates(samples)).toEqual(['severe', 'severe', 'attention']);
  });

  it('alerta agrupa pontos consecutivos e sobe para o pior estado', () => {
    const alerts = buildAlerts(samples);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ state: 'severe', fromKm: 100, toKm: 200 });
    expect(alerts[0]?.reasons.map((r) => r.label)).toEqual(['Chuva forte', 'Chuva moderada']);
  });

  it('pior estado da rota', () => {
    expect(worstState(samples)).toBe('severe');
  });

  it('sem previsão para nenhum ponto → unknown; unknown não rebaixa o pior conhecido', () => {
    const none = assessTrip(points, [null, null, null, null], T0, 3600);
    expect(worstState(none)).toBe('unknown');
    expect(segmentStates(none)).toEqual(['unknown', 'unknown', 'unknown']);
    const mixed = assessTrip(points, [f, f, null, null], T0, 3 * 3600);
    expect(worstState(mixed)).toBe('severe');
    expect(segmentStates(mixed)[2]).toBe('unknown');
  });

  it('dois alertas separados por trecho ok', () => {
    const g = forecast([{ p: 5 }, {}, { p: 5 }, {}]);
    const s = assessTrip(points, [g, g, g, g], T0, 3 * 3600);
    expect(buildAlerts(s)).toHaveLength(2);
  });
});
