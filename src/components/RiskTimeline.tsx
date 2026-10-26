import { clockShort, dayLabel, num0 } from '../lib/format';
import type { RoutePlan } from '../lib/plan';
import { RISK_LABEL } from '../lib/risk';
import type { TripAlert } from '../lib/trip';
import { RiskBadge } from './RiskBadge';

interface Props {
  plan: RoutePlan;
  originTz: string;
  onHover: (point: { lng: number; lat: number } | null) => void;
}

function alertSentence(a: TripAlert, tz: string): string {
  const reasons = a.reasons.map((r) => (r.detail ? `${r.label.toLowerCase()} (${r.detail})` : r.label.toLowerCase()));
  const what = reasons.length > 0 ? reasons.join(', ') : RISK_LABEL[a.state].toLowerCase();
  const when = `${dayLabel(a.fromMs, tz)} ${clockShort(a.fromMs, tz)} às ${clockShort(a.toMs, tz)}`;
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} do km ${num0(a.fromKm)} ao km ${num0(a.toKm)}, ${when}.`;
}

/**
 * Quadro de horários do trajeto: cada linha é uma amostra (km, hora prevista, condição). Foco ou passagem
 * destaca o ponto correspondente no mapa.
 */
export function RiskTimeline({ plan, originTz, onHover }: Props) {
  const alerts = plan.alerts;
  return (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <p className="text-[13px] text-asphalt-300">
          {plan.knownSamples === 0
            ? 'Sem previsão para os horários desta viagem. O custo foi calculado, o risco não.'
            : 'Nenhum trecho com alerta nas amostras previstas.'}
        </p>
      ) : (
        <ul className="space-y-1.5 text-[13px]">
          {alerts.map((a) => (
            <li key={`${a.fromKm}-${a.fromMs}`} className="flex items-start gap-2">
              <RiskBadge state={a.state} compact />
              <span className="text-asphalt-200">{alertSentence(a, originTz)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="panel-scroll max-h-[260px] overflow-auto rounded-[var(--radius-ui)] border border-asphalt-700">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">
            Previsão ao longo da rota selecionada: quilômetro, hora prevista e condição. Horários na hora local da origem.
          </caption>
          <thead className="sticky top-0 bg-asphalt-850 text-left text-[11px] uppercase tracking-[0.12em] text-asphalt-400">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Km</th>
              <th scope="col" className="px-3 py-2 font-medium">Chegada prevista</th>
              <th scope="col" className="px-3 py-2 font-medium">Condição</th>
            </tr>
          </thead>
          <tbody>
            {plan.samples.map((s, i) => {
              const detail = s.risk.reasons.map((r) => (r.detail ? `${r.label} ${r.detail}` : r.label)).join(', ');
              return (
                <tr
                  key={`${i}-${s.km}`}
                  tabIndex={0}
                  onMouseEnter={() => onHover({ lng: s.lng, lat: s.lat })}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover({ lng: s.lng, lat: s.lat })}
                  onBlur={() => onHover(null)}
                  className="border-t border-asphalt-800 align-top outline-none hover:bg-asphalt-800 focus-visible:bg-asphalt-800"
                >
                  <td className="num px-3 py-2 text-asphalt-100">{num0(s.km)}</td>
                  <td className="num px-3 py-2 text-asphalt-100">{clockShort(s.etaMs, originTz)}</td>
                  <td className="px-3 py-2">
                    <RiskBadge state={s.risk.state} compact />
                    {detail && <span className="block text-[12px] text-asphalt-400">{detail}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
