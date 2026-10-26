import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isAbort } from '../services/http';

export type AsyncState<T> =
  | { status: 'idle'; data?: undefined; error?: undefined; at?: undefined }
  | { status: 'loading'; data?: undefined; error?: undefined; at?: undefined }
  | { status: 'ready'; data: T; error?: undefined; at: number }
  | { status: 'error'; data?: undefined; error: string; at?: undefined };

/** Mensagem em pt-BR para exibir a qualquer erro vindo de um serviço externo. */
export function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Algo inesperado aconteceu.';
}

type Settled<T> = { token: string; result: Exclude<AsyncState<T>, { status: 'idle' | 'loading' }> };

/**
 * Executa `run` sempre que `key` muda (null = inativo), cancelando a chamada anterior.
 * `retry` refaz a chamada com a mesma chave. O estado "carregando" é derivado: um resultado só vale
 * para o token (chave + tentativa) que o gerou, então nunca aparece dado antigo como se fosse novo.
 */
export function useAsync<T>(key: string | null, run: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const runRef = useRef(run);
  const token = key === null ? null : `${key}#${attempt}`;

  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    if (token === null) return;
    const controller = new AbortController();
    runRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ token, result: { status: 'ready', data, at: Date.now() } });
      },
      (e: unknown) => {
        if (controller.signal.aborted || isAbort(e)) return;
        setSettled({ token, result: { status: 'error', error: messageOf(e) } });
      },
    );
    return () => controller.abort();
  }, [token]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  let current: AsyncState<T>;
  if (token === null) current = { status: 'idle' };
  else if (settled?.token === token) current = settled.result;
  else current = { status: 'loading' };
  return { ...current, retry };
}
