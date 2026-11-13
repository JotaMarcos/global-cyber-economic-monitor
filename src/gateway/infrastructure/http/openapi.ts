import { z } from "zod";
import {
  agencyDirectorySchema,
  CONTRACT_VERSION,
  territoryDirectorySchema,
  threatSnapshotSchema,
} from "../../../contract/threat-snapshot.ts";

type JsonObject = Record<string, unknown>;

/** Esquema JSON derivado do contrato, sem o cabeçalho `$schema`. */
function fromContract(schema: z.ZodType): JsonObject {
  const document: JsonObject = { ...z.toJSONSchema(schema) };
  delete document.$schema;
  return document;
}

const ref = (name: string): JsonObject => ({ $ref: `#/components/schemas/${name}` });

const json = (schema: JsonObject): JsonObject => ({
  "application/json": { schema },
});

const errorResponse = (description: string): JsonObject => ({
  description,
  content: json(ref("Error")),
});

const COMMON_RESPONSES: JsonObject = {
  "429": errorResponse("Limite de requisições por cliente excedido."),
};

/**
 * Documento OpenAPI 3.1 da API do gateway. Os esquemas das respostas são
 * gerados a partir do contrato publicado, e por isso não divergem dele.
 */
export function buildOpenApiDocument(): JsonObject {
  return {
    openapi: "3.1.0",
    info: {
      title: "Global Cyber & Economic Monitor: API do gateway",
      version: CONTRACT_VERSION,
      description:
        "API somente de leitura (GET e HEAD) que publica o retrato consolidado das fontes públicas de inteligência de ameaças. Todas as respostas seguem o contrato versionado em `src/contract/threat-snapshot.ts`.",
    },
    servers: [{ url: "/", description: "Mesma origem desta documentação" }],
    tags: [
      { name: "Retrato", description: "Dados consolidados das fontes" },
      { name: "Referência", description: "Diretórios de apoio aos filtros" },
      { name: "Operação", description: "Situação do serviço" },
    ],
    paths: {
      "/api/v1/snapshot": {
        get: {
          tags: ["Retrato"],
          summary: "Retrato consolidado atual",
          description:
            "Incidentes, vulnerabilidades, servidores de comando e controle, origens de ataque e situação de cada fonte.",
          responses: {
            "200": {
              description: "Retrato atual.",
              content: json(ref("ThreatSnapshot")),
            },
            ...COMMON_RESPONSES,
          },
        },
      },
      "/api/v1/stream": {
        get: {
          tags: ["Retrato"],
          summary: "Fluxo contínuo do retrato (Server-Sent Events)",
          description:
            "Envia um evento `snapshot` ao conectar e outro a cada nova coleta; o campo `data` de cada evento é um `ThreatSnapshot` em JSON. A conexão permanece aberta, e por isso o botão Execute desta página não conclui: teste com `curl -N http://127.0.0.1:8787/api/v1/stream`.",
          responses: {
            "200": {
              description: "Fluxo de eventos aberto.",
              content: { "text/event-stream": { schema: { type: "string" } } },
            },
            "503": errorResponse("Limite de conexões de streaming atingido."),
            ...COMMON_RESPONSES,
          },
        },
      },
      "/api/v1/agencies": {
        get: {
          tags: ["Referência"],
          summary: "Diretório de equipes de resposta a incidentes (FIRST)",
          responses: {
            "200": {
              description: "Diretório atual.",
              content: json(ref("AgencyDirectory")),
            },
            ...COMMON_RESPONSES,
          },
        },
      },
      "/api/v1/territories": {
        get: {
          tags: ["Referência"],
          summary: "Divisão territorial oficial do Brasil (IBGE)",
          responses: {
            "200": {
              description: "Unidades da federação e municípios.",
              content: json(ref("TerritoryDirectory")),
            },
            ...COMMON_RESPONSES,
          },
        },
      },
      "/api/v1/health": {
        get: {
          tags: ["Operação"],
          summary: "Situação do serviço e das fontes",
          responses: {
            "200": { description: "Situação atual.", content: json(ref("Health")) },
            ...COMMON_RESPONSES,
          },
        },
      },
    },
    components: {
      schemas: {
        ThreatSnapshot: fromContract(threatSnapshotSchema),
        AgencyDirectory: fromContract(agencyDirectorySchema),
        TerritoryDirectory: fromContract(territoryDirectorySchema),
        Health: {
          type: "object",
          required: [
            "status",
            "uptimeSeconds",
            "sourcesOnline",
            "sourcesTotal",
            "streamClients",
          ],
          properties: {
            status: { type: "string", enum: ["ok", "degraded", "starting"] },
            uptimeSeconds: { type: "integer", minimum: 0 },
            sourcesOnline: { type: "integer", minimum: 0 },
            sourcesTotal: { type: "integer", minimum: 0 },
            streamClients: { type: "integer", minimum: 0 },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["status", "message"],
              properties: {
                status: { type: "integer" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  };
}
