import { CodeXml, X } from "lucide-react";
import { useEffect, useRef } from "react";

const ROUTES: readonly (readonly [string, string])[] = [
  ["GET /api/v1/stream", "Fluxo SSE: retrato atual na conexão e a cada nova coleta"],
  ["GET /api/v1/snapshot", "Retrato consolidado atual de todas as fontes"],
  ["GET /api/v1/agencies", "Diretório de equipes de resposta a incidentes (FIRST)"],
  ["GET /api/v1/territories", "Divisão territorial oficial do Brasil (IBGE)"],
  ["GET /api/v1/health", "Situação do serviço e das fontes"],
];

const PRINCIPLES: readonly string[] = [
  "Dados coletados apenas de conjuntos abertos de instituições oficiais e de projetos públicos de monitoramento.",
  "Cada registro é validado por esquema; registros inválidos são descartados e contabilizados.",
  "Circuit breaker e tempo limite por fonte: a falha de uma instituição não afeta as demais.",
  "Em falha, o último conjunto válido continua servido e é sinalizado como cache.",
  "Gateway e painel compartilham um contrato versionado e validado nos dois lados.",
];

interface ApiDocsModalProps {
  readonly onClose: () => void;
}

export function ApiDocsModal({ onClose }: ApiDocsModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-docs-title"
        className="w-full max-w-2xl rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2
            id="api-docs-title"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink"
          >
            <CodeXml aria-hidden="true" className="h-4 w-4 text-accent" />
            API e arquitetura do gateway
          </h2>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-4 text-xs">
          <section>
            <h3 className="mb-2 font-semibold uppercase tracking-wider text-accent">
              Rotas
            </h3>
            <dl className="divide-y divide-line rounded-lg border border-line">
              {ROUTES.map(([route, description]) => (
                <div
                  key={route}
                  className="grid gap-1 px-3 py-2 sm:grid-cols-[13rem_1fr]"
                >
                  <dt className="font-mono text-ink">{route}</dt>
                  <dd className="text-muted">{description}</dd>
                </div>
              ))}
            </dl>
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-accent hover:underline"
            >
              Testar as rotas no Swagger UI
            </a>
          </section>

          <section>
            <h3 className="mb-2 font-semibold uppercase tracking-wider text-accent">
              Princípios
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {PRINCIPLES.map((principle) => (
                <li key={principle}>{principle}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
