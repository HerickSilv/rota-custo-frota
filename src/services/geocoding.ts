import { z } from 'zod';
import { ufFromStateName } from '../lib/fuel';
import type { Place } from '../lib/types';
import { getJson } from './http';

const GeoItem = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  country_code: z.string().optional(),
  admin1: z.string().optional(),
  timezone: z.string().optional(),
  population: z.number().optional(),
});
const GeoResponse = z.object({ results: z.array(z.unknown()).optional() });

/** Busca cidades brasileiras pelo nome (Open-Meteo Geocoding, sem chave). Itens inválidos são descartados. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?' +
    new URLSearchParams({ name: q, count: '10', language: 'pt', format: 'json', countryCode: 'BR' });
  const data = await getJson(url, GeoResponse, { service: 'Busca de cidades', signal });
  return (data.results ?? [])
    .flatMap((raw) => {
      const r = GeoItem.safeParse(raw);
      return r.success && r.data.country_code === 'BR' ? [r.data] : [];
    })
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .map((r) => ({
      id: String(r.id),
      name: r.name,
      uf: ufFromStateName(r.admin1),
      lat: r.latitude,
      lng: r.longitude,
      timezone: r.timezone ?? 'America/Sao_Paulo',
    }));
}

export const placeLabel = (p: Place) => (p.uf ? `${p.name}, ${p.uf}` : p.name);
