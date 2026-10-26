import { describe, expect, it } from 'vitest';
import { computeCost, validateAssumptions, type CostAssumptions } from './cost';
import { recommendedIndex } from './recommend';

const base: CostAssumptions = {
  consumptionKmPerL: 10,
  fuelPricePerL: 6,
  vehicleValue: 100_000,
  annualKm: 50_000,
  depreciationPctYear: 10,
  capitalPctYear: 15,
  maintenancePerKm: 0.4,
  tollsBrl: 80,
  driverPerHour: 30,
};

describe('computeCost', () => {
  it('soma cada componente (400 km, 5 h)', () => {
    const c = computeCost(400, 5, base);
    expect(c.liters).toBe(40);
    expect(c.fuel).toBeCloseTo(240, 6);
    // valor/km rodado = 100000/50000 = R$ 2/km → depreciação 10% = 0,20/km, capital 15% = 0,30/km
    expect(c.depreciation).toBeCloseTo(80, 6);
    expect(c.capital).toBeCloseTo(120, 6);
    expect(c.maintenance).toBeCloseTo(160, 6);
    expect(c.tolls).toBe(80);
    expect(c.driver).toBeCloseTo(150, 6);
    expect(c.total).toBeCloseTo(240 + 80 + 120 + 160 + 80 + 150, 6);
    expect(c.perKm).toBeCloseTo(c.total / 400, 9);
  });

  it('sem valor do veículo não calcula depreciação nem capital', () => {
    const c = computeCost(400, 5, { ...base, vehicleValue: null });
    expect(c.depreciation).toBe(0);
    expect(c.capital).toBe(0);
  });

  it('distância zero não divide por zero', () => {
    expect(computeCost(0, 0, base).perKm).toBe(0);
  });
});

describe('validateAssumptions', () => {
  it('premissas completas são válidas', () => {
    expect(validateAssumptions(base)).toEqual([]);
  });

  it('consumo e preço obrigatórios', () => {
    const errs = validateAssumptions({ ...base, consumptionKmPerL: 0, fuelPricePerL: Number.NaN });
    expect(errs).toHaveLength(2);
  });

  it('valores negativos são recusados', () => {
    expect(validateAssumptions({ ...base, tollsBrl: -1 })).toEqual(['Pedágios não pode ser negativo.']);
  });

  it('km/ano só é exigido quando há valor do veículo', () => {
    expect(validateAssumptions({ ...base, vehicleValue: null, annualKm: 0 })).toEqual([]);
    expect(validateAssumptions({ ...base, annualKm: 0 })).toHaveLength(1);
  });
});

describe('recommendedIndex', () => {
  it('menor risco vence mesmo sendo mais caro', () => {
    const i = recommendedIndex([
      { worstRisk: 'severe', totalCost: 800, durationS: 3600 },
      { worstRisk: 'ok', totalCost: 950, durationS: 7200 },
    ]);
    expect(i).toBe(1);
  });

  it('empate em risco → menor custo; empate em custo → mais rápida', () => {
    expect(
      recommendedIndex([
        { worstRisk: 'ok', totalCost: 900, durationS: 3600 },
        { worstRisk: 'ok', totalCost: 850, durationS: 7200 },
      ]),
    ).toBe(1);
    expect(
      recommendedIndex([
        { worstRisk: 'ok', totalCost: 900, durationS: 7200 },
        { worstRisk: 'ok', totalCost: 900, durationS: 3600 },
      ]),
    ).toBe(1);
  });

  it('lista vazia devolve 0', () => {
    expect(recommendedIndex([])).toBe(0);
  });
});
