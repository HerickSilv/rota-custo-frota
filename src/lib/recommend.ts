import { RISK_RANK } from './risk';
import type { RiskState } from './types';

export interface Rankable {
  worstRisk: RiskState;
  totalCost: number;
  durationS: number;
}

const CENT = 0.005;

/**
 * Critério da rota recomendada: primeiro o menor risco climático; entre as empatadas em risco, o menor custo total;
 * persistindo o empate, a mais rápida. Devolve o índice da recomendada.
 */
export function recommendedIndex(options: Rankable[]): number {
  let best = -1;
  options.forEach((o, i) => {
    const b = options[best];
    if (!b) {
      best = i;
      return;
    }
    const byRisk = RISK_RANK[o.worstRisk] - RISK_RANK[b.worstRisk];
    const byCost = o.totalCost - b.totalCost;
    const better =
      byRisk < 0 || (byRisk === 0 && (byCost < -CENT || (Math.abs(byCost) <= CENT && o.durationS < b.durationS)));
    if (better) best = i;
  });
  return Math.max(0, best);
}

export const RECOMMENDATION_CRITERION =
  'Menor risco climático; entre rotas com o mesmo risco, menor custo total; persistindo o empate, a mais rápida.';
