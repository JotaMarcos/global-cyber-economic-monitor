import { computeKpis, type OrganizationKpis } from "../../domain/organization/kpis";
import type { Organization } from "../../domain/organization/organization";
import {
  filterOrganizations,
  type OrganizationFilter,
} from "../../domain/organization/organization-filter";
import {
  summarizeBySector,
  type SectorSummary,
} from "../../domain/organization/sector-summary";
import type { OrganizationRepository } from "../ports/organization-repository";

export interface OrganizationOverview {
  readonly organizations: readonly Organization[];
  readonly sectorSummary: readonly SectorSummary[];
  readonly kpis: OrganizationKpis;
}

/** Consulta: organizações do recorte filtrado com seus agregados. */
export class GetOrganizationOverviewUseCase {
  constructor(private readonly repository: OrganizationRepository) {}

  execute(
    filter: OrganizationFilter,
    ddosSimulationActive: boolean,
  ): OrganizationOverview {
    const organizations = filterOrganizations(this.repository.findAll(), filter);
    return {
      organizations,
      sectorSummary: summarizeBySector(organizations),
      kpis: computeKpis(organizations, ddosSimulationActive),
    };
  }
}
