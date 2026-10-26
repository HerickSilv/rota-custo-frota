import { CircleCheck, CircleHelp, OctagonAlert, TriangleAlert } from 'lucide-react';
import { RISK_LABEL } from '../lib/risk';
import type { RiskState } from '../lib/types';

const ICON = {
  ok: CircleCheck,
  attention: TriangleAlert,
  severe: OctagonAlert,
  unknown: CircleHelp,
} as const;

const TONE: Record<RiskState, string> = {
  ok: 'text-[var(--color-ok)]',
  attention: 'text-[var(--color-attention)]',
  severe: 'text-[var(--color-severe)]',
  unknown: 'text-[var(--color-unknown)]',
};

/** Estado de risco sempre com ícone e texto: a cor é reforço, nunca o único canal. */
export function RiskBadge({ state, compact = false }: { state: RiskState; compact?: boolean }) {
  const Icon = ICON[state];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${TONE[state]}`}>
      <Icon aria-hidden="true" size={compact ? 14 : 16} strokeWidth={2} />
      <span className="text-[13px] font-medium text-asphalt-100">{RISK_LABEL[state]}</span>
    </span>
  );
}
