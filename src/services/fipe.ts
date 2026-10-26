import { z } from 'zod';
import { parseBrl } from '../lib/format';
import { getJson } from './http';

/**
 * Tabela FIPE pela API Parallelum v2 (sem chave, CORS aberto, 500 consultas/dia por IP).
 * A BrasilAPI não serve aqui: o endpoint de preço exige o código FIPE já conhecido e não há como
 * navegar marca → modelo → ano; além disso a fonte estava indisponível nos testes (ver docs/design.md).
 */
const BASE = 'https://fipe.parallelum.com.br/api/v2';
const SERVICE = 'Tabela FIPE';

export type FipeType = 'cars' | 'trucks';
export interface FipeItem { code: string; name: string }

const Items = z.array(z.object({ code: z.string(), name: z.string() }));
const PriceResponse = z.object({
  price: z.string(),
  brand: z.string(),
  model: z.string(),
  modelYear: z.number(),
  fuel: z.string(),
  codeFipe: z.string(),
  referenceMonth: z.string(),
});

const get = (path: string, signal?: AbortSignal) => getJson(`${BASE}${path}`, Items, { service: SERVICE, signal });

export const fipeBrands = (type: FipeType, signal?: AbortSignal) => get(`/${type}/brands`, signal);
export const fipeModels = (type: FipeType, brand: string, signal?: AbortSignal) =>
  get(`/${type}/brands/${encodeURIComponent(brand)}/models`, signal);
export const fipeYears = (type: FipeType, brand: string, model: string, signal?: AbortSignal) =>
  get(`/${type}/brands/${encodeURIComponent(brand)}/models/${encodeURIComponent(model)}/years`, signal);

export interface FipePrice {
  value: number;
  label: string;
  referenceMonth: string;
  codeFipe: string;
}

export async function fipePrice(
  type: FipeType, brand: string, model: string, year: string, signal?: AbortSignal,
): Promise<FipePrice> {
  const path = `/${type}/brands/${encodeURIComponent(brand)}/models/${encodeURIComponent(model)}/years/${encodeURIComponent(year)}`;
  const r = await getJson(`${BASE}${path}`, PriceResponse, { service: SERVICE, signal });
  const value = parseBrl(r.price);
  if (value === null || value <= 0) throw new Error('A FIPE devolveu um preço ilegível.');
  return { value, label: `${r.brand} ${r.model} ${r.modelYear} (${r.fuel})`, referenceMonth: r.referenceMonth, codeFipe: r.codeFipe };
}
