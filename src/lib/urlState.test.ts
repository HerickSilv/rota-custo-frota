import { describe, expect, it } from 'vitest';
import { parseUrlState, serializeUrlState, type UrlState } from './urlState';

const state: UrlState = {
  origin: { id: 'a', name: 'São Paulo', uf: 'SP', lat: -23.5475, lng: -46.63611, timezone: 'America/Sao_Paulo' },
  destination: { id: 'b', name: 'Rio de Janeiro', uf: 'RJ', lat: -22.90642, lng: -43.18223, timezone: 'America/Sao_Paulo' },
  vehicle: 'carreta',
  departure: '2026-10-27T06:30',
};

describe('urlState', () => {
  it('ida e volta preserva os dados', () => {
    const back = parseUrlState(serializeUrlState(state));
    expect(back.origin).toMatchObject({ name: 'São Paulo', uf: 'SP', timezone: 'America/Sao_Paulo' });
    expect(back.origin?.lat).toBeCloseTo(-23.5475, 4);
    expect(back.destination?.name).toBe('Rio de Janeiro');
    expect(back.vehicle).toBe('carreta');
    expect(back.departure).toBe('2026-10-27T06:30');
  });

  it('query vazia → tudo nulo', () => {
    expect(parseUrlState('')).toEqual({ origin: null, destination: null, vehicle: null, departure: null });
  });

  it('descarta coordenadas fora do intervalo ou malformadas', () => {
    const base = 'on=X&ot=America/Sao_Paulo';
    expect(parseUrlState(`o=99,10&${base}`).origin).toBeNull();
    expect(parseUrlState(`o=abc&${base}`).origin).toBeNull();
    expect(parseUrlState(`o=-23.5,-46.6&${base}`).origin).not.toBeNull();
  });

  it('descarta fuso inválido, veículo desconhecido e data malformada', () => {
    expect(parseUrlState('o=-23.5,-46.6&on=X&ot=Nao/Existe').origin).toBeNull();
    expect(parseUrlState('o=-23.5,-46.6&on=X&ot=javascript:alert(1)').origin).toBeNull();
    expect(parseUrlState('v=hacker').vehicle).toBeNull();
    expect(parseUrlState('t=amanha').departure).toBeNull();
  });

  it('nome muito longo ou vazio é recusado; UF inválida vira null mas mantém o local', () => {
    expect(parseUrlState(`o=-23.5,-46.6&on=${'x'.repeat(81)}&ot=America/Sao_Paulo`).origin).toBeNull();
    expect(parseUrlState('o=-23.5,-46.6&on=&ot=America/Sao_Paulo').origin).toBeNull();
    expect(parseUrlState('o=-23.5,-46.6&on=Lugar&ot=America/Sao_Paulo&ou=ZZ').origin?.uf).toBeNull();
  });
});
