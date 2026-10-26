import { useId, type KeyboardEvent } from 'react';
import { brl, clock, duration, km } from '../lib/format';
import type { RoutePlan } from '../lib/plan';
import { RiskBadge } from './RiskBadge';

interface Props {
  plans: RoutePlan[];
  selected: number;
  recommended: number;
  originTz: string;
  costValid: boolean;
  riskPending: boolean;
  onSelect: (index: number) => void;
}

/** Rotas como radiogroup: setas movem a seleção (roving tabindex), Enter/Espaço não são necessários. */
export function RouteList({ plans, selected, recommended, originTz, costValid, riskPending, onSelect }: Props) {
  const uid = useId();
  const move = (from: number, delta: number, e: KeyboardEvent) => {
    e.preventDefault();
    const next = (from + delta + plans.length) % plans.length;
    onSelect(next);
    document.getElementById(`${uid}-${next}`)?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Rotas encontradas" className="space-y-2">
      {plans.map((p, i) => {
        const checked = i === selected;
        const isRecommended = i === recommended;
        return (
          <button
            key={p.route.id}
            id={`${uid}-${i}`}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') move(i, 1, e);
              if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') move(i, -1, e);
            }}
            className={`group grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-[var(--radius-ui)] border px-3 py-2.5 text-left transition-colors ${
              checked
                ? 'border-[var(--color-sign-soft)] bg-asphalt-800'
                : 'border-asphalt-700 bg-asphalt-850 hover:border-asphalt-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="num text-[18px] text-white">Rota {i + 1}</span>
              {isRecommended && (
                <span className="rounded-[3px] bg-[var(--color-sign)] px-1.5 py-[1px] text-[11px] font-semibold text-white">
                  Recomendada
                </span>
              )}
            </span>
            <span className="num self-center text-right text-[18px] text-asphalt-100">
              {costValid ? brl(p.cost.total) : '—'}
            </span>
            <span className="text-[13px] text-asphalt-300">
              {km(p.route.distanceM)} · {duration(p.durationS)} · {costValid ? `${brl(p.cost.perKm)}/km` : 'custo indisponível'}
            </span>
            <span className="justify-self-end">
              {riskPending ? (
                <span className="text-[13px] text-asphalt-400">Previsão em consulta…</span>
              ) : (
                <RiskBadge state={p.worst} compact />
              )}
            </span>
          </button>
        );
      })}
      <p className="text-[12px] text-asphalt-400">
        Recomendada: menor risco climático; entre rotas com o mesmo risco, menor custo; depois, a mais rápida. Saída às{' '}
        {plans[selected] ? clock(plans[selected].samples[0]?.etaMs ?? 0, originTz) : '—'} (hora local da origem).
      </p>
    </div>
  );
}
