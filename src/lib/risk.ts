import type { HourlyWeather, RiskAssessment, RiskReason } from './types';

/**
 * Limiares do classificador de risco climático.
 * Chuva: escala de intensidade da OMM/WMO — moderada a partir de 2,5 mm/h e forte a partir de 7,6 mm/h.
 * Vento: rajadas ≥ 50 km/h já afetam veículos de carroceria alta; ≥ 70 km/h (próximo de vendaval, Beaufort 8) é crítico.
 * São parâmetros de apoio à decisão, não um alerta meteorológico oficial.
 */
export const RISK_THRESHOLDS = {
  rainAttentionMmH: 2.5,
  rainSevereMmH: 7.6,
  gustAttentionKmH: 50,
  gustSevereKmH: 70,
} as const;

// Códigos WMO usados pelo Open-Meteo (weather_code)
const THUNDERSTORM = [95, 96, 99];
const FREEZING_RAIN = [66, 67];
const FREEZING_DRIZZLE = [56, 57];
const HEAVY_SNOW = [75, 77, 86];
const LIGHT_SNOW = [71, 73, 85];
const FOG = [45, 48];
const VIOLENT_SHOWERS = 82;
const HEAVY_RAIN = 65;

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function assessWeather(w: HourlyWeather | null): RiskAssessment {
  if (!w) return { state: 'unknown', reasons: [] };
  const { precipitationMm: rain, gustKmh: gust, weatherCode: code } = w;
  const reasons: RiskReason[] = [];

  if (THUNDERSTORM.includes(code)) reasons.push({ kind: 'storm', label: 'Trovoada', severe: true });
  if (FREEZING_RAIN.includes(code)) reasons.push({ kind: 'ice', label: 'Chuva congelante', severe: true });
  if (HEAVY_SNOW.includes(code)) reasons.push({ kind: 'snow', label: 'Neve forte', severe: true });
  if (FREEZING_DRIZZLE.includes(code)) reasons.push({ kind: 'ice', label: 'Garoa congelante', severe: false });
  if (LIGHT_SNOW.includes(code)) reasons.push({ kind: 'snow', label: 'Neve', severe: false });
  if (FOG.includes(code)) reasons.push({ kind: 'fog', label: 'Neblina', severe: false });

  if (rain >= RISK_THRESHOLDS.rainSevereMmH || code === VIOLENT_SHOWERS) {
    reasons.push({ kind: 'rain', label: 'Chuva forte', detail: `${fmt1(rain)} mm/h`, severe: true });
  } else if (rain >= RISK_THRESHOLDS.rainAttentionMmH || code === HEAVY_RAIN) {
    reasons.push({ kind: 'rain', label: 'Chuva moderada', detail: `${fmt1(rain)} mm/h`, severe: false });
  }

  if (gust >= RISK_THRESHOLDS.gustSevereKmH) {
    reasons.push({ kind: 'wind', label: 'Rajadas fortes', detail: `${Math.round(gust)} km/h`, severe: true });
  } else if (gust >= RISK_THRESHOLDS.gustAttentionKmH) {
    reasons.push({ kind: 'wind', label: 'Vento forte', detail: `${Math.round(gust)} km/h`, severe: false });
  }

  const state = reasons.some((r) => r.severe) ? 'severe' : reasons.length > 0 ? 'attention' : 'ok';
  return { state, reasons };
}

/** Ordem de gravidade para comparar rotas: 'unknown' pesa mais que 'ok' (há incerteza), menos que um alerta real. */
export const RISK_RANK = { ok: 0, unknown: 1, attention: 2, severe: 3 } as const;
export const RISK_LABEL = {
  ok: 'Sem alertas',
  unknown: 'Sem previsão',
  attention: 'Atenção',
  severe: 'Risco alto',
} as const;
