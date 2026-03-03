/**
 * SQL Bridge - Input Validation & Sanitization
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"

/**
 * Validate table name to prevent SQL injection.
 * Only allows alphanumeric characters and underscores, starting with a letter or underscore.
 */
export function validateTableName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "Table name is required")
  }

  const trimmed = name.trim()

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Invalid table name. Only alphanumeric characters and underscores are allowed, must start with a letter or underscore.",
    )
  }

  if (trimmed.length > 64) {
    throw new McpError(ErrorCode.InvalidParams, "Table name is too long (max 64 characters)")
  }

  return trimmed
}

/**
 * Validate and sanitize a SELECT query.
 * Blocks any data-modification or dangerous operations.
 */
export function validateSelectQuery(sql: unknown): string {
  if (typeof sql !== "string" || !sql.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "SQL query is required")
  }

  const trimmed = sql.trim()
  const normalized = trimmed.toUpperCase()

  if (!normalized.startsWith("SELECT")) {
    throw new McpError(ErrorCode.InvalidParams, "Only SELECT queries are allowed")
  }

  // Forbidden keywords that could modify data or structure
  const forbidden = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "CALL",
    "LOAD_FILE",
    "OUTFILE",
    "DUMPFILE",
    "INTO",
  ]

  for (const keyword of forbidden) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i")
    if (regex.test(normalized)) {
      throw new McpError(ErrorCode.InvalidParams, `Operation '${keyword}' is not allowed for security reasons`)
    }
  }

  // Dangerous patterns
  const dangerousPatterns = [
    /;\s*\w/i, // Multiple statements
    /--/i, // SQL line comments
    /\/\*/i, // SQL block comments
    /xp_/i, // Extended stored procedures (SQL Server)
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      throw new McpError(ErrorCode.InvalidParams, "Query contains potentially dangerous patterns")
    }
  }

  return trimmed
}

/**
 * Validate and clamp a limit parameter.
 * Returns a safe integer between 1 and `maxAllowed`.
 */
export function validateLimit(limit: unknown, maxAllowed = 500): number {
  if (limit === undefined || limit === null) {
    return 50
  }

  const num = typeof limit === "number" ? limit : Number.parseInt(String(limit), 10)

  if (isNaN(num) || !Number.isFinite(num)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid limit value")
  }

  if (num < 1) {
    throw new McpError(ErrorCode.InvalidParams, "Limit must be at least 1")
  }

  return Math.min(num, maxAllowed)
}
