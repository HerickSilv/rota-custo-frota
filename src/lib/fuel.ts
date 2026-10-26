import { z } from 'zod';
import { UFS, type FuelKind, type UF } from './types';

const price = z.number().min(2).max(20);
const ufEnum = z.enum(UFS);

export const FuelReferenceSchema = z.object({
  source: z.object({
    name: z.string(),
    publisher: z.string(),
    url: z.url(),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    basis: z.string(),
    update: z.string(),
    transcribedAt: z.string(),
  }),
  national: z.object({ gasolina: price, etanol: price, diesel: price }),
  prices: z.record(
    ufEnum,
    z.object({ capital: z.string(), gasolina: price, etanol: price, diesel: price }),
  ),
});
export type FuelReference = z.infer<typeof FuelReferenceSchema>;

export const FUEL_LABEL: Record<FuelKind, string> = {
  gasolina: 'Gasolina C',
  etanol: 'Etanol hidratado',
  diesel: 'Diesel S10',
};

export interface FuelPrice {
  price: number;
  /** Capitais usadas na média (ou 'Brasil' quando cai para a média nacional). */
  basis: string[];
  scope: 'uf' | 'nacional';
}

/**
 * Preço de referência para a viagem: média entre as UFs de origem e destino (capital de cada UF);
 * se só uma UF for conhecida usa ela; se nenhuma, a média nacional da mesma edição da ANP.
 */
export function fuelPriceFor(ref: FuelReference, kind: FuelKind, origin: UF | null, destination: UF | null): FuelPrice {
  const ufs = [...new Set([origin, destination].filter((u): u is UF => u !== null))];
  const rows = ufs.map((u) => ({ uf: u, row: ref.prices[u] })).filter((r) => r.row !== undefined);
  if (rows.length === 0) return { price: ref.national[kind], basis: ['Brasil'], scope: 'nacional' };
  const mean = rows.reduce((acc, r) => acc + (r.row?.[kind] ?? 0), 0) / rows.length;
  return {
    price: Math.round(mean * 100) / 100,
    basis: rows.map((r) => `${r.row?.capital ?? r.uf}/${r.uf}`),
    scope: 'uf',
  };
}

const NAME_TO_UF: Record<string, UF> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'federal district': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT',
  'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE',
  piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO',
  roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Nome do estado (campo admin1 do geocoding, em pt ou en) → sigla da UF. */
export function ufFromStateName(name: string | null | undefined): UF | null {
  if (!name) return null;
  return NAME_TO_UF[normalize(name)] ?? null;
}
