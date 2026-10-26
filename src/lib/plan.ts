import { computeCost, type CostAssumptions, type CostBreakdown } from './cost';
import { cumulativeM, samplePoints, sliceBetweenM } from './geo';
import { recommendedIndex } from './recommend';
import { assessTrip, buildAlerts, segmentStates, worstState, type PointForecast, type TripAlert, type TripSample } from './trip';
import type { LngLat, RiskState, RouteOption } from './types';

export interface RouteSegment {
  state: RiskState;
  coords: LngLat[];
}

export interface RoutePlan {
  route: RouteOption;
  distanceKm: number;
  /** Duração já ajustada pelo perfil do veículo (ver VehiclePreset.durationFactor). */
  durationS: number;
  samples: TripSample[];
  segments: RouteSegment[];
  worst: RiskState;
  alerts: TripAlert[];
  /** Amostras com previsão válida; zero significa que o clima não foi avaliado. */
  knownSamples: number;
  cost: CostBreakdown;
}

export interface PlanOptions {
  durationFactor: number;
  departureMs: number;
  /** Uma previsão por amostra da rota (mesma ordem de samplePoints); null = sem dados para aquele ponto. */
  forecasts: (PointForecast | null)[] | null;
  cost: CostAssumptions;
}

export function buildPlan(route: RouteOption, opts: PlanOptions): RoutePlan {
  const durationS = route.durationS * opts.durationFactor;
  const points = samplePoints(route.coordinates);
  const samples = assessTrip(points, opts.forecasts ?? points.map(() => null), opts.departureMs, durationS);
  const cum = cumulativeM(route.coordinates);
  const states = segmentStates(samples);
  const segments: RouteSegment[] = states.map((state, i) => {
    const from = samples[i]?.km ?? 0;
    const to = samples[i + 1]?.km ?? from;
    return { state, coords: sliceBetweenM(route.coordinates, cum, from * 1000, to * 1000) };
  });
  const distanceKm = route.distanceM / 1000;
  return {
    route,
    distanceKm,
    durationS,
    samples,
    segments,
    worst: worstState(samples),
    alerts: buildAlerts(samples),
    knownSamples: samples.filter((s) => s.risk.state !== 'unknown').length,
    cost: computeCost(distanceKm, durationS / 3600, opts.cost),
  };
}

/** Índice da rota recomendada entre os planos (critério em recommend.ts). */
export function recommendPlan(plans: RoutePlan[]): number {
  return recommendedIndex(
    plans.map((p) => ({ worstRisk: p.worst, totalCost: p.cost.total, durationS: p.durationS })),
  );
}

/** Quantas amostras ficaram sem previsão, em todas as rotas, para avisar que o risco está parcial. */
export function unknownShare(plans: RoutePlan[]): number {
  const total = plans.reduce((acc, p) => acc + p.samples.length, 0);
  const known = plans.reduce((acc, p) => acc + p.knownSamples, 0);
  return total === 0 ? 1 : 1 - known / total;
}
