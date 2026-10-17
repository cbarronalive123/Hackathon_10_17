import { Pool, QueryResultRow, types } from "pg";

// Parse NUMERIC columns (OID 1700) as JS numbers instead of strings
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

declare global {
  var __noirstayPool: Pool | undefined;
}

export const pool =
  globalThis.__noirstayPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__noirstayPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
