const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const NUM1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUM2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const brl = (n: number) => BRL.format(n);
export const num0 = (n: number) => NUM0.format(n);
export const num1 = (n: number) => NUM1.format(n);
export const num2 = (n: number) => NUM2.format(n);
export const km = (m: number) => `${NUM0.format(m / 1000)} km`;

/** 19800 s → "5 h 30 min"; abaixo de 1 h → "42 min". */
export function duration(seconds: number): string {
  const totalMin = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

/** "14:20" na hora de parede do fuso informado. */
export function clock(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(ms),
  );
}

/** "14h" (hora cheia) ou "14h20". */
export function clockShort(ms: number, timeZone: string): string {
  const [h = '00', m = '00'] = clock(ms, timeZone).split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function dayLabel(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit' }).format(
    new Date(ms),
  );
}

/** "R$ 60.320,00" (formato da tabela FIPE) → 60320. */
export function parseBrl(text: string): number | null {
  const cleaned = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return cleaned !== '' && Number.isFinite(n) ? n : null;
}

/** Texto digitado pelo usuário ("1.234,5" ou "1234.5") → número. */
export function parseNumberInput(text: string): number {
  const t = text.trim();
  if (t === '') return NaN;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(normalized);
}
