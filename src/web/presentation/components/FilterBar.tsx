import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { ALL, isFilterActive, type DashboardFilter } from "../../domain/filter.ts";
import { CONTINENT_IDS } from "../../domain/geography.ts";
import { useDashboard } from "../context/dashboard-context.tsx";
import { countryName } from "../format.ts";
import { useObservable } from "../hooks/use-observable.ts";
import { CONTINENT_LABELS, sectorLabel } from "../labels.ts";

const FIELD_CLASS =
  "h-9 w-full rounded-md border border-line bg-panel px-3 text-xs text-ink placeholder:text-faint hover:border-faint disabled:opacity-40";

function Field({
  id,
  label,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1 block text-[10px] uppercase tracking-wider text-faint"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

interface FilterBarProps {
  readonly countryOptions: readonly string[];
  readonly sectorOptions: readonly string[];
}

export function FilterBar({ countryOptions, sectorOptions }: FilterBarProps) {
  const { state, filterCommands } = useDashboard();
  const filter = useObservable(state.filter);
  const countries = [...countryOptions]
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <section
      aria-label="Filtros"
      className="rounded-lg border border-line bg-panel/60 p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
        <Field id="filter-continent" label="Continente">
          <select
            id="filter-continent"
            value={filter.continent}
            onChange={(event) =>
              filterCommands.selectContinent(
                event.target.value as DashboardFilter["continent"],
              )
            }
            className={FIELD_CLASS}
          >
            <option value={ALL}>Todos os continentes</option>
            {CONTINENT_IDS.map((continent) => (
              <option key={continent} value={continent}>
                {CONTINENT_LABELS[continent]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-country" label="País">
          <select
            id="filter-country"
            value={filter.country}
            onChange={(event) => filterCommands.selectCountry(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value={ALL}>Todos os países</option>
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-sector" label="Setor econômico">
          <select
            id="filter-sector"
            value={filter.sector}
            onChange={(event) => filterCommands.selectSector(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value={ALL}>Todos os setores</option>
            {sectorOptions.map((sector) => (
              <option key={sector} value={sector}>
                {sectorLabel(sector)}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-search" label="Busca">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-faint"
            />
            <input
              id="filter-search"
              type="search"
              value={filter.searchTerm}
              maxLength={80}
              onChange={(event) => filterCommands.search(event.target.value)}
              placeholder="Organização, grupo ou equipe"
              className={`${FIELD_CLASS} pl-9`}
            />
          </div>
        </Field>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => filterCommands.clear()}
            disabled={!isFilterActive(filter)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-muted hover:border-faint hover:text-ink disabled:opacity-40"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-faint">
        As fontes públicas integradas informam a localização até o nível de país. Recortes
        por estado, município ou comunidade não estão disponíveis nos dados de origem.
      </p>
    </section>
  );
}
