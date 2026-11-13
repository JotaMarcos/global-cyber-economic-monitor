import { Filter, Search } from "lucide-react";
import type { ReactNode } from "react";
import {
  listCities,
  listCountries,
  listStates,
} from "../../domain/geography/geo-hierarchy";
import {
  ALL,
  type OrganizationFilter,
} from "../../domain/organization/organization-filter";
import { SECTOR_IDS } from "../../domain/organization/sector";
import { useDashboard } from "../context/dashboard-context";
import { useObservable } from "../hooks/use-observable";
import { SECTOR_FILTER_LABELS } from "../labels";

const FIELD_CLASS =
  "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-40";

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly children: ReactNode;
}

function Field({ id, label, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export function FilterPanel() {
  const { state, commands, geoHierarchy } = useDashboard();
  const filter = useObservable(state.filter);

  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3">
        <Filter className="w-4 h-4" />
        Drill-Down Geoespacial & Setorial
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Field id="filter-country" label="País / Região">
          <select
            id="filter-country"
            value={filter.country}
            onChange={(event) => commands.filter.selectCountry(event.target.value)}
            className={FIELD_CLASS}
          >
            {listCountries(geoHierarchy).map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-state" label="Estado / Província">
          <select
            id="filter-state"
            value={filter.state}
            onChange={(event) => commands.filter.selectState(event.target.value)}
            disabled={filter.country === ALL}
            className={FIELD_CLASS}
          >
            <option value={ALL}>Todos os Estados</option>
            {listStates(geoHierarchy, filter.country).map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-city" label="Município">
          <select
            id="filter-city"
            value={filter.city}
            onChange={(event) => commands.filter.selectCity(event.target.value)}
            disabled={filter.state === ALL}
            className={FIELD_CLASS}
          >
            <option value={ALL}>Todos os Municípios</option>
            {listCities(geoHierarchy, filter.country, filter.state).map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-sector" label="Setor Econômico">
          <select
            id="filter-sector"
            value={filter.sector}
            onChange={(event) =>
              commands.filter.selectSector(
                event.target.value as OrganizationFilter["sector"],
              )
            }
            className={FIELD_CLASS}
          >
            <option value={ALL}>Todos os Setores</option>
            {SECTOR_IDS.map((sector) => (
              <option key={sector} value={sector}>
                {SECTOR_FILTER_LABELS[sector]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-search" label="Buscar Organização / Segmento">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              id="filter-search"
              type="text"
              value={filter.searchTerm}
              onChange={(event) => commands.filter.search(event.target.value)}
              placeholder="Ex: Manaus, B3, Agro, ONG..."
              className={`${FIELD_CLASS} pl-9 placeholder:text-slate-600`}
            />
          </div>
        </Field>
      </div>
    </section>
  );
}
