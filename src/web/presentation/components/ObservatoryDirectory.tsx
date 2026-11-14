import { ExternalLink } from "lucide-react";
import type { SourceStatus } from "../../../contract/threat-snapshot.ts";
import {
  OBSERVATORIES,
  type Observatory,
  type ObservatoryAccess,
} from "../../domain/observatories.ts";
import { countryName } from "../format.ts";
import {
  HEALTH_LABELS,
  OBSERVATORY_ACCESS_LABELS,
  OBSERVATORY_KIND_LABELS,
} from "../labels.ts";
import { Badge, Panel, Status, type Tone } from "./ui.tsx";

const ACCESS_TONES: Record<ObservatoryAccess, Tone> = {
  INTEGRATED: "good",
  PARTIAL: "warning",
  EXTERNAL: "neutral",
};

interface ObservatoryCardProps {
  readonly observatory: Observatory;
  readonly sources: readonly SourceStatus[];
}

function ObservatoryCard({ observatory, sources }: ObservatoryCardProps) {
  const integrated = sources.filter((source) =>
    observatory.integratedSources.includes(source.id),
  );

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-canvas p-3 text-xs">
      <div>
        <Badge tone="accent">{OBSERVATORY_KIND_LABELS[observatory.kind]}</Badge>
        <h3 className="mt-1.5 font-semibold text-ink">{observatory.name}</h3>
        <p className="text-[11px] text-faint">
          {observatory.organization}
          {observatory.countryCode && ` · ${countryName(observatory.countryCode)}`}
        </p>
      </div>
      <p className="flex-1 leading-snug text-muted">{observatory.description}</p>
      <p className="font-medium text-ink">
        <Status tone={ACCESS_TONES[observatory.access]}>
          {OBSERVATORY_ACCESS_LABELS[observatory.access]}
        </Status>
      </p>
      {integrated.map((source) => (
        <p key={source.id} className="text-[11px] text-muted">
          {source.name}: {HEALTH_LABELS[source.health].toLowerCase()}
        </p>
      ))}
      <a
        href={observatory.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 self-start font-medium text-accent hover:underline"
      >
        Abrir {observatory.name}
        <ExternalLink aria-hidden="true" className="h-3 w-3" />
      </a>
    </li>
  );
}

/**
 * Plataformas de monitoramento acompanhadas pelo projeto, com a forma de
 * acesso verificada. Apenas conjuntos abertos são coletados pelo gateway.
 */
export function ObservatoryDirectory({
  sources,
}: {
  readonly sources: readonly SourceStatus[];
}) {
  return (
    <Panel
      title="Plataformas de monitoramento de ameaças"
      source="Catálogo do projeto, com a forma de acesso verificada em cada plataforma"
      aside={`${OBSERVATORIES.length} plataformas`}
    >
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {OBSERVATORIES.map((observatory) => (
          <ObservatoryCard
            key={observatory.id}
            observatory={observatory}
            sources={sources}
          />
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-faint">
        Mapas de fabricantes exibem a telemetria dos próprios produtos e não oferecem
        conjunto de dados aberto. Por isso são referenciados, e não reproduzidos.
      </p>
    </Panel>
  );
}
