import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FuelReferenceSchema, fuelPriceFor, ufFromStateName } from './fuel';
import { UFS } from './types';

const ref = FuelReferenceSchema.parse(JSON.parse(readFileSync('public/data/fuel-reference.json', 'utf8')));

describe('fuel-reference.json', () => {
  it('cobre as 27 UFs e passa no schema', () => {
    expect(Object.keys(ref.prices).sort()).toEqual([...UFS].sort());
  });

  it('semana de referência é uma semana completa (domingo a sábado)', () => {
    expect(new Date(`${ref.source.weekStart}T12:00:00Z`).getUTCDay()).toBe(0);
    expect(new Date(`${ref.source.weekEnd}T12:00:00Z`).getUTCDay()).toBe(6);
  });

  it('os valores batem com ordens de grandeza plausíveis (guarda contra erro de transcrição)', () => {
    for (const row of Object.values(ref.prices)) {
      expect(row.gasolina).toBeGreaterThan(5);
      expect(row.gasolina).toBeLessThan(8.5);
      expect(row.etanol).toBeGreaterThan(3);
      expect(row.etanol).toBeLessThan(6.5);
      expect(row.diesel).toBeGreaterThan(6);
      expect(row.diesel).toBeLessThan(8.5);
      expect(row.etanol).toBeLessThan(row.gasolina);
    }
  });
});

describe('fuelPriceFor', () => {
  it('média entre origem e destino', () => {
    const p = fuelPriceFor(ref, 'gasolina', 'SP', 'RJ');
    expect(p.scope).toBe('uf');
    expect(p.price).toBeCloseTo((6.34 + 6.53) / 2, 2);
    expect(p.basis).toEqual(['São Paulo/SP', 'Rio de Janeiro/RJ']);
  });

  it('mesma UF não conta duas vezes', () => {
    expect(fuelPriceFor(ref, 'diesel', 'SP', 'SP').price).toBe(7.24);
  });

  it('só uma UF conhecida usa ela', () => {
    expect(fuelPriceFor(ref, 'etanol', null, 'MT').price).toBe(4.22);
  });

  it('nenhuma UF conhecida → média nacional', () => {
    const p = fuelPriceFor(ref, 'gasolina', null, null);
    expect(p).toEqual({ price: ref.national.gasolina, basis: ['Brasil'], scope: 'nacional' });
  });
});

describe('ufFromStateName', () => {
  it.each([
    ['São Paulo', 'SP'],
    ['sao paulo', 'SP'],
    ['Paraná', 'PR'],
    ['Pará', 'PA'],
    ['Federal District', 'DF'],
    ['Distrito Federal', 'DF'],
    ['Espírito Santo', 'ES'],
    ['Mato Grosso do Sul', 'MS'],
    ['Rio Grande do Norte', 'RN'],
  ])('%s → %s', (name, uf) => {
    expect(ufFromStateName(name)).toBe(uf);
  });

  it('desconhecido ou vazio → null', () => {
    expect(ufFromStateName('Texas')).toBeNull();
    expect(ufFromStateName(undefined)).toBeNull();
  });

  it('todos os 26 estados + DF são resolvidos pelos nomes oficiais', () => {
    const names = ['Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás',
      'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí',
      'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo',
      'Sergipe', 'Tocantins'];
    const resolved = names.map((n) => ufFromStateName(n));
    expect(resolved.every((u) => u !== null)).toBe(true);
    expect(new Set(resolved).size).toBe(27);
  });
});
