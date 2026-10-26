import { validateAssumptions, type CostAssumptions } from './cost';
import { parseNumberInput } from './format';

/** Texto digitado nos campos de premissa (vírgula ou ponto decimal). */
export interface AssumptionText {
  fuel: string;
  consumption: string;
  maintenance: string;
  vehicleValue: string;
  depreciation: string;
  capital: string;
  tolls: string;
  driver: string;
}

const LABELS: Record<Exclude<keyof AssumptionText, 'vehicleValue'>, string> = {
  fuel: 'Preço do combustível',
  consumption: 'Consumo',
  maintenance: 'Manutenção',
  depreciation: 'Depreciação',
  capital: 'Custo de capital',
  tolls: 'Pedágios',
  driver: 'Motorista',
};

/**
 * Converte o texto em premissas numéricas. Campo inválido vira mensagem (não cálculo silencioso):
 * o valor entra como 0 só para que o restante siga calculável, e `errors` impede exibir o custo.
 */
export function assumptionsFromText(t: AssumptionText, annualKm: number): { cost: CostAssumptions; errors: string[] } {
  const num = (s: string) => parseNumberInput(s);
  const raw = {
    fuel: num(t.fuel),
    consumption: num(t.consumption),
    maintenance: num(t.maintenance),
    depreciation: num(t.depreciation),
    capital: num(t.capital),
    tolls: num(t.tolls),
    driver: num(t.driver),
  };
  const vehicleValue = t.vehicleValue.trim() === '' ? null : num(t.vehicleValue);

  const errors: string[] = [];
  for (const key of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
    if (!Number.isFinite(raw[key])) errors.push(`${LABELS[key]} precisa ser um número.`);
  }
  if (vehicleValue !== null && !Number.isFinite(vehicleValue)) errors.push('Valor do veículo precisa ser um número.');

  const safe = (n: number) => (Number.isFinite(n) ? n : 0);
  const cost: CostAssumptions = {
    consumptionKmPerL: safe(raw.consumption),
    fuelPricePerL: safe(raw.fuel),
    vehicleValue: vehicleValue === null ? null : safe(vehicleValue),
    annualKm,
    depreciationPctYear: safe(raw.depreciation),
    capitalPctYear: safe(raw.capital),
    maintenancePerKm: safe(raw.maintenance),
    tollsBrl: safe(raw.tolls),
    driverPerHour: safe(raw.driver),
  };
  errors.push(...validateAssumptions(cost));
  if (vehicleValue !== null && Number.isFinite(vehicleValue) && vehicleValue < 0) {
    errors.push('Valor do veículo não pode ser negativo.');
  }
  return { cost, errors: [...new Set(errors)] };
}
