import { RISK_RANK, assessWeather } from './risk';
import type { SamplePoint } from './geo';
import type { HourlyWeather, RiskAssessment, RiskReason, RiskState } from './types';
import { HOUR_MS } from './time';

export interface PointForecast {
  /** Instantes (segundos Unix, UTC) de cada hora prevista. */
  times: number[];
  precipitation: (number | null)[];
  gusts: (number | null)[];
  codes: (number | null)[];
}

export interface TripSample extends SamplePoint {
  etaMs: number;
  weather: HourlyWeather | null;
  risk: RiskAssessment;
}

/** Horário estimado de chegada: a viagem é percorrida a velocidade média constante. */
export function etaMs(departureMs: number, durationS: number, fraction: number): number {
  return departureMs + durationS * 1000 * fraction;
}

/** Previsão da hora mais próxima do instante; se a mais próxima estiver a mais de 1h30, devolve null. */
export function weatherAt(f: PointForecast | null | undefined, instantMs: number): HourlyWeather | null {
  if (!f || f.times.length === 0) return null;
  const first = (f.times[0] ?? 0) * 1000;
  const idx = Math.round((instantMs - first) / HOUR_MS);
  if (idx < 0 || idx >= f.times.length) return null;
  if (Math.abs(instantMs - (first + idx * HOUR_MS)) > 1.5 * HOUR_MS) return null;
  const precipitation = f.precipitation[idx];
  const gust = f.gusts[idx];
  const code = f.codes[idx];
  if (precipitation == null || gust == null || code == null) return null;
  return { precipitationMm: precipitation, gustKmh: gust, weatherCode: code };
}

export function assessTrip(
  points: SamplePoint[],
  forecasts: (PointForecast | null)[],
  departureMs: number,
  durationS: number,
): TripSample[] {
  return points.map((p, i) => {
    const eta = etaMs(departureMs, durationS, p.fraction);
    const weather = weatherAt(forecasts[i], eta);
    return { ...p, etaMs: eta, weather, risk: assessWeather(weather) };
  });
}

/** Estado de cada trecho entre amostras consecutivas: vale o pior dos dois extremos (visão conservadora). */
export function segmentStates(samples: TripSample[]): RiskState[] {
  const states: RiskState[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = (samples[i] as TripSample).risk.state;
    const b = (samples[i + 1] as TripSample).risk.state;
    if (a === 'unknown' && b === 'unknown') states.push('unknown');
    else if (a === 'unknown') states.push(b);
    else if (b === 'unknown') states.push(a);
    else states.push(RISK_RANK[a] >= RISK_RANK[b] ? a : b);
  }
  return states;
}

export function worstState(samples: TripSample[]): RiskState {
  if (samples.length === 0) return 'unknown';
  let worst: RiskState = 'ok';
  let known = 0;
  for (const s of samples) {
    if (s.risk.state !== 'unknown') known++;
    if (RISK_RANK[s.risk.state] > RISK_RANK[worst] && s.risk.state !== 'unknown') worst = s.risk.state;
  }
  return known === 0 ? 'unknown' : worst;
}

export interface TripAlert {
  state: 'attention' | 'severe';
  fromKm: number;
  toKm: number;
  fromMs: number;
  toMs: number;
  reasons: RiskReason[];
}

/** Agrupa amostras consecutivas com alerta em janelas ("chuva forte do km 180 ao 260, das 14h às 16h"). */
export function buildAlerts(samples: TripSample[]): TripAlert[] {
  const alerts: TripAlert[] = [];
  let current: TripAlert | null = null;
  for (const s of samples) {
    const st = s.risk.state;
    if (st === 'attention' || st === 'severe') {
      if (!current) {
        current = { state: st, fromKm: s.km, toKm: s.km, fromMs: s.etaMs, toMs: s.etaMs, reasons: [] };
        alerts.push(current);
      }
      current.toKm = s.km;
      current.toMs = s.etaMs;
      if (st === 'severe') current.state = 'severe';
      for (const r of s.risk.reasons) {
        if (!current.reasons.some((x) => x.label === r.label)) current.reasons.push(r);
      }
    } else {
      current = null;
    }
  }
  return alerts;
}
