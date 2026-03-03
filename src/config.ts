/**
 * SQL Bridge - Configuration Module
 * Zod-validated configuration from environment variables
 */

import { z } from "zod"
import dotenv from "dotenv"

dotenv.config()

const DatabaseConfigSchema = z.object({
  host: z.string().min(1).default("localhost"),
  port: z.coerce.number().int().min(1).max(65535).default(3306),
  user: z.string().min(1).default("root"),
  password: z.string().default(""),
  database: z.string().min(1, "MYSQL_DATABASE environment variable is required"),
  connectionLimit: z.coerce.number().int().min(1).max(100).default(10),
  connectTimeout: z.coerce.number().int().min(1000).max(60000).default(10000),
  queryTimeout: z.coerce.number().int().min(1000).max(120000).default(30000),
})

const RateLimitConfigSchema = z.object({
  maxRequests: z.coerce.number().int().min(1).max(100).default(10),
  windowMs: z.coerce.number().int().min(100).max(60000).default(1000),
})

const AppConfigSchema = z.object({
  database: DatabaseConfigSchema,
  rateLimit: RateLimitConfigSchema,
})

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>
export type AppConfig = z.infer<typeof AppConfigSchema>

let cachedConfig: AppConfig | null = null

/**
 * Parse and validate configuration from environment variables.
 * Result is cached after the first call.
 */
export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig

  const result = AppConfigSchema.safeParse({
    database: {
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      connectionLimit: process.env.MYSQL_CONNECTION_LIMIT,
      connectTimeout: process.env.MYSQL_CONNECT_TIMEOUT,
      queryTimeout: process.env.MYSQL_QUERY_TIMEOUT,
    },
    rateLimit: {
      maxRequests: process.env.RATE_LIMIT_MAX,
      windowMs: process.env.RATE_LIMIT_WINDOW_MS,
    },
  })

  if (!result.success) {
    const messages = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    throw new Error(`Invalid configuration:\n${messages.join("\n")}`)
  }

  cachedConfig = result.data
  return cachedConfig
}
