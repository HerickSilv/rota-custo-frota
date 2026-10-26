import { useId, useState } from 'react';
import { fipeBrands, fipeModels, fipePrice, fipeYears, type FipeItem, type FipeType, type FipePrice } from '../services/fipe';
import { useAsync } from '../hooks/useAsync';
import { brl } from '../lib/format';

interface Props {
  fipeType: FipeType;
  onUse: (value: number, label: string) => void;
}

/** Marca → modelo → ano (API Parallelum v2). Cada etapa só dispara quando a anterior está escolhida. */
export function FipePicker({ fipeType, onUse }: Props) {
  const uid = useId();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  const brands = useAsync(`brands:${fipeType}`, (s) => fipeBrands(fipeType, s));
  const models = useAsync(brand ? `models:${fipeType}:${brand}` : null, (s) => fipeModels(fipeType, brand, s));
  const years = useAsync(
    brand && model ? `years:${fipeType}:${brand}:${model}` : null,
    (s) => fipeYears(fipeType, brand, model, s),
  );
  const price = useAsync(
    brand && model && year ? `price:${fipeType}:${brand}:${model}:${year}` : null,
    (s) => fipePrice(fipeType, brand, model, year, s),
  );

  const select = (
    id: string,
    label: string,
    value: string,
    onValue: (v: string) => void,
    items: FipeItem[] | undefined,
    loading: boolean,
    disabled: boolean,
  ) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] text-asphalt-300">{label}</label>
      <select
        id={id}
        className="field pr-8"
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onValue(e.target.value)}
      >
        <option value="">{loading ? 'Carregando…' : 'Escolha…'}</option>
        {(items ?? []).map((it) => (
          <option key={it.code} value={it.code}>{it.name}</option>
        ))}
      </select>
    </div>
  );

  const priceData: FipePrice | undefined = brand && model && year && price.status === 'ready' ? price.data : undefined;

  return (
    <div className="space-y-3 rounded-[var(--radius-ui)] border border-asphalt-700 bg-asphalt-900/60 p-3">
      <p className="text-[12px] text-asphalt-300">
        Fonte: Tabela FIPE (API pública Parallelum). Limite de 500 consultas por dia por endereço IP.
      </p>
      {brands.status === 'error' && (
        <p role="alert" className="text-[13px] text-[var(--color-severe)]">
          {brands.error} Preencha o valor manualmente.
          <button type="button" className="ml-2 underline" onClick={brands.retry}>Tentar de novo</button>
        </p>
      )}
      {select(`${uid}-brand`, 'Marca', brand, (v) => { setBrand(v); setModel(''); setYear(''); }, brands.status === 'ready' ? brands.data : undefined, brands.status === 'loading', false)}
      {select(`${uid}-model`, 'Modelo', model, (v) => { setModel(v); setYear(''); }, models.status === 'ready' ? models.data : undefined, models.status === 'loading', !brand)}
      {select(`${uid}-year`, 'Ano-modelo', year, setYear, years.status === 'ready' ? years.data : undefined, years.status === 'loading', !model)}
      <div role="status" aria-live="polite" className="text-[13px]">
        {price.status === 'loading' && <span className="text-asphalt-300">Consultando a FIPE…</span>}
        {price.status === 'error' && <span className="text-[var(--color-severe)]">{price.error}</span>}
        {priceData && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-asphalt-200">
              {priceData.label}: <strong className="num text-[18px] text-white">{brl(priceData.value)}</strong>
              <span className="block text-[12px] text-asphalt-400">Referência FIPE: {priceData.referenceMonth}</span>
            </span>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onUse(priceData.value, `${priceData.label} (FIPE ${priceData.referenceMonth})`)}
            >
              Usar este valor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
