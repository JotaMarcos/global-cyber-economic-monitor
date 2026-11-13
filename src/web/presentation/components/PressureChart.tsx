import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CriticalCve, Incident } from "../../../contract/threat-snapshot.ts";
import {
  buildPressureSeries,
  DEFAULT_WINDOW_HOURS,
} from "../../domain/pressure-series.ts";
import { formatClock, formatHour, formatInteger } from "../format.ts";
import { useNow } from "../hooks/use-now.ts";
import {
  CHART_COLORS,
  CHART_FONT_SIZE,
  LEGEND_STYLE,
  TOOLTIP_STYLE,
} from "./chart-theme.ts";
import { Panel, Status } from "./ui.tsx";

/** A janela avança com o relógio, mesmo entre duas coletas das fontes. */
const CLOCK_TICK_MS = 30_000;

function FadeGradient({ id, color }: { readonly id: string; readonly color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
      <stop offset="95%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

interface PressureChartProps {
  readonly incidents: readonly Incident[];
  readonly criticalCves: readonly CriticalCve[];
  readonly live: boolean;
  /** Instante do último retrato recebido do gateway. */
  readonly updatedAt: string;
  readonly className?: string;
}

/**
 * Série contínua de pressão de ataques: divulgações de ransomware e CVEs
 * críticas por hora. Atualiza a cada retrato recebido pelo fluxo SSE e
 * desliza a janela conforme o tempo passa.
 */
export function PressureChart({
  incidents,
  criticalCves,
  live,
  updatedAt,
  className,
}: PressureChartProps) {
  const now = useNow(CLOCK_TICK_MS);
  const data = useMemo(
    () =>
      buildPressureSeries(incidents, criticalCves, now).map((point) => ({
        ...point,
        label: formatHour(point.hourStart),
      })),
    [incidents, criticalCves, now],
  );
  const totalIncidents = data.reduce((sum, point) => sum + point.incidents, 0);
  const totalCves = data.reduce((sum, point) => sum + point.criticalCves, 0);

  return (
    <Panel
      title="Streaming: pressão de ataques por hora"
      source="Ransomware.live (divulgações) e NIST NVD (CVEs críticas)"
      className={className}
      aside={
        <span className="flex flex-col items-end gap-1">
          <span className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">
            <Status tone={live ? "good" : "warning"} pulse={live}>
              {live ? "Ao vivo" : "Pausado"}
            </Status>
          </span>
          <span className="text-faint">Retrato de {formatClock(updatedAt)}</span>
        </span>
      }
    >
      <p className="mb-3 text-xs text-muted">
        Janela deslizante das últimas {DEFAULT_WINDOW_HOURS} horas (UTC), recalculada a
        cada coleta das fontes e a cada {CLOCK_TICK_MS / 1000} segundos.
      </p>
      <p className="sr-only">
        Últimas {DEFAULT_WINDOW_HOURS} horas: {formatInteger(totalIncidents)} divulgações
        de ransomware e {formatInteger(totalCves)} CVEs críticas publicadas.
      </p>
      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <defs>
              <FadeGradient id="fill-cves" color={CHART_COLORS.primary} />
              <FadeGradient id="fill-incidents" color={CHART_COLORS.attacks} />
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="label"
              stroke={CHART_COLORS.axis}
              fontSize={CHART_FONT_SIZE}
              minTickGap={28}
            />
            <YAxis
              yAxisId="cves"
              stroke={CHART_COLORS.primary}
              fontSize={CHART_FONT_SIZE}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="incidents"
              orientation="right"
              stroke={CHART_COLORS.attacks}
              fontSize={CHART_FONT_SIZE}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Area
              yAxisId="cves"
              type="monotone"
              dataKey="criticalCves"
              name="CVEs críticas publicadas / hora"
              stroke={CHART_COLORS.primary}
              fill="url(#fill-cves)"
              fillOpacity={1}
              strokeWidth={2}
            />
            <Area
              yAxisId="incidents"
              type="monotone"
              dataKey="incidents"
              name="Divulgações de ransomware / hora"
              stroke={CHART_COLORS.attacks}
              fill="url(#fill-incidents)"
              fillOpacity={1}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
