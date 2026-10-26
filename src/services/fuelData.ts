import { FuelReferenceSchema, type FuelReference } from '../lib/fuel';
import { getJson } from './http';

/** Preços de referência da ANP, versionados no repositório (ver docs/design.md para o porquê de não haver ETL). */
export function loadFuelReference(signal?: AbortSignal): Promise<FuelReference> {
  return getJson(`${import.meta.env.BASE_URL}data/fuel-reference.json`, FuelReferenceSchema, {
    service: 'Preços de combustível (referência ANP)',
    signal,
  });
}
