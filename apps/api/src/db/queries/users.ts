import type { Locale, Role, User } from "@gov-dashboard/shared-types";

interface UserRow {
  id: number;
  full_name: string;
  role: Role;
  region_id: number | null;
  agency_id: number | null;
  locale_pref: Locale;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    regionId: row.region_id,
    agencyId: row.agency_id,
    localePref: row.locale_pref,
  };
}

export async function getUserById(db: D1Database, id: number): Promise<User | null> {
  const row = await db
    .prepare(`SELECT id, full_name, role, region_id, agency_id, locale_pref FROM users WHERE id = ?`)
    .bind(id)
    .first<UserRow>();
  return row ? mapUser(row) : null;
}

/** The mock login endpoint has exactly one seeded persona per role (docs/PLAN.md section 6). */
export async function getUserByRole(db: D1Database, role: Role): Promise<User | null> {
  const row = await db
    .prepare(`SELECT id, full_name, role, region_id, agency_id, locale_pref FROM users WHERE role = ? LIMIT 1`)
    .bind(role)
    .first<UserRow>();
  return row ? mapUser(row) : null;
}

export async function storeRefreshToken(
  db: D1Database,
  userId: number,
  tokenHash: string,
  expiresAt: string
): Promise<void> {
  await db
    .prepare(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`)
    .bind(userId, tokenHash, expiresAt)
    .run();
}

interface RefreshTokenRow {
  id: number;
  user_id: number;
}

/** Returns the owning user id if the token hash is valid, unexpired, and unrevoked. */
export async function findValidRefreshToken(db: D1Database, tokenHash: string): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT id, user_id FROM refresh_tokens
       WHERE token_hash = ? AND revoked = 0 AND expires_at > datetime('now')`
    )
    .bind(tokenHash)
    .first<RefreshTokenRow>();
  return row ? row.user_id : null;
}

export async function revokeRefreshToken(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?`).bind(tokenHash).run();
}
