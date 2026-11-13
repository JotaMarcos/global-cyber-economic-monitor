import type { Organization } from "../../domain/organization/organization";

export interface OrganizationRepository {
  findAll(): readonly Organization[];
}
