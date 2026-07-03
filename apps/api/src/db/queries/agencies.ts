import type { Agency, OrgType, Sector } from "@gov-dashboard/shared-types";

interface AgencyRow {
  id: number;
  region_id: number | null;
  code: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  sector: Sector;
  org_type: OrgType;
}

function mapAgency(row: AgencyRow): Agency {
  return {
    id: row.id,
    regionId: row.region_id,
    code: row.code,
    nameUz: row.name_uz,
    nameRu: row.name_ru,
    nameEn: row.name_en,
    sector: row.sector,
    orgType: row.org_type,
  };
}

export interface AgencyFilter {
  regionId?: number;
  sector?: Sector;
}

export async function listAgencies(db: D1Database, filter: AgencyFilter = {}): Promise<Agency[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.regionId !== undefined) {
    clauses.push("region_id = ?");
    params.push(filter.regionId);
  }
  if (filter.sector !== undefined) {
    clauses.push("sector = ?");
    params.push(filter.sector);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { results } = await db
    .prepare(
      `SELECT id, region_id, code, name_uz, name_ru, name_en, sector, org_type FROM agencies ${where} ORDER BY name_en`
    )
    .bind(...params)
    .all<AgencyRow>();
  return results.map(mapAgency);
}

export async function getAgencyById(db: D1Database, id: number): Promise<Agency | null> {
  const row = await db
    .prepare(`SELECT id, region_id, code, name_uz, name_ru, name_en, sector, org_type FROM agencies WHERE id = ?`)
    .bind(id)
    .first<AgencyRow>();
  return row ? mapAgency(row) : null;
}

export async function listAllAgencyIds(db: D1Database): Promise<{ id: number; regionId: number | null }[]> {
  const { results } = await db.prepare(`SELECT id, region_id FROM agencies`).all<{ id: number; region_id: number | null }>();
  return results.map((r) => ({ id: r.id, regionId: r.region_id }));
}
