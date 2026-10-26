import { z } from 'zod';
import { VEHICLE_IDS } from './vehicles';
import { UFS, type Place, type UF } from './types';

/** Estado mínimo da tela que viaja na URL. Tudo vindo da query string é tratado como entrada não confiável. */
export interface UrlState {
  origin: Place | null;
  destination: Place | null;
  vehicle: string | null;
  /** "YYYY-MM-DDTHH:mm" na hora de parede do fuso da origem. */
  departure: string | null;
}

const coord = z
  .string()
  .regex(/^-?\d{1,3}(\.\d{1,6})?,-?\d{1,3}(\.\d{1,6})?$/)
  .transform((s) => s.split(',').map(Number) as [number, number])
  .refine(([lat, lng]) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180);

const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return /^[A-Za-z_]+\/[A-Za-z_/+-]+$/.test(tz);
  } catch {
    return false;
  }
});

function placeFrom(params: URLSearchParams, key: 'o' | 'd'): Place | null {
  const c = coord.safeParse(params.get(key));
  const name = z.string().min(1).max(80).safeParse(params.get(`${key}n`));
  const tz = timezone.safeParse(params.get(`${key}t`));
  if (!c.success || !name.success || !tz.success) return null;
  const uf = z.enum(UFS).safeParse(params.get(`${key}u`));
  const [lat, lng] = c.data;
  return { id: `${lat},${lng}`, name: name.data, uf: uf.success ? (uf.data as UF) : null, lat, lng, timezone: tz.data };
}

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const vehicle = z.enum(VEHICLE_IDS as [string, ...string[]]).safeParse(params.get('v'));
  const departure = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .safeParse(params.get('t'));
  return {
    origin: placeFrom(params, 'o'),
    destination: placeFrom(params, 'd'),
    vehicle: vehicle.success ? vehicle.data : null,
    departure: departure.success ? departure.data : null,
  };
}

export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  for (const [key, place] of [['o', state.origin], ['d', state.destination]] as const) {
    if (!place) continue;
    params.set(key, `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`);
    params.set(`${key}n`, place.name);
    params.set(`${key}t`, place.timezone);
    if (place.uf) params.set(`${key}u`, place.uf);
  }
  if (state.vehicle) params.set('v', state.vehicle);
  if (state.departure) params.set('t', state.departure);
  return params.toString();
}
