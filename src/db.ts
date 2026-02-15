/**
 * SQL Bridge - Database Connection Module
 * Singleton connection pool with error handling and security
 */

import mysql, { type Pool, type RowDataPacket, type PoolOptions } from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

/**
 * Database configuration from environment variables
 */
interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  connectionLimit: number
  connectTimeout: number
  waitForConnections: boolean
  queueLimit: number
  enableKeepAlive: boolean
  keepAliveInitialDelay: number
}

/**
 * Get database configuration from environment variables
 */
function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "",
    connectionLimit: Number.parseInt(process.env.MYSQL_CONNECTION_LIMIT || "10", 10),
    connectTimeout: Number.parseInt(process.env.MYSQL_CONNECT_TIMEOUT || "10000", 10),
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  }
}

/**
 * Validate database configuration
 */
function validateConfig(config: DatabaseConfig): void {
  if (!config.database) {
    throw new Error(
      "MYSQL_DATABASE environment variable is required. Please set it in your .env file or environment.",
    )
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid MYSQL_PORT: ${config.port}. Must be between 1 and 65535.`)
  }

  if (config.connectionLimit < 1 || config.connectionLimit > 100) {
    throw new Error(`Invalid connection limit: ${config.connectionLimit}. Must be between 1 and 100.`)
  }
}

// Singleton pool instance
let pool: Pool | null = null

/**
 * Get or create the MySQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const config = getDatabaseConfig()
    validateConfig(config)

    const poolConfig: PoolOptions = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: config.waitForConnections,
      connectionLimit: config.connectionLimit,
      queueLimit: config.queueLimit,
      enableKeepAlive: config.enableKeepAlive,
      keepAliveInitialDelay: config.keepAliveInitialDelay,
      connectTimeout: config.connectTimeout,
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
 * Execute a parameterized SQL query
 * @param sql - SQL query with placeholders (?)
 * @param params - Parameters to bind to the query
 * @returns Query results
 */
export async function query<T extends RowDataPacket[]>(
  sql: string,
  params: (string | number | boolean | null)[] = [],
): Promise<T> {
  try {
    const p = getPool()
    const [rows] = await p.query<T>(sql, params)
    return rows
  } catch (error) {
    // Log the error but don't expose sensitive SQL details
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
 * @returns true if connection is successful, false otherwise
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
  const config = getDatabaseConfig()
  return config.database
}

/**
 * Get connection pool statistics
 */
export function getPoolStats(): {
  totalConnections: number
  activeConnections: number
  idleConnections: number
} {
  if (!pool) {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
    }
  }

  // @ts-ignore - Accessing private pool properties for monitoring
  const poolStats = pool.pool
  return {
    totalConnections: poolStats?._allConnections?.length || 0,
    activeConnections: poolStats?._acquiringConnections?.length || 0,
    idleConnections: poolStats?._freeConnections?.length || 0,
  }
}
