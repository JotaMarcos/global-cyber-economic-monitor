/**
 * Verificação ao vivo das integrações: consulta cada fonte real uma vez e
 * relata registros válidos, rejeitados e latência. Encerra com código 1 se
 * alguma fonte falhar, o que permite o uso em rotinas agendadas.
 *
 * Uso: npm run verify:sources
 */
import type { ThreatSource } from "../src/gateway/application/ports.ts";
import { FetchHttpClient } from "../src/gateway/infrastructure/http/fetch-http-client.ts";
import { CisaKevSource } from "../src/gateway/infrastructure/sources/cisa-kev-source.ts";
import { FeodoTrackerSource } from "../src/gateway/infrastructure/sources/feodo-tracker-source.ts";
import { FirstTeamsSource } from "../src/gateway/infrastructure/sources/first-teams-source.ts";
import { IbgeLocalitiesSource } from "../src/gateway/infrastructure/sources/ibge-localities-source.ts";
import { NistNvdSource } from "../src/gateway/infrastructure/sources/nist-nvd-source.ts";
import { RansomwareLiveSource } from "../src/gateway/infrastructure/sources/ransomware-live-source.ts";
import { SansIscSource } from "../src/gateway/infrastructure/sources/sans-isc-source.ts";
import { SpamhausDropSource } from "../src/gateway/infrastructure/sources/spamhaus-drop-source.ts";
import { SystemClock } from "../src/gateway/infrastructure/system/system.ts";

const http = new FetchHttpClient((input, init) => fetch(input, init));
const sources: ThreatSource<unknown>[] = [
  new RansomwareLiveSource(http),
  new CisaKevSource(http),
  new NistNvdSource(http, new SystemClock()),
  new SansIscSource(http),
  new FeodoTrackerSource(http),
  new SpamhausDropSource(http),
  new FirstTeamsSource(http),
  new IbgeLocalitiesSource(http),
];

const results = await Promise.all(
  sources.map(async (source) => {
    const { name, timeoutMs } = source.descriptor;
    const startedAt = Date.now();
    try {
      const reading = await source.read(AbortSignal.timeout(timeoutMs));
      return {
        fonte: name,
        situacao: "OK",
        validos: reading.recordCount,
        rejeitados: reading.rejectedCount,
        latenciaMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        fonte: name,
        situacao: `FALHA: ${error instanceof Error ? error.message : String(error)}`,
        validos: 0,
        rejeitados: 0,
        latenciaMs: Date.now() - startedAt,
      };
    }
  }),
);

console.table(results);
process.exitCode = results.every((result) => result.situacao === "OK") ? 0 : 1;
