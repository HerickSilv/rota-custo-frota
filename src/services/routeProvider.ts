import { z } from 'zod';
import type { LngLat, RouteOption } from '../lib/types';
import { ApiError, request } from './http';

/**
 * Contrato de qualquer provedor de rotas. A interface existe para trocar o OSRM demo (sem SLA) por
 * OpenRouteService, Valhalla ou um OSRM próprio sem mexer no resto do app — ver docs/design.md.
 */
export interface RouteProvider {
  readonly name: string;
  route(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<RouteOption[]>;
}

const OsrmResponse = z.object({
  code: z.string(),
  message: z.string().optional(),
  routes: z
    .array(
      z.object({
        distance: z.number().positive(),
        duration: z.number().positive(),
        geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()]).rest(z.number())).min(2) }),
      }),
    )
    .optional(),
});

export const MAX_ROUTE_OPTIONS = 3;

export const osrmProvider: RouteProvider = {
  name: 'OSRM (servidor público de demonstração)',
  async route(from, to, signal) {
    const coords = `${from[0].toFixed(5)},${from[1].toFixed(5)};${to[0].toFixed(5)},${to[1].toFixed(5)}`;
    const url =
      `https://router.project-osrm.org/route/v1/driving/${coords}?` +
      new URLSearchParams({ alternatives: String(MAX_ROUTE_OPTIONS), overview: 'full', geometries: 'geojson', steps: 'false' });
    const res = await request(url, { service: 'Rotas (OSRM)', signal, timeoutMs: 25_000 });

    if (res.status === 429) {
      throw new ApiError('rate-limit', 'Rotas (OSRM)', 'O servidor público de rotas está limitando o uso. Tente de novo em instantes.', 429);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ApiError('invalid', 'Rotas (OSRM)', 'O serviço de rotas devolveu uma resposta ilegível.', res.status);
    }
    const parsed = OsrmResponse.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('invalid', 'Rotas (OSRM)', 'O serviço de rotas devolveu dados em formato inesperado.', res.status);
    }
    if (parsed.data.code === 'NoRoute' || (parsed.data.routes?.length ?? 0) === 0) {
      throw new ApiError('http', 'Rotas (OSRM)', 'Não há rota rodoviária entre esses dois pontos.', res.status);
    }
    if (!res.ok || parsed.data.code !== 'Ok') {
      throw new ApiError('http', 'Rotas (OSRM)', parsed.data.message ?? `O serviço de rotas respondeu com erro ${res.status}.`, res.status);
    }
    return (parsed.data.routes ?? [])
      .map((r, i): RouteOption => ({
        id: `r${i + 1}`,
        distanceM: r.distance,
        durationS: r.duration,
        coordinates: r.geometry.coordinates.map((c) => [c[0], c[1]] as LngLat),
      }))
      .sort((a, b) => a.durationS - b.durationS)
      .slice(0, MAX_ROUTE_OPTIONS)
      .map((r, i) => ({ ...r, id: `r${i + 1}` }));
  },
};
