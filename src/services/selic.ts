import { z } from 'zod';
import { getJson } from './http';

export interface SelicTarget {
  /** Meta Selic em % a.a. */
  ratePct: number;
  /** Data da vigência (YYYY-MM-DD). */
  date: string;
}

const Series = z.array(z.object({ data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/), valor: z.string() }));

const isoFromBr = (br: string) => `${br.slice(6, 10)}-${br.slice(3, 5)}-${br.slice(0, 2)}`;

/**
 * Meta Selic (SGS 432, Banco Central) — usada como custo de capital sugerido. Pega o último valor
 * com data até hoje: a série traz datas futuras de vigência já anunciadas.
 */
export async function fetchSelicTarget(signal?: AbortSignal, today = new Date()): Promise<SelicTarget> {
  const rows = await getJson(
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/10?formato=json',
    Series,
    { service: 'Selic (Banco Central)', signal },
  );
  const todayIso = today.toISOString().slice(0, 10);
  const valid = rows
    .map((r) => ({ date: isoFromBr(r.data), ratePct: Number(r.valor) }))
    .filter((r) => r.date <= todayIso && Number.isFinite(r.ratePct) && r.ratePct > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = valid[valid.length - 1];
  if (!last) throw new Error('Selic indisponível.');
  return last;
}
