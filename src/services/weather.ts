import { z } from 'zod';
import type { PointForecast } from '../lib/trip';
import { DAY_MS, FORECAST_MAX_DAYS } from '../lib/time';
import { ApiError, getJson } from './http';

const PointResponse = z.object({
  hourly: z.object({
    time: z.array(z.number()),
    precipitation: z.array(z.number().nullable()),
    wind_gusts_10m: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()),
  }),
});
const ForecastResponse = z.union([PointResponse, z.array(PointResponse)]);

export interface Coverage {
  /** Início da janela prevista (UTC, ms) — 00:00 UTC do dia da consulta. */
  fromMs: number;
  /** Fim (exclusivo) da janela prevista. */
  toMs: number;
}

const startOfUtcDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;

/** Dias de previsão a pedir para cobrir até `untilMs`; a API aceita no máximo 16. */
export function forecastDaysFor(nowMs: number, untilMs: number): number {
  return Math.min(FORECAST_MAX_DAYS, Math.max(1, Math.ceil((untilMs - startOfUtcDay(nowMs)) / DAY_MS)));
}

export function coverageFor(nowMs: number, days: number): Coverage {
  const fromMs = startOfUtcDay(nowMs);
  return { fromMs, toMs: fromMs + days * DAY_MS };
}

export function forecastUrl(points: { lat: number; lng: number }[], days: number): string {
  return (
    'https://api.open-meteo.com/v1/forecast?' +
    new URLSearchParams({
      latitude: points.map((p) => p.lat.toFixed(3)).join(','),
      longitude: points.map((p) => p.lng.toFixed(3)).join(','),
      hourly: 'precipitation,wind_gusts_10m,weather_code',
      forecast_days: String(days),
      timeformat: 'unixtime',
      timezone: 'GMT',
    })
  );
}

/**
 * Previsão horária (chuva, rajadas, código do tempo) para vários pontos numa única chamada.
 * O resultado segue a ordem de `points`.
 */
export async function fetchForecasts(
  points: { lat: number; lng: number }[],
  days: number,
  signal?: AbortSignal,
): Promise<PointForecast[]> {
  if (points.length === 0) return [];
  const data = await getJson(forecastUrl(points, days), ForecastResponse, { service: 'Previsão do tempo (Open-Meteo)', signal, timeoutMs: 25_000 });
  const list = Array.isArray(data) ? data : [data];
  if (list.length !== points.length) {
    throw new ApiError('invalid', 'Previsão do tempo (Open-Meteo)', 'A previsão veio incompleta para os pontos da rota.');
  }
  return list.map((p) => ({
    times: p.hourly.time,
    precipitation: p.hourly.precipitation,
    gusts: p.hourly.wind_gusts_10m,
    codes: p.hourly.weather_code,
  }));
}
