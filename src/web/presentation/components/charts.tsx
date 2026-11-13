import { formatInteger } from "../format.ts";
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
