/**
 * SQL Bridge - Schema & Stats Helpers
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { query, getDatabaseName, getPoolStats } from "./db.js"
import { RateLimiter } from "./rate-limiter.js"
import type { TableInfoRow, ColumnInfoRow, FullSchema, SchemaColumn, ServerStats } from "./types.js"

/**
 * Get the full database schema.
 * Uses a Map for O(1) column-to-table lookup instead of repeated .filter() calls.
 */
export async function getFullSchema(): Promise<FullSchema> {
  const dbName = getDatabaseName()

  if (!dbName) {
    throw new McpError(ErrorCode.InternalError, "Database name is not configured")
  }

  const [tables, columns] = await Promise.all([
    query<TableInfoRow[]>(
      `SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [dbName],
    ),
    query<ColumnInfoRow[]>(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
              COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [dbName],
    ),
  ])

  // Build a Map<tableName, SchemaColumn[]> for O(1) lookup
  const columnsByTable = new Map<string, SchemaColumn[]>()
  for (const c of columns) {
    const list = columnsByTable.get(c.TABLE_NAME) ?? []
    list.push({
      name: c.COLUMN_NAME,
      type: c.COLUMN_TYPE,
      nullable: c.IS_NULLABLE === "YES",
      key: c.COLUMN_KEY || null,
      default: c.COLUMN_DEFAULT,
      comment: c.COLUMN_COMMENT || "",
    })
    columnsByTable.set(c.TABLE_NAME, list)
  }

  return {
    database: dbName,
    tableCount: tables.length,
    tables: tables.map((t) => ({
      name: t.TABLE_NAME,
      rows: t.TABLE_ROWS || 0,
      comment: t.TABLE_COMMENT || "",
      columns: columnsByTable.get(t.TABLE_NAME) ?? [],
    })),
    generatedAt: new Date().toISOString(),
  }
}

/**
 * List tables with row counts (lightweight — no column info).
 */
export async function listTables(): Promise<{ name: string; rows: number; comment: string }[]> {
  const dbName = getDatabaseName()

  const tables = await query<TableInfoRow[]>(
    `SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME`,
    [dbName],
  )

  return tables.map((t) => ({
    name: t.TABLE_NAME,
    rows: t.TABLE_ROWS || 0,
    comment: t.TABLE_COMMENT || "",
  }))
}

/**
 * Collect server statistics (shared between tool and resource).
 */
export function getServerStats(rateLimiter: RateLimiter): ServerStats {
  return {
    database: getDatabaseName(),
    connectionPool: getPoolStats(),
    rateLimit: rateLimiter.getStats(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  }
}
