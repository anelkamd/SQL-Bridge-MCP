/**
 * SQL Bridge - Shared Type Definitions
 */

import type { RowDataPacket } from "mysql2/promise"

/** Raw row from information_schema.TABLES */
export interface TableInfoRow extends RowDataPacket {
  TABLE_NAME: string
  TABLE_ROWS: number
  TABLE_COMMENT: string
}

/** Raw row from information_schema.COLUMNS */
export interface ColumnInfoRow extends RowDataPacket {
  TABLE_NAME: string
  COLUMN_NAME: string
  COLUMN_TYPE: string
  IS_NULLABLE: string
  COLUMN_KEY: string
  COLUMN_DEFAULT: string | null
  COLUMN_COMMENT: string
}

/** Processed column for schema output */
export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  key: string | null
  default: string | null
  comment?: string
}

/** Processed table for schema output */
export interface SchemaTable {
  name: string
  rows: number
  comment: string
  columns: SchemaColumn[]
}

/** Full database schema */
export interface FullSchema {
  database: string
  tableCount: number
  tables: SchemaTable[]
  generatedAt: string
}

/** Server statistics */
export interface ServerStats {
  database: string
  connectionPool: {
    totalConnections: number
    activeConnections: number
    idleConnections: number
  }
  rateLimit: {
    current: number
    max: number
    window: string
  }
  uptime: number
  memoryUsage: NodeJS.MemoryUsage
}
