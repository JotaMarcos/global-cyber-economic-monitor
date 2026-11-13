import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RankedItem } from "../../domain/overview.ts";
import { formatInteger, formatUsdCompact } from "../format.ts";
import { sectorLabel } from "../labels.ts";
import {
  CHART_COLORS,
  CHART_FONT_SIZE,
  LEGEND_STYLE,
  TOOLTIP_STYLE,
} from "./chart-theme.ts";
import { EmptyState, Panel } from "./ui.tsx";

const MAX_SECTORS = 7;
const MILLION = 1_000_000;

interface SectorExposureChartProps {
  readonly sectors: readonly RankedItem[];
  readonly selectedSector: string;
  readonly onSelect: (sector: string) => void;
}

/** Incidentes e prejuízo estimado por setor econômico, no recorte selecionado. */
export function SectorExposureChart({
  sectors,
  selectedSector,
  onSelect,
}: SectorExposureChartProps) {
  const top = sectors.slice(0, MAX_SECTORS);
  const selectAt = (index: number) => {
    const item = top[index];
    if (item) onSelect(item.key);
  };
  const data = top.map((item) => ({
    key: item.key,
    label: sectorLabel(item.key),
    incidents: item.incidents,
    lossMillions: item.estimatedLossUsd / MILLION,
  }));

  return (
    <Panel
      title="Exposição por setor econômico"
      source="Ransomware.live; prejuízo = incidentes × custo de referência"
      aside="Selecione para filtrar"
    >
      {data.length === 0 ? (
        <EmptyState>Sem ocorrências no recorte.</EmptyState>
      ) : (
        <>
          <div className="h-72 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis
                  xAxisId="incidents"
                  type="number"
                  stroke={CHART_COLORS.incidents}
                  fontSize={CHART_FONT_SIZE}
                  allowDecimals={false}
                />
                <XAxis
                  xAxisId="loss"
                  type="number"
                  orientation="top"
                  stroke={CHART_COLORS.loss}
                  fontSize={CHART_FONT_SIZE}
                />
                <YAxis
                  dataKey="label"
                  type="category"
                  stroke={CHART_COLORS.axisMuted}
                  fontSize={CHART_FONT_SIZE}
                  width={118}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar
                  xAxisId="incidents"
                  dataKey="incidents"
                  name="Incidentes"
                  fill={CHART_COLORS.incidents}
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(_entry, index) => selectAt(index)}
                />
                <Bar
                  xAxisId="loss"
                  dataKey="lossMillions"
                  name="Prejuízo estimado (US$ mi)"
                  fill={CHART_COLORS.loss}
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(_entry, index) => selectAt(index)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Equivalente acessível e navegável por teclado do gráfico. */}
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {top.map((item) => {
              const selected = item.key === selectedSector;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(item.key)}
                    className={`rounded border px-2 py-0.5 text-[11px] ${
                      selected
                        ? "border-accent bg-accent/15 text-ink"
                        : "border-line text-muted hover:border-faint hover:text-ink"
                    }`}
                  >
                    {sectorLabel(item.key)}: {formatInteger(item.incidents)} ·{" "}
                    {formatUsdCompact(item.estimatedLossUsd)}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}
