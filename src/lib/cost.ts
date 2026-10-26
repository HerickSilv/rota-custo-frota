export interface CostAssumptions {
  consumptionKmPerL: number;
  fuelPricePerL: number;
  /** Valor de mercado do veículo (FIPE ou manual); null = custo de capital e depreciação não calculados. */
  vehicleValue: number | null;
  annualKm: number;
  depreciationPctYear: number;
  /** Custo de capital (a.a.): rendimento que o dinheiro imobilizado no veículo deixa de ter. */
  capitalPctYear: number;
  maintenancePerKm: number;
  tollsBrl: number;
  driverPerHour: number;
}

export interface CostBreakdown {
  liters: number;
  fuel: number;
  depreciation: number;
  capital: number;
  maintenance: number;
  tolls: number;
  driver: number;
  total: number;
  perKm: number;
}

export type CostKey = 'fuel' | 'depreciation' | 'capital' | 'maintenance' | 'tolls' | 'driver';
export const COST_KEYS: CostKey[] = ['fuel', 'depreciation', 'capital', 'maintenance', 'tolls', 'driver'];

/** Mensagens de validação em pt-BR; lista vazia = premissas utilizáveis. */
export function validateAssumptions(a: CostAssumptions): string[] {
  const errors: string[] = [];
  if (!(a.consumptionKmPerL > 0)) errors.push('Informe um consumo maior que zero (km/l).');
  if (!(a.fuelPricePerL > 0)) errors.push('Informe o preço do combustível (R$/l).');
  if (a.vehicleValue != null && !(a.annualKm > 0)) errors.push('Informe a quilometragem anual (km/ano).');
  for (const [label, v] of [
    ['Depreciação', a.depreciationPctYear],
    ['Custo de capital', a.capitalPctYear],
    ['Manutenção', a.maintenancePerKm],
    ['Pedágios', a.tollsBrl],
    ['Motorista', a.driverPerHour],
  ] as const) {
    if (!Number.isFinite(v) || v < 0) errors.push(`${label} não pode ser negativo.`);
  }
  return errors;
}

export function computeCost(distanceKm: number, durationH: number, a: CostAssumptions): CostBreakdown {
  const liters = a.consumptionKmPerL > 0 ? distanceKm / a.consumptionKmPerL : 0;
  const fuel = liters * a.fuelPricePerL;
  const vehicleValuePerKm = a.vehicleValue != null && a.annualKm > 0 ? a.vehicleValue / a.annualKm : 0;
  const depreciation = vehicleValuePerKm * (a.depreciationPctYear / 100) * distanceKm;
  const capital = vehicleValuePerKm * (a.capitalPctYear / 100) * distanceKm;
  const maintenance = a.maintenancePerKm * distanceKm;
  const tolls = a.tollsBrl;
  const driver = a.driverPerHour * durationH;
  const total = fuel + depreciation + capital + maintenance + tolls + driver;
  return {
    liters, fuel, depreciation, capital, maintenance, tolls, driver, total,
    perKm: distanceKm > 0 ? total / distanceKm : 0,
  };
}
