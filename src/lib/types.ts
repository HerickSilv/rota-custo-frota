export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ',
  'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export type UF = (typeof UFS)[number];

export type FuelKind = 'gasolina' | 'etanol' | 'diesel';

/** [longitude, latitude] — mesma ordem do GeoJSON. */
export type LngLat = [number, number];

export interface Place {
  id: string;
  name: string;
  uf: UF | null;
  lat: number;
  lng: number;
  /** Fuso IANA do local (ex.: America/Sao_Paulo), usado para interpretar o horário de saída. */
  timezone: string;
}

export interface RouteOption {
  id: string;
  distanceM: number;
  durationS: number;
  coordinates: LngLat[];
}

/** 'unknown' = sem previsão para aquele horário (fora do alcance ou dado ausente). */
export type RiskState = 'ok' | 'attention' | 'severe' | 'unknown';

export interface HourlyWeather {
  precipitationMm: number;
  gustKmh: number;
  weatherCode: number;
}

export type ReasonKind = 'rain' | 'wind' | 'storm' | 'fog' | 'ice' | 'snow';

export interface RiskReason {
  kind: ReasonKind;
  label: string;
  detail?: string;
  severe: boolean;
}

export interface RiskAssessment {
  state: RiskState;
  reasons: RiskReason[];
}
