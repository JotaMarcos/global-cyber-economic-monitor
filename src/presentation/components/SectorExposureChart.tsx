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
import type { SectorSummary } from "../../domain/organization/sector-summary";
import { SECTOR_CHART_LABELS } from "../labels";
import {
  CHART_COLORS,
  CHART_FONT_SIZE,
  LEGEND_STYLE,
  TOOLTIP_STYLE,
} from "./chart-theme";

interface SectorExposureChartProps {
  readonly summary: readonly SectorSummary[];
}

export function SectorExposureChart({ summary }: SectorExposureChartProps) {
  const data = summary.map((item) => ({
    ...item,
    label: SECTOR_CHART_LABELS[item.sector],
  }));

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white">Exposição por Setor Econômico</h2>
        <p className="text-xs text-slate-400">Volume (US$ Bi) vs. Bloqueios (milhares)</p>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis type="number" stroke={CHART_COLORS.axis} fontSize={CHART_FONT_SIZE} />
            <YAxis
              dataKey="label"
              type="category"
              stroke={CHART_COLORS.axisMuted}
              fontSize={CHART_FONT_SIZE}
              width={115}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Bar
              dataKey="volumeUsdBi"
              name="Volume (US$ Bi)"
              fill={CHART_COLORS.volume}
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="blockedThousands"
              name="Bloqueios (k)"
              fill={CHART_COLORS.blocked}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
