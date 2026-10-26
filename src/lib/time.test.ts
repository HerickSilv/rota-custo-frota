import { describe, expect, it } from 'vitest';
import { msToZonedLocal, zonedLocalToMs } from './time';
import { clockShort, duration, parseBrl, parseNumberInput } from './format';
import { coverageFor, forecastDaysFor, forecastUrl } from '../services/weather';
import { DAY_MS } from './time';

describe('fusos', () => {
  it('São Paulo é UTC-3 (sem horário de verão desde 2019)', () => {
    expect(new Date(zonedLocalToMs('2026-10-27T06:30', 'America/Sao_Paulo')).toISOString()).toBe('2026-10-27T09:30:00.000Z');
  });

  it('Manaus é UTC-4 e Rio Branco UTC-5', () => {
    expect(new Date(zonedLocalToMs('2026-10-27T06:30', 'America/Manaus')).toISOString()).toBe('2026-10-27T10:30:00.000Z');
    expect(new Date(zonedLocalToMs('2026-10-27T06:30', 'America/Rio_Branco')).toISOString()).toBe('2026-10-27T11:30:00.000Z');
  });

  it('ida e volta local ↔ UTC', () => {
    const ms = zonedLocalToMs('2026-12-31T23:45', 'America/Sao_Paulo');
    expect(msToZonedLocal(ms, 'America/Sao_Paulo')).toBe('2026-12-31T23:45');
  });

  it('entrada inválida → NaN', () => {
    expect(zonedLocalToMs('amanhã', 'America/Sao_Paulo')).toBeNaN();
  });
});

describe('formatação', () => {
  it('duração', () => {
    expect(duration(2520)).toBe('42 min');
    expect(duration(19800)).toBe('5 h 30 min');
    expect(duration(7200)).toBe('2 h');
    expect(duration(3660)).toBe('1 h 01 min');
  });

  it('hora curta', () => {
    const ms = zonedLocalToMs('2026-10-27T14:00', 'America/Sao_Paulo');
    expect(clockShort(ms, 'America/Sao_Paulo')).toBe('14h');
    expect(clockShort(ms + 20 * 60_000, 'America/Sao_Paulo')).toBe('14h20');
  });

  it('parseBrl lê o formato da FIPE', () => {
    expect(parseBrl('R$ 60.320,00')).toBe(60320);
    expect(parseBrl('R$ 1.234.567,89')).toBeCloseTo(1234567.89, 2);
    expect(parseBrl('sem preço')).toBeNull();
  });

  it('parseNumberInput aceita vírgula e ponto', () => {
    expect(parseNumberInput('6,49')).toBe(6.49);
    expect(parseNumberInput('1.234,5')).toBe(1234.5);
    expect(parseNumberInput('6.49')).toBe(6.49);
    expect(parseNumberInput('')).toBeNaN();
  });
});

describe('previsão: janela pedida', () => {
  const now = Date.UTC(2026, 9, 26, 17, 0);

  it('pede o mínimo de dias para cobrir a chegada e limita a 16', () => {
    expect(forecastDaysFor(now, now + 5 * 3600_000)).toBe(1);
    expect(forecastDaysFor(now, now + 20 * 3600_000)).toBe(2);
    expect(forecastDaysFor(now, now + 40 * DAY_MS)).toBe(16);
  });

  it('cobertura começa em 00:00 UTC do dia da consulta', () => {
    const c = coverageFor(now, 3);
    expect(new Date(c.fromMs).toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(c.toMs - c.fromMs).toBe(3 * DAY_MS);
  });

  it('URL com várias coordenadas numa só chamada', () => {
    const url = forecastUrl([{ lat: -23.55, lng: -46.63 }, { lat: -22.9, lng: -43.17 }], 2);
    const p = new URL(url).searchParams;
    expect(p.get('latitude')).toBe('-23.550,-22.900');
    expect(p.get('longitude')).toBe('-46.630,-43.170');
    expect(p.get('timeformat')).toBe('unixtime');
    expect(p.get('forecast_days')).toBe('2');
  });
});
