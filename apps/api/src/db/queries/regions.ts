import type { Region } from "@gov-dashboard/shared-types";

interface RegionRow {
  id: number;
  code: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  population: number;
  is_capital: number;
}

function mapRegion(row: RegionRow): Region {
  return {
    id: row.id,
    code: row.code,
    nameUz: row.name_uz,
    nameRu: row.name_ru,
    nameEn: row.name_en,
    population: row.population,
    isCapital: row.is_capital === 1,
  };
}

export async function listRegions(db: D1Database): Promise<Region[]> {
  const { results } = await db
    .prepare(`SELECT id, code, name_uz, name_ru, name_en, population, is_capital FROM regions ORDER BY name_en`)
    .all<RegionRow>();
  return results.map(mapRegion);
}

export async function getRegionById(db: D1Database, id: number): Promise<Region | null> {
  const row = await db
    .prepare(`SELECT id, code, name_uz, name_ru, name_en, population, is_capital FROM regions WHERE id = ?`)
    .bind(id)
    .first<RegionRow>();
  return row ? mapRegion(row) : null;
}
