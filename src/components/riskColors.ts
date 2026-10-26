import type { RiskState } from '../lib/types';

/** Cores de risco (tokens de index.css). A distinção também vem do traçado e do rótulo textual. */
export const RISK_COLORS: Record<RiskState, string> = {
  ok: '#22b573',
  attention: '#f4a100',
  severe: '#f0444b',
  unknown: '#8795a1',
};
