import { Funnel, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Subdivision } from "../../../contract/threat-snapshot.ts";
import { ALL, isFilterActive, type DashboardFilter } from "../../domain/filter.ts";
import { MAX_QUERY_LENGTH } from "../../domain/full-text-search.ts";
import { CONTINENT_IDS } from "../../domain/geography.ts";
import { useDashboard } from "../context/dashboard-context.tsx";
import { countryName } from "../format.ts";
import { useObservable } from "../hooks/use-observable.ts";
import { CONTINENT_LABELS, sectorLabel } from "../labels.ts";

/** País cuja divisão territorial oficial está integrada (IBGE). */
export const TERRITORY_COUNTRY = "BR";

const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-slate-600 hover:border-slate-600 focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-40";

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
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

interface FilterBarProps {
  readonly countryOptions: readonly string[];
  readonly sectorOptions: readonly string[];
  readonly territories: readonly Subdivision[];
}

export function FilterBar({
  countryOptions,
  sectorOptions,
  territories,
}: FilterBarProps) {
  const { state, filterCommands } = useDashboard();
  const filter = useObservable(state.filter);
  const countries = [...countryOptions]
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const subdivisions = filter.country === TERRITORY_COUNTRY ? territories : [];
  const municipalities =
    subdivisions.find((subdivision) => subdivision.code === filter.state)
      ?.municipalities ?? [];

  return (
    <section
      aria-label="Filtros"
      className="rounded-xl border border-line bg-panel shadow-sm p-4"
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
        <Funnel aria-hidden="true" className="h-4 w-4" />
        Recorte geográfico, setorial e busca
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

        <Field id="filter-state" label="Estado">
          <select
            id="filter-state"
            value={filter.state}
            onChange={(event) => filterCommands.selectState(event.target.value)}
            disabled={subdivisions.length === 0}
            className={FIELD_CLASS}
          >
            <option value={ALL}>Todos os estados</option>
            {subdivisions.map((subdivision) => (
              <option key={subdivision.code} value={subdivision.code}>
                {subdivision.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-municipality" label="Município">
          <select
            id="filter-municipality"
            value={filter.municipality}
            onChange={(event) => filterCommands.selectMunicipality(event.target.value)}
            disabled={municipalities.length === 0}
            className={FIELD_CLASS}
          >
            <option value={ALL}>Todos os municípios</option>
            {municipalities.map((municipality) => (
              <option key={municipality.id} value={municipality.id}>
                {municipality.name}
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

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => filterCommands.clear()}
            disabled={!isFilterActive(filter)}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-xs text-muted hover:border-faint hover:text-ink disabled:opacity-40"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        </div>

        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
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
                maxLength={MAX_QUERY_LENGTH}
                onChange={(event) => filterCommands.search(event.target.value)}
                placeholder='Organização, grupo ou equipe (ex.: hospital akira, "prefeitura municipal")'
                aria-describedby="filter-search-help"
                className={`${FIELD_CLASS} pl-9`}
              />
            </div>
          </Field>
          <p id="filter-search-help" className="mt-1 text-[11px] text-faint">
            Busca de texto completo em organização, grupo de ameaça, setor, país e equipe
            de resposta: ignora acentos e maiúsculas, aceita início de palavra e frase
            exata entre aspas, e ordena os resultados por relevância.
          </p>
        </div>
      </div>

      <p className="mt-3 border-t border-line/80 pt-3 text-[11px] text-faint">
        Estado e município seguem a divisão territorial oficial do IBGE e estão
        disponíveis para o Brasil. As fontes oficiais de incidentes informam a localização
        apenas até o nível de país.
      </p>
    </section>
  );
}
