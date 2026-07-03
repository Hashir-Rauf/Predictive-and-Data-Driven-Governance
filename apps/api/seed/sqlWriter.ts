export type SqlLiteral = string | number | boolean | null;

/** Escapes a value for inline SQL. Only ever used on generator-produced seed data, never on user input. */
export function sqlLiteral(value: SqlLiteral): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number in seed data: ${value}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Builds batched multi-row INSERT statements (chunked to keep individual
 * statements a reasonable size for `wrangler d1 execute --file`).
 */
export function buildInsertStatements(
  table: string,
  columns: string[],
  rows: SqlLiteral[][],
  chunkSize = 200
): string[] {
  const statements: string[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuesSql = chunk.map((row) => `(${row.map(sqlLiteral).join(", ")})`).join(",\n  ");
    statements.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES\n  ${valuesSql};`);
  }
  return statements;
}
