import { describe, expect, it } from 'vitest';
import { assessWeather, RISK_RANK, RISK_THRESHOLDS } from './risk';
import type { HourlyWeather } from './types';

const w = (p: Partial<HourlyWeather> = {}): HourlyWeather => ({ precipitationMm: 0, gustKmh: 10, weatherCode: 1, ...p });

describe('assessWeather', () => {
  it('sem previsão → unknown', () => {
    expect(assessWeather(null)).toEqual({ state: 'unknown', reasons: [] });
  });

  it('tempo firme → ok', () => {
    expect(assessWeather(w()).state).toBe('ok');
  });

  it('chuva moderada → atenção (limite inclusivo)', () => {
    const r = assessWeather(w({ precipitationMm: RISK_THRESHOLDS.rainAttentionMmH, weatherCode: 61 }));
    expect(r.state).toBe('attention');
    expect(r.reasons[0]?.label).toBe('Chuva moderada');
  });

  it('logo abaixo do limite de chuva continua ok', () => {
    expect(assessWeather(w({ precipitationMm: 2.4 })).state).toBe('ok');
  });

  it('chuva forte → risco alto, com detalhe em mm/h', () => {
    const r = assessWeather(w({ precipitationMm: 9.2, weatherCode: 65 }));
    expect(r.state).toBe('severe');
    expect(r.reasons[0]?.label).toBe('Chuva forte');
    expect(r.reasons[0]?.detail).toBe('9,2 mm/h');
  });

  it('trovoada (código 95) é risco alto mesmo sem chuva medida', () => {
    expect(assessWeather(w({ weatherCode: 95 })).state).toBe('severe');
  });

  it('rajadas: 50 km/h atenção, 70 km/h risco alto', () => {
    expect(assessWeather(w({ gustKmh: 50 })).state).toBe('attention');
    expect(assessWeather(w({ gustKmh: 69.9 })).state).toBe('attention');
    expect(assessWeather(w({ gustKmh: 70 })).state).toBe('severe');
  });

  it('neblina é atenção', () => {
    const r = assessWeather(w({ weatherCode: 45 }));
    expect(r.state).toBe('attention');
    expect(r.reasons[0]?.kind).toBe('fog');
  });

  it('vários fatores se acumulam e o pior define o estado', () => {
    const r = assessWeather(w({ precipitationMm: 3, gustKmh: 75, weatherCode: 61 }));
    expect(r.state).toBe('severe');
    expect(r.reasons.map((x) => x.kind).sort()).toEqual(['rain', 'wind']);
  });

  it('ordem de gravidade: ok < unknown < attention < severe', () => {
    expect(RISK_RANK.ok).toBeLessThan(RISK_RANK.unknown);
    expect(RISK_RANK.unknown).toBeLessThan(RISK_RANK.attention);
    expect(RISK_RANK.attention).toBeLessThan(RISK_RANK.severe);
  });
});
