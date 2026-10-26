import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, RotateCw } from 'lucide-react';
import { Assumptions, type AssumptionHints, type AssumptionKey, type AssumptionValues } from './components/Assumptions';
import { CostBreakdown } from './components/CostBreakdown';
import { RISK_COLORS } from './components/riskColors';
import { PlaceField } from './components/PlaceField';
import { RiskBadge } from './components/RiskBadge';
import { RiskTimeline } from './components/RiskTimeline';
import { RouteList } from './components/RouteList';
import { useAsync, messageOf } from './hooks/useAsync';
import { assumptionsFromText } from './lib/assumptions';
import { brl, clock, num0, num1 } from './lib/format';
import { FUEL_LABEL, fuelPriceFor, type FuelPrice } from './lib/fuel';
import { samplePoints } from './lib/geo';
import { buildPlan, recommendPlan, type RoutePlan } from './lib/plan';
import { RISK_LABEL } from './lib/risk';
import { DAY_MS, FORECAST_MAX_DAYS, HOUR_MS, msToZonedLocal, zonedLocalToMs } from './lib/time';
import type { PointForecast } from './lib/trip';
import { parseUrlState, serializeUrlState } from './lib/urlState';
import { VEHICLE_PRESETS, presetById, type VehiclePreset } from './lib/vehicles';
import type { Place, RiskState } from './lib/types';
import { ApiError } from './services/http';
import { loadFuelReference } from './services/fuelData';
import { fetchSelicTarget, type SelicTarget } from './services/selic';
import { osrmProvider } from './services/routeProvider';
import { fetchForecasts, forecastDaysFor } from './services/weather';

/** Pedido já enviado pelo formulário: é ele que alimenta rotas, previsão e a URL. */
interface Trip {
  origin: Place;
  destination: Place;
  vehicleId: string;
  departure: string;
  departureMs: number;
}

interface FormState {
  origin: Place | null;
  destination: Place | null;
  vehicleId: string;
  departure: string;
}

type Sheet = 'peek' | 'half' | 'full';
const SHEET_ORDER: Sheet[] = ['peek', 'half', 'full'];
/** MapLibre (~1 MB) vai em chunk próprio: o painel aparece antes do mapa. */
const MapView = lazy(() => import('./components/MapView'));

const DEFAULT_TZ = 'America/Sao_Paulo';
const DEPRECIATION_DEFAULT = '15';
const DRIVER_DEFAULT = '30';

const routeKeyOf = (t: Trip) => `${t.origin.lat},${t.origin.lng}>${t.destination.lat},${t.destination.lng}`;
const forecastKeyOf = (t: Trip, factor: number) => `${routeKeyOf(t)}|${t.departureMs}|${factor}`;
const dmy = (iso: string) => iso.split('-').reverse().join('/');
/** Número em campo de texto sem separador de milhar: "6,53" (o parser aceita vírgula). */
const toField = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** Próxima hora cheia no fuso da origem: padrão quando a saída não foi informada. */
function defaultDeparture(tz: string): string {
  return msToZonedLocal(Math.floor(Date.now() / HOUR_MS) * HOUR_MS + HOUR_MS, tz);
}

