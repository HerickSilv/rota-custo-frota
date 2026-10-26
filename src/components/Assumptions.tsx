import type { ReactNode } from 'react';
import type { VehiclePreset } from '../lib/vehicles';
import type { FipeType } from '../services/fipe';
import { FipePicker } from './FipePicker';

export type AssumptionKey = 'fuel' | 'consumption' | 'maintenance' | 'vehicleValue' | 'depreciation' | 'capital' | 'tolls' | 'driver';

export type AssumptionValues = Record<AssumptionKey, string>;
export type AssumptionHints = Partial<Record<AssumptionKey, ReactNode>>;

interface Props {
  vehicle: VehiclePreset;
  values: AssumptionValues;
  hints: AssumptionHints;
  errors: string[];
  edited: Set<AssumptionKey>;
  onChange: (key: AssumptionKey, value: string) => void;
  onReset: () => void;
  onFipeUse: (value: number, label: string) => void;
  fuelLabel: string;
}

function Field({ id, label, hint, children, edited }: { id: string; label: string; hint: ReactNode; children: ReactNode; edited: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
      <label htmlFor={id} className="pt-2 text-[13px] text-asphalt-200">
        {label}
        {edited && <span className="ml-2 text-[11px] uppercase tracking-wider text-[var(--color-sign-soft)]">editado</span>}
      </label>
      <div className="w-[120px]">{children}</div>
      <p id={`${id}-hint`} className="col-span-2 text-[12px] leading-snug text-asphalt-400">{hint}</p>
    </div>
  );
}

export function Assumptions({ vehicle, values, hints, errors, edited, onChange, onReset, onFipeUse, fuelLabel }: Props) {
  const input = (key: AssumptionKey, id: string, label: string, suffix?: string) => (
    <Field id={id} label={label} hint={hints[key]} edited={edited.has(key)}>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="field num pr-12 text-right text-[16px]"
          value={values[key]}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(key, e.target.value)}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[12px] text-asphalt-400">{suffix}</span>}
      </div>
    </Field>
  );

  const fipeType: FipeType = vehicle.fipeType;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-asphalt-300">Cada número tem origem. Campos editados aparecem marcados.</p>
        <button type="button" className="btn-ghost shrink-0" onClick={onReset} disabled={edited.size === 0}>
          Restaurar padrões
        </button>
      </div>

      <section aria-labelledby="ass-fuel" className="space-y-4">
        <h3 id="ass-fuel" className="section-title text-[14px]">Combustível e consumo</h3>
        {input('fuel', 'ass-fuel-price', `Preço (${fuelLabel})`, 'R$/l')}
        {input('consumption', 'ass-consumption', 'Consumo', 'km/l')}
      </section>

      <section aria-labelledby="ass-capital" className="space-y-4">
        <h3 id="ass-capital" className="section-title text-[14px]">Veículo e capital</h3>
        {input('vehicleValue', 'ass-value', 'Valor de mercado', 'R$')}
        <FipePicker fipeType={fipeType} onUse={onFipeUse} />
        {input('depreciation', 'ass-depr', 'Depreciação', '% a.a.')}
        {input('capital', 'ass-capital-rate', 'Custo de capital', '% a.a.')}
      </section>

      <section aria-labelledby="ass-trip" className="space-y-4">
        <h3 id="ass-trip" className="section-title text-[14px]">Viagem</h3>
        {input('maintenance', 'ass-maint', 'Manutenção e pneus', 'R$/km')}
        {input('tolls', 'ass-tolls', 'Pedágios', 'R$')}
        {input('driver', 'ass-driver', 'Motorista', 'R$/h')}
      </section>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-[var(--radius-ui)] border border-[var(--color-severe)] p-3 text-[13px] text-asphalt-100">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
