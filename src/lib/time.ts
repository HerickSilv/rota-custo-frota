/**
 * Converte "YYYY-MM-DDTHH:mm" (hora de parede) em um instante UTC (ms), interpretando-a no fuso IANA informado.
 * Resolve o deslocamento por tentativa (duas iterações bastam, inclusive em mudanças de horário de verão).
 */
export function zonedLocalToMs(local: string, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  let guess = asUtc;
  for (let i = 0; i < 2; i++) guess = asUtc - offsetMs(guess, timeZone);
  return guess;
}

/** Deslocamento (ms) do fuso em relação ao UTC no instante dado. */
export function offsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** "YYYY-MM-DDTHH:mm" no fuso informado, para o valor de um <input type="datetime-local">. */
export function msToZonedLocal(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
/** Alcance da previsão do Open-Meteo. */
export const FORECAST_MAX_DAYS = 16;
