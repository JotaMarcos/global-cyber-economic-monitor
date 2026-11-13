import { CircleAlert, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type {
  FeedCategory,
  FeedItem,
  FeedSeverity,
} from "../../domain/threat-feed-items.ts";
import { formatInteger } from "../format.ts";
import { Status } from "./ui.tsx";

type CategoryFilter = FeedCategory | "ALL";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  ALL: "Todos",
  VULNERABILITY: "Vulnerabilidades",
  C2: "Comando e controle",
  ATTACK_SOURCE: "Origens de ataque",
};

const SEVERITY_LABELS: Record<FeedSeverity, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
};

const SEVERITY_CLASSES: Record<FeedSeverity, string> = {
  CRITICAL: "border-critical/50 bg-critical/15 text-rose-300",
  HIGH: "border-warning/50 bg-warning/15 text-amber-300",
  MEDIUM: "border-line bg-raised text-muted",
};

const MAX_ITEMS = 60;

interface ThreatFeedPanelProps {
  readonly items: readonly FeedItem[];
  /** Fontes do feed que estão indisponíveis no momento. */
  readonly unavailableSources: readonly string[];
  /** Totais do catálogo global CISA KEV, que não tem recorte geográfico. */
  readonly knownExploited: { readonly total: number; readonly ransomwareLinked: number };
  readonly className?: string;
}

function FeedCard({ item }: { readonly item: FeedItem }) {
  return (
    <li className="rounded-lg border border-line bg-canvas/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-accent">{item.indicator}</span>
          <span className="rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] text-muted">
            {item.source}
          </span>
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_CLASSES[item.severity]}`}
        >
          {SEVERITY_LABELS[item.severity]}
        </span>
      </div>
      <p className="mt-1.5 truncate text-sm font-medium text-ink">{item.title}</p>
      <div className="mt-0.5 flex items-start justify-between gap-2 text-[11px]">
        <p className="line-clamp-2 text-faint">{item.detail}</p>
        {item.active !== null && (
          <span className="shrink-0 font-semibold">
            <Status tone={item.active ? "critical" : "neutral"}>
              {item.active ? "Ativo" : "Inativo"}
            </Status>
          </span>
        )}
      </div>
    </li>
  );
}

/** Indicadores das fontes oficiais, unificados, validados e ordenados por severidade. */
export function ThreatFeedPanel({
  items,
  unavailableSources,
  knownExploited,
  className = "",
}: ThreatFeedPanelProps) {
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const filtered =
    category === "ALL" ? items : items.filter((item) => item.category === category);
  const visible = filtered.slice(0, MAX_ITEMS);

  return (
    <section
      aria-label="Feed OSINT tratado e sanitizado"
      className={`flex min-w-0 flex-col rounded-xl border border-line bg-panel/70 ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <ShieldAlert aria-hidden="true" className="h-4 w-4 text-critical" />
          Feed OSINT tratado e sanitizado
        </h2>
        <span className="text-[11px] text-faint">CISA · NIST · abuse.ch · SANS ISC</span>
      </header>

      <div
        className="flex flex-wrap gap-1.5 px-4 pt-3"
        role="group"
        aria-label="Categoria"
      >
        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={category === key}
            onClick={() => setCategory(key)}
            className={`rounded-md border px-2 py-0.5 text-[11px] ${
              category === key
                ? "border-accent bg-accent/15 text-ink"
                : "border-line text-muted hover:border-faint hover:text-ink"
            }`}
          >
            {CATEGORY_LABELS[key]}
          </button>
        ))}
      </div>

      {unavailableSources.length > 0 && (
        <p className="mx-4 mt-3 flex items-start gap-1.5 rounded-md border border-warning/40 px-2 py-1.5 text-[11px] text-ink">
          <CircleAlert
            aria-hidden="true"
            className="mt-px h-3.5 w-3.5 shrink-0 text-warning"
          />
          {unavailableSources.join(", ")}: fonte indisponível no momento.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-xs text-faint">
          Nenhum indicador nesta categoria.
        </p>
      ) : (
        <ul className="scroll-thin max-h-[34rem] flex-1 space-y-3 overflow-y-auto p-4">
          {visible.map((item) => (
            <FeedCard key={item.key} item={item} />
          ))}
        </ul>
      )}
      <p className="border-t border-line/80 px-4 py-2 text-[11px] text-faint">
        {formatInteger(filtered.length)} indicadores
        {filtered.length > visible.length && `, exibindo os ${MAX_ITEMS} mais graves`}.
      </p>
      <p className="px-4 pb-2 text-[11px] text-faint">
        {`Catálogo global CISA KEV: ${formatInteger(knownExploited.total)} vulnerabilidades exploradas, ${formatInteger(knownExploited.ransomwareLinked)} usadas em ransomware.`}
      </p>
    </section>
  );
}
