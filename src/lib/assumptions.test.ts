import { describe, expect, it } from 'vitest';
import { assumptionsFromText, type AssumptionText } from './assumptions';

const base: AssumptionText = {
  fuel: '6,53',
  consumption: '11',
  maintenance: '0,25',
  vehicleValue: '',
  depreciation: '15',
  capital: '14,25',
  tolls: '0',
  driver: '30',
};

describe('assumptionsFromText', () => {
  it('converte vírgula decimal e deixa valor do veículo nulo quando vazio', () => {
    const { cost, errors } = assumptionsFromText(base, 40_000);
    expect(errors).toEqual([]);
    expect(cost.fuelPricePerL).toBeCloseTo(6.53, 6);
    expect(cost.capitalPctYear).toBeCloseTo(14.25, 6);
    expect(cost.vehicleValue).toBeNull();
    expect(cost.annualKm).toBe(40_000);
  });

  it('texto inválido gera mensagem e não entra como número', () => {
    const { errors } = assumptionsFromText({ ...base, consumption: 'abc' }, 40_000);
    expect(errors.some((e) => e.startsWith('Consumo precisa ser um número'))).toBe(true);
    expect(errors.some((e) => e.includes('NaN'))).toBe(false);
  });

  it('valor do veículo negativo é recusado', () => {
    const { errors } = assumptionsFromText({ ...base, vehicleValue: '-5000' }, 40_000);
    expect(errors).toContain('Valor do veículo não pode ser negativo.');
  });

  it('consumo zero impede o cálculo', () => {
    const { errors } = assumptionsFromText({ ...base, consumption: '0' }, 40_000);
    expect(errors.length).toBeGreaterThan(0);
  });
});
