import { describe, expect, it } from 'vitest';
import { buildPlan, recommendPlan, unknownShare } from './plan';
import type { PointForecast } from './trip';
import type { RouteOption } from './types';

// Rota fictícia só para teste: ~111 km em linha reta (1º de latitude), 1 h de duração.
const route: RouteOption = {
  id: 'r1',
  distanceM: 111_000,
  durationS: 3600,
  coordinates: [
    [-46.6, -23.5],
    [-46.6, -22.5],
  ],
};

const departureMs = Date.UTC(2026, 9, 26, 12);
const cost = {
  consumptionKmPerL: 10,
  fuelPricePerL: 6,
  vehicleValue: null,
  annualKm: 50_000,
  depreciationPctYear: 0,
  capitalPctYear: 0,
  maintenancePerKm: 0.5,
  tollsBrl: 0,
  driverPerHour: 30,
};

function forecastWithRain(mm: number): PointForecast {
  const t0 = departureMs / 1000;
  return {
    times: [t0, t0 + 3600, t0 + 7200],
    precipitation: [mm, mm, mm],
    gusts: [10, 10, 10],
    codes: [61, 61, 61],
  };
}

describe('buildPlan', () => {
  it('sem previsão: clima desconhecido e custo calculado mesmo assim', () => {
    const plan = buildPlan(route, { durationFactor: 1, departureMs, forecasts: null, cost });
    expect(plan.worst).toBe('unknown');
    expect(plan.knownSamples).toBe(0);
    expect(plan.segments.every((s) => s.state === 'unknown')).toBe(true);
    // 11,1 l x R$ 6 + R$ 0,50 x 111 km + R$ 30 (1 h de motorista)
    expect(plan.cost.total).toBeCloseTo(152.1, 1);
    expect(unknownShare([plan])).toBe(1);
  });

  it('chuva forte em todos os pontos: risco alto, um alerta cobrindo a rota', () => {
    const forecasts = [forecastWithRain(9), forecastWithRain(9), forecastWithRain(9)];
    const plan = buildPlan(route, { durationFactor: 1, departureMs, forecasts, cost });
    expect(plan.worst).toBe('severe');
    expect(plan.alerts).toHaveLength(1);
    expect(plan.alerts[0]?.fromKm).toBe(0);
    expect(plan.alerts[0]?.toKm).toBeCloseTo(111, 0);
    expect(plan.segments.every((s) => s.state === 'severe')).toBe(true);
  });

  it('fator de duração do veículo alonga o tempo e o custo de motorista', () => {
    const base = buildPlan(route, { durationFactor: 1, departureMs, forecasts: null, cost });
    const heavy = buildPlan(route, { durationFactor: 1.5, departureMs, forecasts: null, cost });
    expect(heavy.durationS).toBeCloseTo(base.durationS * 1.5, 6);
    expect(heavy.cost.driver).toBeCloseTo(base.cost.driver * 1.5, 6);
  });
});

describe('recommendPlan', () => {
  it('prefere o menor risco mesmo quando custa mais', () => {
    const risky = buildPlan(route, { durationFactor: 1, departureMs, forecasts: [forecastWithRain(9), forecastWithRain(9), forecastWithRain(9)], cost: { ...cost, fuelPricePerL: 4 } });
    const calm = buildPlan(route, { durationFactor: 1, departureMs, forecasts: [forecastWithRain(0), forecastWithRain(0), forecastWithRain(0)], cost });
    expect(calm.cost.total).toBeGreaterThan(risky.cost.total);
    expect(recommendPlan([risky, calm])).toBe(1);
  });
});
