import type { z } from 'zod';

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'rate-limit' | 'invalid' | 'aborted';

/** Erro de uma API externa, com serviço e tipo para a interface montar uma mensagem útil. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly service: string;
  readonly status: number | undefined;

  constructor(kind: ApiErrorKind, service: string, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.service = service;
    this.status = status;
  }
}

export const isAbort = (e: unknown): boolean => e instanceof ApiError && e.kind === 'aborted';

interface RequestOptions {
  service: string;
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
}

/** fetch com timeout e erros tipados. Só chama hosts liberados na CSP (ver vite.config.ts). */
export async function request(url: string, { service, signal, timeoutMs = 15_000 }: RequestOptions): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    return await fetch(url, { signal: combined, headers: { Accept: 'application/json' } });
  } catch {
    if (signal?.aborted) throw new ApiError('aborted', service, 'Requisição cancelada.');
    if (timeout.aborted) throw new ApiError('timeout', service, `${service} demorou demais para responder.`);
    throw new ApiError('network', service, `Não foi possível falar com ${service}. Verifique sua conexão.`);
  }
}

export async function getJson<T>(url: string, schema: z.ZodType<T>, options: RequestOptions): Promise<T> {
  const res = await request(url, options);
  if (res.status === 429) {
    throw new ApiError('rate-limit', options.service, `${options.service} atingiu o limite de uso. Tente de novo em alguns minutos.`, 429);
  }
  if (!res.ok) {
    throw new ApiError('http', options.service, `${options.service} respondeu com erro ${res.status}.`, res.status);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('invalid', options.service, `${options.service} devolveu uma resposta ilegível.`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('invalid', options.service, `${options.service} devolveu dados em formato inesperado.`);
  }
  return parsed.data;
}
