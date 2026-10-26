import type { ReactNode } from 'react';
import type { CostBreakdown as Cost, CostKey } from '../lib/cost';
import { brl, num2 } from '../lib/format';

/**
 * Rampa sequencial de azul (docs da paleta de dataviz, passos 150-400). Componentes de custo são partes de um
 * todo, não categorias de identidade: uma rampa de uma só cor com rótulo textual ao lado evita a paleta
 * categórica de 6 cores, que não passa no teste de todos os pares.
 */
const RAMP: Record<CostKey, string> = {
  fuel: '#b7d3f6',
  depreciation: '#9ec5f4',
  capital: '#86b6ef',
  maintenance: '#6da7ec',
  tolls: '#5598e7',
  driver: '#3987e5',
};

const LABEL: Record<CostKey, string> = {
  fuel: 'Combustível',
  depreciation: 'Depreciação',
  capital: 'Custo de capital',
  maintenance: 'Manutenção e pneus',
  tolls: 'Pedágios',
  driver: 'Motorista',
};

const ORDER: CostKey[] = ['fuel', 'maintenance', 'driver', 'depreciation', 'capital', 'tolls'];

interface Props {
  cost: Cost;
  distanceKm: number;
  /** Motivo para componentes que não puderam ser calculados (ex.: sem valor do veículo). */
  notes: Partial<Record<CostKey, ReactNode>>;
}

export function CostBreakdown({ cost, distanceKm, notes }: Props) {
  const total = cost.total;
  const share = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const summary = ORDER.map((k) => `${LABEL[k]} ${brl(cost[k])}`).join('; ');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-[12px] uppercase tracking-[0.14em] text-asphalt-400">Custo total da viagem</p>
          <p className="num text-[44px] leading-none text-white" aria-live="polite">{brl(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] uppercase tracking-[0.14em] text-asphalt-400">Por km</p>
          <p className="num text-[28px] leading-none text-asphalt-100">{brl(cost.perKm)}</p>
          <p className="text-[12px] text-asphalt-400">{num2(distanceKm)} km de rota</p>
        </div>
      </div>

      <div className="sr-only">Composição do custo: {summary}.</div>

      <div aria-hidden="true" className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[3px] bg-asphalt-800">
        {ORDER.map((k) => (
          <div
            key={k}
            style={{ width: `${share(cost[k])}%`, background: RAMP[k] }}
            className="h-full min-w-0 transition-[width] duration-500 ease-[var(--ease-out-expo)] motion-reduce:transition-none"
          />
        ))}
      </div>

      <ul className="divide-y divide-asphalt-800 text-[13px]">
        {ORDER.map((k) => {
          const value = cost[k];
          const note = notes[k];
          return (
            <li key={k} className="grid grid-cols-[12px_1fr_auto] items-center gap-x-3 py-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-[2px]" style={{ background: RAMP[k] }} />
              <span className="min-w-0">
                <span className="text-asphalt-100">{LABEL[k]}</span>
                {note && <span className="block text-[12px] text-asphalt-400">{note}</span>}
              </span>
              <span className="num text-right text-[15px] text-asphalt-100">
                {brl(value)}
                <span className="ml-2 inline-block w-[3.2em] text-right text-[12px] text-asphalt-400">
                  {total > 0 ? `${Math.round(share(value))}%` : '—'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
