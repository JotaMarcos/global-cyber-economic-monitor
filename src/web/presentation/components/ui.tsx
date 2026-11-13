import type { ReactNode } from "react";

export type Tone = "neutral" | "good" | "warning" | "serious" | "critical" | "accent";

const DOT_CLASSES: Record<Tone, string> = {
  neutral: "bg-faint",
  good: "bg-good",
  warning: "bg-warning",
  serious: "bg-serious",
  critical: "bg-critical",
  accent: "bg-accent",
};

const BADGE_CLASSES: Record<Tone, string> = {
  neutral: "border-line text-muted",
  good: "border-good/40 text-ink",
  warning: "border-warning/40 text-ink",
  serious: "border-serious/40 text-ink",
  critical: "border-critical/50 text-ink",
  accent: "border-accent/40 text-ink",
};

interface StatusProps {
  readonly tone: Tone;
  readonly children: ReactNode;
  readonly pulse?: boolean;
}

/** Estado sempre com ponto colorido e rótulo: a cor nunca carrega o sentido sozinha. */
export function Status({ tone, children, pulse = false }: StatusProps) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[tone]} ${pulse ? "animate-pulse" : ""}`}
      />
      {children}
    </span>
  );
}

export function Badge({
  tone,
  children,
}: {
  readonly tone: Tone;
  readonly children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BADGE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function CountryChip({ code }: { readonly code: string | null }) {
  return (
    <span className="inline-block w-7 shrink-0 rounded bg-raised py-0.5 text-center font-mono text-[10px] font-semibold text-muted">
      {code ?? "··"}
    </span>
  );
}

interface PanelProps {
  readonly title: string;
  /** Origem dos dados, exibida em todo painel para rastreabilidade. */
  readonly source: string;
  readonly aside?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Panel({ title, source, aside, className = "", children }: PanelProps) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col rounded-xl border border-line bg-panel/70 ${className}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-line/80 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
          <p className="truncate text-[11px] text-faint">Fonte: {source}</p>
        </div>
        {aside && <div className="shrink-0 text-[11px] text-muted">{aside}</div>}
      </header>
      <div className="min-h-0 flex-1 p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { readonly children: ReactNode }) {
  return (
    <p className="flex h-full min-h-24 items-center justify-center text-center text-xs text-faint">
      {children}
    </p>
  );
}
