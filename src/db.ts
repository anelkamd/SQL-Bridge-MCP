/**
 * SQL Bridge - Database Connection Module
 * Singleton connection pool with error handling and security
 */

import mysql, { type Pool, type RowDataPacket, type PoolOptions } from "mysql2/promise"
import { getConfig } from "./config.js"

// Singleton pool instance
let pool: Pool | null = null

/**
 * Get or create the MySQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const { database: cfg } = getConfig()

    const poolConfig: PoolOptions = {
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: cfg.connectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: cfg.connectTimeout,
      // Security: Disable multiple statements to prevent SQL injection
      multipleStatements: false,
      // Charset to support international characters
      charset: "utf8mb4",
    }

    pool = mysql.createPool(poolConfig)
  }

  return pool
}

/**
 * Execute a parameterized SQL query with a per-query timeout.
 * @param sql - SQL query with placeholders (?)
 * @param params - Parameters to bind to the query
 * @returns Query results
 */
export async function query<T extends RowDataPacket[]>(
  sql: string,
  params: (string | number | boolean | null)[] = [],
): Promise<T> {
  const { database: cfg } = getConfig()

  try {
    const p = getPool()
    const conn = await p.getConnection()

    try {
      // Set a per-query timeout to prevent long-running queries
      await conn.query(`SET SESSION MAX_EXECUTION_TIME = ${cfg.queryTimeout}`)
      const [rows] = await conn.query<T>(sql, params)
      return rows
    } finally {
      conn.release()
    }
  } catch (error) {
    console.error("[SQL Bridge] Query error:", error instanceof Error ? error.message : String(error))
    throw new Error("Database query failed. Please check your query syntax and parameters.")
  }
}

/**
 * Close the connection pool gracefully
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end()
      pool = null
      console.error("[SQL Bridge] Connection pool closed successfully")
    } catch (error) {
      console.error("[SQL Bridge] Error closing pool:", error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}

/**
 * Test database connectivity
 */
export async function testConnection(): Promise<boolean> {
  try {
    const p = getPool()
    const connection = await p.getConnection()

    try {
      await connection.ping()
      return true
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error(
      "[SQL Bridge] Database connection failed:",
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}

/**
 * Get the name of the connected database
 */
export function getDatabaseName(): string {
  return getConfig().database.database
}

/**
 * Get connection pool statistics.
 * Returns zeroes if the pool is not yet initialised.
 */
export function getPoolStats(): {
  totalConnections: number
  activeConnections: number
  idleConnections: number
} {
  if (!pool) {
    return { totalConnections: 0, activeConnections: 0, idleConnections: 0 }
  }

  // mysql2 exposes an internal .pool property on the PromisePool wrapper.
  // Cast through `unknown` to avoid @ts-ignore.
  const inner = (pool as unknown as { pool: {
    _allConnections?: unknown[]
    _acquiringConnections?: unknown[]
    _freeConnections?: unknown[]
  } }).pool

  return {
    totalConnections: inner?._allConnections?.length ?? 0,
    activeConnections: inner?._acquiringConnections?.length ?? 0,
    idleConnections: inner?._freeConnections?.length ?? 0,
  }
}