/** Premissas em texto: o rascunho do usuário sobrepõe os padrões. Função pura para o memo ser estável. */
function valuesFrom(
  draft: Partial<AssumptionValues>,
  defaults: Pick<AssumptionValues, 'fuel' | 'consumption' | 'maintenance' | 'capital'>,
): AssumptionValues {
  return {
    fuel: draft.fuel ?? defaults.fuel,
    consumption: draft.consumption ?? defaults.consumption,
    maintenance: draft.maintenance ?? defaults.maintenance,
    vehicleValue: draft.vehicleValue ?? '',
    depreciation: draft.depreciation ?? DEPRECIATION_DEFAULT,
    capital: draft.capital ?? defaults.capital,
    tolls: draft.tolls ?? '0',
    driver: draft.driver ?? DRIVER_DEFAULT,
  };
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function initialForm(): FormState {
  const url = parseUrlState(window.location.search);
  return {
    origin: url.origin,
    destination: url.destination,
    vehicleId: presetById(url.vehicle ?? 'utilitario').id,
    departure: url.departure ?? '',
  };
}

function tripFrom(form: FormState): Trip | null {
  const { origin, destination } = form;
  if (!origin || !destination || origin.id === destination.id) return null;
  const departure = form.departure || defaultDeparture(origin.timezone);
  const departureMs = zonedLocalToMs(departure, origin.timezone);
  if (!Number.isFinite(departureMs)) return null;
  return { origin, destination, vehicleId: form.vehicleId, departure, departureMs };
}

const RISK_LEGEND: { state: RiskState; text: string }[] = [
  { state: 'ok', text: RISK_LABEL.ok },
  { state: 'attention', text: RISK_LABEL.attention },
  { state: 'severe', text: RISK_LABEL.severe },
  { state: 'unknown', text: 'Sem previsão (tracejado)' },
];

export function App() {
  const isDesktop = useMedia('(min-width: 768px)');
  // Relógio da sessão: a previsão e os avisos de horário são calculados a partir do momento de abertura.
  const [mountedAt] = useState(() => Date.now());
  const [form, setForm] = useState<FormState>(initialForm);
  const [trip, setTrip] = useState<Trip | null>(() => tripFrom(form));
  const [formError, setFormError] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<AssumptionValues>>({});
  const [vehicleLabel, setVehicleLabel] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<{ lng: number; lat: number } | null>(null);
  // Viagem vinda da URL abre com o resultado visível no celular; sem viagem, a folha começa recolhida.
  const [sheet, setSheet] = useState<Sheet>(() => (trip ? 'half' : 'peek'));

  // Referências com dados reais (uma vez).
  const fuelRef = useAsync('fuel-reference', (s) => loadFuelReference(s));
  const selic = useAsync<SelicTarget>('selic', (s) => fetchSelicTarget(s));

  // Rotas: só trocam quando a origem ou o destino enviados mudam.
  const routeKey = trip ? routeKeyOf(trip) : null;
  const routes = useAsync(routeKey, (signal) => {
    if (!trip) return Promise.reject(new Error('Sem origem e destino.'));
    const key = routeKeyOf(trip);
    return osrmProvider
      .route([trip.origin.lng, trip.origin.lat], [trip.destination.lng, trip.destination.lat], signal)
      .then((options) => ({ key, options }));
  });
  const routesData = routes.status === 'ready' && routes.data.key === routeKey ? routes.data : undefined;

  const vehicleId = trip?.vehicleId ?? form.vehicleId;
  const vehicle: VehiclePreset = useMemo(() => presetById(vehicleId), [vehicleId]);
  const factor = vehicle.durationFactor;

  // Previsão: uma chamada por rota. Falha de uma rota vira "sem previsão" nela, sem derrubar as outras.
  const forecastKey = trip && routesData ? forecastKeyOf(trip, factor) : null;
  const forecasts = useAsync(forecastKey, async (signal) => {
    if (!trip || !routesData) throw new Error('Rotas ainda não carregadas.');
    const key = forecastKeyOf(trip, factor);
    const results = await Promise.allSettled(
      routesData.options.map((o) => {
        const days = forecastDaysFor(Date.now(), trip.departureMs + o.durationS * factor * 1000);
        return fetchForecasts(samplePoints(o.coordinates), days, signal);
      }),
    );
    if (signal.aborted) throw new ApiError('aborted', 'Previsão do tempo', 'Cancelado.');
    let error: string | null = null;
    const perRoute: (PointForecast[] | null)[] = results.map((r) => {
      if (r.status === 'fulfilled') return r.value;
      error ??= messageOf(r.reason);
      return null;
    });
    return { key, perRoute, error };
  });
  const forecastData = forecasts.status === 'ready' && forecasts.data.key === forecastKey ? forecasts.data : undefined;
  const riskPending = routesData !== undefined && forecastData === undefined && forecasts.status !== 'error';

  // Premissas: o padrão vem da origem (ANP, Selic, preset); o rascunho guarda só o que foi editado.
  const fuelData = fuelRef.status === 'ready' ? fuelRef.data : undefined;
  const originUf = trip?.origin.uf ?? null;
  const destinationUf = trip?.destination.uf ?? null;
  const fuelPrice: FuelPrice | null = useMemo(
    () => (fuelData ? fuelPriceFor(fuelData, vehicle.fuel, originUf, destinationUf) : null),
    [fuelData, vehicle.fuel, originUf, destinationUf],
  );
  const fuelDefault = fuelPrice ? toField(fuelPrice.price) : '';
  const consumptionDefault = toField(vehicle.consumptionKmPerL);
  const maintenanceDefault = toField(vehicle.maintenancePerKm);
  const annualKm = vehicle.annualKm;
  const capitalDefault = selic.status === 'ready' ? toField(selic.data.ratePct) : '0';

  const values = useMemo(
    () => valuesFrom(draft, { fuel: fuelDefault, consumption: consumptionDefault, maintenance: maintenanceDefault, capital: capitalDefault }),
    [draft, fuelDefault, consumptionDefault, maintenanceDefault, capitalDefault],
  );
  const edited = new Set(Object.keys(draft) as AssumptionKey[]);
  const assumptions = useMemo(() => assumptionsFromText(values, annualKm), [values, annualKm]);
  const costAssumptions = assumptions.cost;
  const costErrors = assumptions.errors;
  const costValid = costErrors.length === 0;

  const plans: RoutePlan[] = useMemo(() => {
    if (!trip || !routesData) return [];
    return routesData.options.map((o, i) =>
      buildPlan(o, {
        durationFactor: factor,
        departureMs: trip.departureMs,
        forecasts: forecastData?.perRoute[i] ?? null,
        cost: costAssumptions,
      }),
    );
  }, [trip, routesData, forecastData, factor, costAssumptions]);

  const recommended = useMemo(() => recommendPlan(plans), [plans]);
  const selected = pick !== null && pick < plans.length ? pick : recommended;
  const plan = plans[selected];
  const tz = trip?.origin.timezone ?? DEFAULT_TZ;

  // URL compartilhável: reflete o último pedido enviado (e é validada com Zod ao abrir).
  useEffect(() => {
    const qs = trip
      ? serializeUrlState({ origin: trip.origin, destination: trip.destination, vehicle: trip.vehicleId, departure: trip.departure })
      : '';
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [trip]);

  const formDirty =
    trip !== null &&
    (form.origin?.id !== trip.origin.id ||
      form.destination?.id !== trip.destination.id ||
      form.vehicleId !== trip.vehicleId ||
      (form.departure || trip.departure) !== trip.departure);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.origin || !form.destination) {
      setFormError('Escolha a origem e o destino na lista de cidades.');
      return;
    }
    if (form.origin.id === form.destination.id) {
      setFormError('Origem e destino são o mesmo lugar.');
      return;
    }
    const next = tripFrom(form);
    if (!next) {
      setFormError('Informe uma data e hora de saída válidas.');
      return;
    }
    setFormError(null);
    setPick(null);
    setHighlight(null);
    setTrip(next);
    setSheet('half');
  };

  // Enquadramento: no desktop o painel ocupa 420 px à esquerda; no mobile, a folha embaixo.
  const sheetBottom =
    sheet === 'peek' ? 96 : sheet === 'half' ? Math.round(window.innerHeight * 0.56) + 12 : window.innerHeight - 56;
  const padding = isDesktop
    ? { top: 32, right: 32, bottom: 32, left: 452 }
    : { top: 24, right: 24, bottom: sheetBottom, left: 24 };

  const departureWarning = (() => {
    if (!trip) return null;
    if (trip.departureMs < mountedAt - HOUR_MS) return 'A saída está no passado: a previsão não se aplica a esse horário.';
    if (trip.departureMs > mountedAt + FORECAST_MAX_DAYS * DAY_MS) {
      return 'A previsão cobre até 16 dias. Depois disso o risco fica como sem previsão.';
    }
    return null;
  })();

  const nextSheet = () => setSheet(SHEET_ORDER[(SHEET_ORDER.indexOf(sheet) + 1) % SHEET_ORDER.length] ?? 'peek');

  const hints: AssumptionHints = {
    fuel:
      fuelRef.status === 'error'
        ? 'Referência ANP indisponível: informe o preço.'
        : fuelPrice && fuelRef.status === 'ready'
          ? `${fuelPrice.scope === 'uf' ? `Média de ${fuelPrice.basis.join(' e ')}` : 'Média nacional'}, ANP, semana de ${dmy(fuelRef.data.source.weekStart)} a ${dmy(fuelRef.data.source.weekEnd)}. Editável.`
          : 'Carregando a referência de preços da ANP…',
    consumption: 'Típico do tipo de veículo: estimativa, não dado oficial. Editável.',
    maintenance: 'Estimativa por tipo de veículo, não dado oficial. Editável.',
    vehicleValue: vehicleLabel ? `Fonte: ${vehicleLabel}` : 'Opcional. Sem valor, depreciação e custo de capital ficam fora do total.',
    depreciation: 'Premissa editável, não dado oficial.',
    capital:
      selic.status === 'ready'
        ? `Meta Selic ${toField(selic.data.ratePct)}% a.a. (Banco Central), vigente desde ${dmy(selic.data.date)}. Editável.`
        : selic.status === 'error'
          ? 'Selic indisponível: informe a taxa.'
          : 'Carregando a meta Selic do Banco Central…',
    tolls: 'Entrada manual. Não há fonte pública confiável de pedágio. Zero significa não incluído.',
    driver: 'Premissa editável, não dado oficial.',
  };

  const notes: Partial<Record<'fuel' | 'depreciation' | 'capital' | 'tolls', string>> = {
    tolls: 'Manual, sem fonte automática',
  };
  if (plan && costValid) {
    notes.fuel = `${num1(plan.cost.liters)} l de ${FUEL_LABEL[vehicle.fuel].toLowerCase()}`;
    if (values.vehicleValue.trim() === '') {
      notes.depreciation = 'Informe o valor do veículo';
      notes.capital = 'Informe o valor do veículo';
    }
  }

  const sourceRows: { label: string; value: string; at?: number }[] = [
    { label: 'Rotas', value: osrmProvider.name, at: routes.status === 'ready' ? routes.at : undefined },
    { label: 'Previsão do tempo', value: 'Open-Meteo', at: forecasts.status === 'ready' ? forecasts.at : undefined },
    {
      label: 'Combustível',
      value:
        fuelRef.status === 'ready'
          ? `${fuelRef.data.source.name} (${dmy(fuelRef.data.source.weekStart)} a ${dmy(fuelRef.data.source.weekEnd)})`
          : 'ANP (referência)',
    },
    {
      label: 'Custo de capital',
      value: selic.status === 'ready' ? `Selic, Banco Central (SGS 432), vigente desde ${dmy(selic.data.date)}` : 'Selic, Banco Central',
    },
  ];

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0 md:left-[420px]">
        <Suspense fallback={<div className="grid h-full place-items-center text-[13px] text-asphalt-400">Carregando o mapa…</div>}>
          <MapView
            plans={plans}
            selected={selected}
            origin={trip?.origin ?? null}
            destination={trip?.destination ?? null}
            highlight={highlight}
            padding={padding}
          />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-10 hidden max-w-[300px] rounded-[var(--radius-ui)] bg-asphalt-900/90 px-3 py-2 text-[12px] text-asphalt-100 shadow-[var(--shadow-panel)] md:left-[436px] md:block">
        <p className="mb-1.5 font-medium text-asphalt-300">Risco climático, no horário de cada trecho</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {RISK_LEGEND.map((item) => (
            <li key={item.state} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-5 rounded-full"
                style={{ background: item.state === 'unknown' ? `repeating-linear-gradient(90deg, ${RISK_COLORS.unknown} 0 4px, transparent 4px 7px)` : RISK_COLORS[item.state] }}
              />
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      <aside
        aria-label="Planejamento da viagem"
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden border-t border-asphalt-700 bg-asphalt-900 shadow-[var(--shadow-panel)] transition-[height] duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none md:inset-y-0 md:left-0 md:right-auto md:h-full md:w-[420px] md:border-r md:border-t-0 ${
          sheet === 'peek' ? 'h-[92px]' : sheet === 'half' ? 'h-[56dvh]' : 'h-[calc(100dvh-56px)]'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-asphalt-800 px-4 py-3">
          <div className="min-w-0">
            <h1 className="section-title truncate text-[20px]">Rota &amp; Custo de Frota</h1>
            <p className="truncate text-[12px] text-asphalt-400">
              {plan && costValid
                ? `${brl(plan.cost.total)} · ${num0(plan.route.distanceM / 1000)} km · ${RISK_LABEL[plan.worst]}`
                : 'Planejador de viagem com dados públicos'}
            </p>
          </div>
          <button type="button" className="btn-ghost shrink-0 md:hidden" onClick={nextSheet} aria-label={sheet === 'full' ? 'Recolher painel' : 'Expandir painel'}>
            {sheet === 'full' ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
            {sheet === 'full' ? 'Recolher' : 'Expandir'}
          </button>
        </header>

        <div className="panel-scroll min-h-0 flex-1 space-y-7 overflow-y-auto px-4 py-5">
          <form onSubmit={submit} noValidate className="space-y-4" aria-label="Dados da viagem">
            <PlaceField label="Origem" value={form.origin} onChange={(origin) => setForm((f) => ({ ...f, origin }))} />
            <PlaceField label="Destino" value={form.destination} onChange={(destination) => setForm((f) => ({ ...f, destination }))} />
            <div className="grid gap-4">
              <div>
                <label htmlFor="veh" className="mb-1.5 block text-[12px] font-medium tracking-wide text-asphalt-300">Veículo</label>
                <select
                  id="veh"
                  className="field pr-8"
                  value={form.vehicleId}
                  onChange={(e) => {
                    const vehicleId = e.target.value;
                    setForm((f) => ({ ...f, vehicleId }));
                    // Consumo e manutenção dependem do tipo de veículo: troca o preset, descarta a edição manual.
                    setDraft((d) => ({ ...d, consumption: undefined, maintenance: undefined }));
                  }}
                >
                  {VEHICLE_PRESETS.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[12px] text-asphalt-400">{vehicle.example} · {FUEL_LABEL[vehicle.fuel]}</p>
              </div>
              <div>
                <label htmlFor="dep" className="mb-1.5 block text-[12px] font-medium tracking-wide text-asphalt-300">Saída (hora local)</label>
                <input
                  id="dep"
                  type="datetime-local"
                  className="field num"
                  value={form.departure || (form.origin ? defaultDeparture(form.origin.timezone) : '')}
                  onChange={(e) => setForm((f) => ({ ...f, departure: e.target.value }))}
                />
              </div>
            </div>
            {formError && <p role="alert" className="text-[13px] text-[var(--color-severe)]">{formError}</p>}
            {formDirty && <p className="text-[12px] text-[var(--color-attention)]">Alterações do formulário ainda não calculadas.</p>}
            <button type="submit" className="btn-primary w-full" disabled={routes.status === 'loading'}>
              {routes.status === 'loading' ? 'Calculando…' : 'Calcular viagem'}
            </button>
          </form>

          {!trip && (
            <p className="text-[13px] leading-relaxed text-asphalt-300">
              Escolha origem e destino. O resultado traz até três rotas, o risco climático no horário em que o veículo passa em cada trecho e o custo da viagem.
            </p>
          )}

          {trip && routes.status === 'loading' && (
            <div aria-busy="true" className="space-y-2" role="status">
              <p className="text-[13px] text-asphalt-300">Buscando rotas…</p>
              <div className="h-14 animate-pulse rounded-[var(--radius-ui)] bg-asphalt-800 motion-reduce:animate-none" />
              <div className="h-14 animate-pulse rounded-[var(--radius-ui)] bg-asphalt-800 motion-reduce:animate-none" />
            </div>
          )}

          {trip && routes.status === 'error' && (
            <div role="alert" className="space-y-2 rounded-[var(--radius-ui)] border border-[var(--color-severe)] p-3 text-[13px]">
              <p>{routes.error}</p>
              <button type="button" className="btn-ghost" onClick={routes.retry}>
                <RotateCw size={14} aria-hidden="true" /> Tentar de novo
              </button>
            </div>
          )}

          {departureWarning && <p className="text-[13px] text-[var(--color-attention)]">{departureWarning}</p>}

          {plans.length > 0 && plan && (
            <section aria-labelledby="res-routes" className="space-y-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="res-routes" className="section-title">Rotas</h2>
                {routes.status === 'ready' && routes.at && (
                  <span className="text-[12px] text-asphalt-400">atualizado às {clock(routes.at, DEFAULT_TZ)}</span>
                )}
              </div>
              <RouteList
                plans={plans}
                selected={selected}
                recommended={recommended}
                originTz={tz}
                costValid={costValid}
                riskPending={riskPending}
                onSelect={(i) => {
                  setPick(i);
                  setHighlight(null);
                }}
              />

              {forecasts.status === 'error' && (
                <div role="alert" className="space-y-2 rounded-[var(--radius-ui)] border border-[var(--color-attention)] p-3 text-[13px]">
                  <p>Previsão indisponível: o custo continua válido, o risco não foi avaliado. {forecasts.error}</p>
                  <button type="button" className="btn-ghost" onClick={forecasts.retry}>
                    <RotateCw size={14} aria-hidden="true" /> Tentar de novo
                  </button>
                </div>
              )}
              {forecastData?.error && (
                <p className="text-[13px] text-[var(--color-attention)]">
                  Parte da previsão falhou ({forecastData.error}). Os trechos afetados aparecem como sem previsão.
                </p>
              )}
              {riskPending && forecasts.status === 'loading' && (
                <p role="status" className="text-[13px] text-asphalt-300">Consultando a previsão do tempo nos pontos da rota…</p>
              )}

              <div className="space-y-3">
                <h3 className="section-title text-[14px]">Custo da viagem</h3>
                {costValid ? (
                  <CostBreakdown cost={plan.cost} distanceKm={plan.distanceKm} notes={notes} />
                ) : (
                  <div role="alert" className="rounded-[var(--radius-ui)] border border-[var(--color-severe)] p-3 text-[13px]">
                    Corrija as premissas abaixo para ver o custo. {costErrors[0]}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="section-title text-[14px]">Risco ao longo da rota</h3>
                  {!riskPending && <RiskBadge state={plan.worst} compact />}
                </div>
                {riskPending ? (
                  <p className="text-[13px] text-asphalt-300">Previsão em consulta.</p>
                ) : (
                  <RiskTimeline plan={plan} originTz={tz} onHover={setHighlight} />
                )}
              </div>
            </section>
          )}

          {trip && (
            <details className="rounded-[var(--radius-ui)] border border-asphalt-700 bg-asphalt-900/50 p-4" open={plans.length === 0}>
              <summary className="cursor-pointer list-none">
                <span className="section-title text-[14px]">Premissas de custo</span>
                <span className="ml-2 text-[12px] text-asphalt-400">
                  {edited.size > 0 ? `${edited.size} ${edited.size > 1 ? 'editadas' : 'editada'}` : 'valores padrão'}
                </span>
              </summary>
              <div className="mt-4">
                <Assumptions
                  vehicle={vehicle}
                  values={values}
                  hints={hints}
                  errors={costErrors}
                  edited={edited}
                  fuelLabel={FUEL_LABEL[vehicle.fuel]}
                  onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
                  onReset={() => {
                    setDraft({});
                    setVehicleLabel(null);
                  }}
                  onFipeUse={(value, label) => {
                    setDraft((d) => ({ ...d, vehicleValue: toField(value) }));
                    setVehicleLabel(label);
                  }}
                />
              </div>
            </details>
          )}
        </div>

        <footer className="shrink-0 space-y-0.5 border-t border-asphalt-800 bg-asphalt-900 px-4 py-2.5 text-[11px] leading-snug text-asphalt-400">
          {sourceRows.map((row) => (
            <p key={row.label}>
              <span className="text-asphalt-300">{row.label}:</span> {row.value}
              {row.at ? ` · atualizado às ${clock(row.at, DEFAULT_TZ)}` : ''}
            </p>
          ))}
        </footer>
      </aside>
    </div>
  );
}
