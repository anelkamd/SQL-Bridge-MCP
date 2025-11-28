/**
 * SQL Bridge - Module de connexion MySQL
 * Pool de connexions singleton avec gestion d'erreurs
 */

import mysql, { type Pool, type RowDataPacket } from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

// Configuration depuis les variables d'environnement
const poolConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
}

// Pool singleton
let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(poolConfig)
  }
  return pool
}

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T> {
  const p = getPool()
  const [rows] = await p.query<T>(sql, params)
  return rows
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const p = getPool()
    const connection = await p.getConnection()
    await connection.ping()
    connection.release()
    return true
  } catch (error) {
    console.error("[SQL Bridge] Erreur de connexion:", error)
    return false
  }
}

export function getDatabaseName(): string {
  return process.env.MYSQL_DATABASE || ""
}
