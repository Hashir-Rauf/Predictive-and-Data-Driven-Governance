export interface AuditEntry {
  userId: number | null;
  action: string;
  entityType?: string;
  entityId?: number;
  ipHash?: string;
}

export interface AuditLogRow {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  at: string;
}

export async function listAuditLog(db: D1Database, limit = 100): Promise<AuditLogRow[]> {
  const { results } = await db
    .prepare(
      `SELECT al.id as id, al.user_id as userId, u.full_name as userName, al.action as action,
              al.entity_type as entityType, al.entity_id as entityId, al.at as at
       FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.at DESC LIMIT ?`
    )
    .bind(Math.min(limit, 500))
    .all<AuditLogRow>();
  return results;
}

export async function logAudit(db: D1Database, entry: AuditEntry): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_hash) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(entry.userId, entry.action, entry.entityType ?? null, entry.entityId ?? null, entry.ipHash ?? null)
    .run();
}
