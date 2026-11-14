/** Paleta e estilos compartilhados pelos gráficos (mesma linguagem visual do painel). */
export const CHART_COLORS = {
  grid: "#e3e6ef",
  axis: "#6a7288",
  axisMuted: "#555d72",
  primary: "#5a35c9",
  attacks: "#c81e4a",
  incidents: "#1a7f47",
  loss: "#b45309",
} as const;

export const CHART_FONT_SIZE = 11;

export const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  borderColor: "#dfe2ec",
  borderRadius: "8px",
  fontSize: "12px",
} as const;

export const LEGEND_STYLE = { fontSize: "12px" } as const;
