import type { OrganizationRepository } from "../../application/ports/organization-repository";
import type { Organization } from "../../domain/organization/organization";

export class StaticOrganizationRepository implements OrganizationRepository {
  constructor(private readonly organizations: readonly Organization[]) {}

  findAll(): readonly Organization[] {
    return this.organizations;
  }
}
