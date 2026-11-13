import type { DailyCount } from "../../domain/overview.ts";
import { formatDay, formatInteger } from "../format.ts";
import { EmptyState } from "./ui.tsx";

export interface BarListItem {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Informação complementar exibida ao lado do valor. */
  readonly detail?: string;
}

interface BarListProps {
  readonly items: readonly BarListItem[];
  readonly emptyMessage: string;
  readonly selectedKey?: string;
  readonly onSelect?: (key: string) => void;
}

/**
 * Ranking em barras horizontais de série única. Cada linha traz rótulo e
 * valor em texto, de modo que a leitura não depende da barra nem da cor.
 */
export function BarList({ items, emptyMessage, selectedKey, onSelect }: BarListProps) {
  if (items.length === 0) return <EmptyState>{emptyMessage}</EmptyState>;
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const selected = item.key === selectedKey;
        const row = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-xs">
              <span
                className={`truncate ${selected ? "font-semibold text-ink" : "text-muted"}`}
              >
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-ink">
                {formatInteger(item.value)}
                {item.detail && <span className="ml-2 text-faint">{item.detail}</span>}
              </span>
            </span>
            <span className="mt-1 block h-1.5 rounded-sm bg-raised">
              <span
                className={`block h-full rounded-sm ${selected ? "bg-ink" : "bg-accent"}`}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </span>
          </>
        );
        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(item.key)}
                className="block w-full rounded px-1 py-0.5 text-left hover:bg-raised"
              >
                {row}
              </button>
            ) : (
              <div className="px-1 py-0.5">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const MAX_LABELED_COLUMNS = 14;

interface ColumnChartProps {
  readonly data: readonly DailyCount[];
  readonly emptyMessage: string;
}

/** Colunas diárias de série única, com eixo próprio e valor ao passar o cursor. */
export function ColumnChart({ data, emptyMessage }: ColumnChartProps) {
  if (data.length === 0) return <EmptyState>{emptyMessage}</EmptyState>;
  const max = Math.max(1, ...data.map((point) => point.incidents));
  const labelEveryColumn = data.length <= MAX_LABELED_COLUMNS;

  return (
    <figure className="flex h-full min-h-44 flex-col">
      <div className="flex min-h-0 flex-1 gap-2">
        <div
          aria-hidden="true"
          className="flex flex-col justify-between pb-px text-right text-[10px] tabular-nums text-faint"
        >
          <span>{formatInteger(max)}</span>
          <span>0</span>
        </div>
        <ol className="flex min-w-0 flex-1 items-end gap-[2px] border-b border-l border-line pl-px">
          {data.map((point) => (
            <li
              key={point.day}
              className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
            >
              <span
                className="block w-full max-w-16 rounded-t-[4px] bg-accent group-hover:bg-ink"
                style={{ height: `${(point.incidents / max) * 100}%` }}
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded border border-line bg-raised px-2 py-1 text-[11px] text-ink shadow-lg group-hover:block"
              >
                {formatDay(point.day)}: {formatInteger(point.incidents)}
              </span>
              <span className="sr-only">
                {formatDay(point.day)}: {formatInteger(point.incidents)} incidentes
              </span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-1.5 flex pl-6 text-[10px] tabular-nums text-faint">
        {labelEveryColumn ? (
          data.map((point) => (
            <span key={point.day} className="min-w-0 flex-1 text-center">
              {formatDay(point.day)}
            </span>
          ))
        ) : (
          <span className="flex flex-1 justify-between">
            <span>{formatDay(data[0]!.day)}</span>
            <span>{formatDay(data.at(-1)!.day)}</span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
