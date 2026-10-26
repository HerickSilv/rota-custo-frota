import type { FuelKind } from './types';

export interface VehiclePreset {
  id: string;
  label: string;
  example: string;
  fuel: FuelKind;
  /** Consumo típico em carga normal (km/l). Estimativa editável, não é dado oficial. */
  consumptionKmPerL: number;
  /** Multiplicador sobre a duração do OSRM (perfil de carro): veículos pesados andam mais devagar. */
  durationFactor: number;
  /** Manutenção + pneus (R$/km). Estimativa editável, não é dado oficial. */
  maintenancePerKm: number;
  annualKm: number;
  fipeType: 'cars' | 'trucks';
}

export const VEHICLE_PRESETS: VehiclePreset[] = [
  { id: 'utilitario', label: 'Utilitário compacto', example: 'tipo Fiorino / Strada', fuel: 'gasolina', consumptionKmPerL: 11, durationFactor: 1.0, maintenancePerKm: 0.25, annualKm: 40_000, fipeType: 'cars' },
  { id: 'van', label: 'Van de carga', example: 'tipo Sprinter / Master', fuel: 'diesel', consumptionKmPerL: 9, durationFactor: 1.1, maintenancePerKm: 0.35, annualKm: 50_000, fipeType: 'cars' },
  { id: 'vuc', label: 'VUC (caminhão urbano)', example: 'até 6 t', fuel: 'diesel', consumptionKmPerL: 6.5, durationFactor: 1.2, maintenancePerKm: 0.5, annualKm: 50_000, fipeType: 'trucks' },
  { id: 'toco', label: 'Caminhão 3/4 e toco', example: 'tipo Delivery / Accelo', fuel: 'diesel', consumptionKmPerL: 5.5, durationFactor: 1.3, maintenancePerKm: 0.7, annualKm: 60_000, fipeType: 'trucks' },
  { id: 'carreta', label: 'Carreta (cavalo + semirreboque)', example: '6x2 / 6x4, ~ 45 t', fuel: 'diesel', consumptionKmPerL: 2.4, durationFactor: 1.4, maintenancePerKm: 1.1, annualKm: 120_000, fipeType: 'trucks' },
];

export const VEHICLE_IDS = VEHICLE_PRESETS.map((v) => v.id);

export function presetById(id: string): VehiclePreset {
  return VEHICLE_PRESETS.find((v) => v.id === id) ?? (VEHICLE_PRESETS[0] as VehiclePreset);
}
