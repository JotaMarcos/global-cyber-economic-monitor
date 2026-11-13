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
import { useDashboard } from "../context/dashboard-context";
import { useObservable } from "../hooks/use-observable";
import {
  CHART_COLORS,
  CHART_FONT_SIZE,
  LEGEND_STYLE,
  TOOLTIP_STYLE,
} from "./chart-theme";

interface GradientProps {
  readonly id: string;
  readonly color: string;
}

function FadeGradient({ id, color }: GradientProps) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
      <stop offset="95%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

export function TelemetryChart() {
  const { state } = useDashboard();
  const telemetry = useObservable(state.telemetry);

  return (
    <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">
            Streaming: Índice de Atividade Econômica vs. Pressão de Ataques (req/min)
          </h2>
          <p className="text-xs text-slate-400">
            Atualização contínua com janela deslizante protegida contra estouro de memória
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
          Live Stream
        </span>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[...telemetry]}>
            <defs>
              <FadeGradient id="colorAttacks" color={CHART_COLORS.attacks} />
              <FadeGradient id="colorEcon" color={CHART_COLORS.economic} />
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="time" stroke={CHART_COLORS.axis} fontSize={CHART_FONT_SIZE} />
            <YAxis
              yAxisId="left"
              stroke={CHART_COLORS.economic}
              fontSize={CHART_FONT_SIZE}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={CHART_COLORS.attacks}
              fontSize={CHART_FONT_SIZE}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="economicIndex"
              name="Índice Econômico Global"
              stroke={CHART_COLORS.economic}
              fillOpacity={1}
              fill="url(#colorEcon)"
              strokeWidth={2}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="cyberAttacksPerMin"
              name="Ameaças Interceptadas / min"
              stroke={CHART_COLORS.attacks}
              fillOpacity={1}
              fill="url(#colorAttacks)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
