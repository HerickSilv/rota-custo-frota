import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { placeLabel, searchPlaces } from '../services/geocoding';
import type { Place } from '../lib/types';
import { useAsync } from '../hooks/useAsync';

interface Props {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Campo de cidade no padrão combobox (WAI-ARIA 1.2 list autocomplete), usável só com teclado. */
export function PlaceField({ label, value, onChange }: Props) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebounced(query ?? '', 350).trim();
  const searching = query !== null && open && debounced.length >= 2;
  const results = useAsync(searching ? debounced : null, (signal) => searchPlaces(debounced, signal));
  const options = results.status === 'ready' ? results.data : [];
  const showList = open && query !== null && debounced.length >= 2;

  const choose = (place: Place) => {
    onChange(place);
    setQuery(null);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && options.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length > 0) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter' && showList && active >= 0 && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const shownText = query ?? (value ? placeLabel(value) : '');
  const statusText =
    query === null || !showList
      ? ''
      : results.status === 'loading' && options.length === 0
        ? 'Buscando cidades…'
        : results.status === 'error'
          ? results.error
          : options.length === 0 && results.status === 'ready'
            ? 'Nenhuma cidade brasileira encontrada com esse nome.'
            : `${options.length} ${options.length === 1 ? 'cidade encontrada' : 'cidades encontradas'}. Use as setas para escolher.`;

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-[12px] font-medium tracking-wide text-asphalt-300">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        className="field"
        value={shownText}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${uid}-opt-${active}` : undefined}
        placeholder="Digite o nome da cidade"
        onChange={(e) => {
          const text = e.target.value;
          setQuery(text);
          setOpen(true);
          setActive(-1);
          if (text.trim() === '') onChange(null);
        }}
        onFocus={() => {
          if (query !== null) setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          setQuery(null);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      <div role="status" aria-live="polite" className="sr-only">
        {statusText}
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`Cidades para ${label.toLowerCase()}`}
          className="panel-scroll absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-ui)] border border-asphalt-600 bg-asphalt-850 py-1 shadow-[var(--shadow-panel)]"
        >
          {results.status === 'loading' && options.length === 0 && (
            <li className="px-3 py-2 text-asphalt-400">Buscando…</li>
          )}
          {results.status === 'error' && <li className="px-3 py-2 text-[var(--color-severe)]">{results.error}</li>}
          {options.map((place, i) => (
            <li
              key={place.id}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-asphalt-700 text-white' : 'text-asphalt-100 hover:bg-asphalt-800'}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {placeLabel(place)}
              <span className="ml-2 text-[12px] text-asphalt-400">{place.timezone.split('/')[1]?.replace(/_/g, ' ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
