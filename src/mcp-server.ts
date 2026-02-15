/**
 * SQL Bridge - Universal MCP Server
 * Enables LLMs to interact with MySQL databases using natural language
 * with security, validation, and LobeHub compatibility
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js"
import { query, testConnection, getDatabaseName, getPoolStats } from "./db.js"
import type { RowDataPacket } from "mysql2/promise"

// ============================================
// Types and Interfaces
// ============================================

interface TableInfo extends RowDataPacket {
  TABLE_NAME: string
  TABLE_ROWS: number
  TABLE_COMMENT: string
}

interface ColumnInfo extends RowDataPacket {
  COLUMN_NAME: string
  COLUMN_TYPE: string
  IS_NULLABLE: string
  COLUMN_KEY: string
  COLUMN_DEFAULT: string | null
  COLUMN_COMMENT: string
}

interface SchemaTable {
  name: string
  rows: number
  comment: string
  columns: SchemaColumn[]
}

interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  key: string | null
  default: string | null
  comment?: string
}

interface FullSchema {
  database: string
  tableCount: number
  tables: SchemaTable[]
  generatedAt: string
}

// ============================================
// Rate Limiter (Security)
// ============================================

class RateLimiter {
  private requestTimestamps: number[] = []
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests = 10, windowMs = 1000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  async checkLimit(): Promise<void> {
    const now = Date.now()
    const windowStart = now - this.windowMs

    // Remove old timestamps outside the window
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => timestamp > windowStart)

    // Check if we've exceeded the limit
    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestRequest = this.requestTimestamps[0]
      const waitTime = this.windowMs - (now - oldestRequest)

      if (waitTime > 0) {
        console.error(`[SQL Bridge] Rate limit reached. Waiting ${waitTime}ms...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        return this.checkLimit() // Retry after waiting
      }
    }

    // Add current timestamp
    this.requestTimestamps.push(now)
  }

  reset(): void {
    this.requestTimestamps = []
  }

  getStats(): { current: number; max: number; window: string } {
    const now = Date.now()
    const windowStart = now - this.windowMs
    const currentRequests = this.requestTimestamps.filter((timestamp) => timestamp > windowStart).length

    return {
      current: currentRequests,
      max: this.maxRequests,
      window: `${this.windowMs}ms`,
    }
  }
}

const rateLimiter = new RateLimiter(10, 1000) // 10 requests per second

// ============================================
// Validation and Security Functions
// ============================================

/**
 * Validate table name to prevent SQL injection
 */
function validateTableName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "Table name is required")
  }

  const trimmed = name.trim()

  // Only allow alphanumeric and underscores, must start with letter or underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Invalid table name. Only alphanumeric characters and underscores are allowed, must start with a letter or underscore.",
    )
  }

  // Additional security: check length
  if (trimmed.length > 64) {
    throw new McpError(ErrorCode.InvalidParams, "Table name is too long (max 64 characters)")
  }

  return trimmed
}

/**
 * Validate and sanitize SELECT query
 */
function validateSelectQuery(sql: unknown): string {
  if (typeof sql !== "string" || !sql.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "SQL query is required")
  }

  const trimmed = sql.trim()
  const normalized = trimmed.toUpperCase()

  // Must start with SELECT
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
    // Check for keyword as whole word to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, "i")
    if (regex.test(normalized)) {
      throw new McpError(ErrorCode.InvalidParams, `Operation '${keyword}' is not allowed for security reasons`)
    }
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /;\s*\w/i, // Multiple statements
    /--/i, // SQL comments
    /\/\*/i, // Block comments
    /xp_/i, // Extended stored procedures
    /sp_/i, // System stored procedures (be selective)
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      throw new McpError(ErrorCode.InvalidParams, "Query contains potentially dangerous patterns")
    }
  }

  return trimmed
}

/**
 * Validate and sanitize limit parameter
 */
function validateLimit(limit: unknown): number {
  if (limit === undefined || limit === null) {
    return 50 // Default limit
  }

  const num = typeof limit === "number" ? limit : Number.parseInt(String(limit), 10)

  if (isNaN(num) || !Number.isFinite(num)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid limit value")
  }

  if (num < 1) {
    throw new McpError(ErrorCode.InvalidParams, "Limit must be at least 1")
  }

  // Cap at 500 to prevent excessive data transfer
  return Math.min(num, 500)
}

/**
 * Get the full database schema
 */
async function getFullSchema(): Promise<FullSchema> {
  const dbName = getDatabaseName()

  if (!dbName) {
    throw new McpError(ErrorCode.InternalError, "Database name is not configured")
  }

  // Get all tables
  const tables = await query<TableInfo[]>(
    `SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME`,
    [dbName],
  )

  // Get all columns for all tables
  const columns = await query<(ColumnInfo & { TABLE_NAME: string })[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, 
            COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [dbName],
  )

  // Build the schema structure
  const schema: FullSchema = {
    database: dbName,
    tableCount: tables.length,
    tables: tables.map((table) => ({
      name: table.TABLE_NAME,
      rows: table.TABLE_ROWS || 0,
      comment: table.TABLE_COMMENT || "",
      columns: columns
        .filter((c) => c.TABLE_NAME === table.TABLE_NAME)
        .map((c) => ({
          name: c.COLUMN_NAME,
          type: c.COLUMN_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          key: c.COLUMN_KEY || null,
          default: c.COLUMN_DEFAULT,
          comment: c.COLUMN_COMMENT || "",
        })),
    })),
    generatedAt: new Date().toISOString(),
  }

  return schema
}

/**
 * Format query results for human-readable output
 */
function formatQueryResults(rows: RowDataPacket[], limit: number): string {
  if (rows.length === 0) {
    return "No results found."
  }

  const resultCount = rows.length
  const hasMore = resultCount === limit

  let output = `Found ${resultCount} result${resultCount !== 1 ? "s" : ""}${hasMore ? ` (limited to ${limit})` : ""}:\n\n`

  // Format the first few rows
  const displayRows = rows.slice(0, 10)
  output += JSON.stringify(displayRows, null, 2)

  if (resultCount > 10) {
    output += `\n\n... and ${resultCount - 10} more rows`
  }

  return output
}

// ============================================
// MCP Server Creation
// ============================================

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: "sql-bridge-mcp",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  )

  // ----------------------------------------
  // TOOLS: List available tools
  // ----------------------------------------
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "query_database",
          description: `Execute a natural language question or SQL SELECT query on the database.
          
This is the main tool for database interaction. It:
1. Accepts natural language questions or SQL queries
2. Returns schema information to help construct queries
3. Executes SELECT queries safely with validation
4. Returns results in a structured format

Examples:
- "How many users signed up today?"
- "SELECT * FROM products WHERE price > 100 ORDER BY price DESC LIMIT 5"
- "Show me the top 10 customers by order value"

Important: Only SELECT queries are allowed. All other operations (INSERT, UPDATE, DELETE, etc.) are blocked for security.`,
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Natural language question or SQL SELECT query",
              },
              limit: {
                type: "integer",
                description: "Maximum number of results to return (default: 50, max: 500)",
                default: 50,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "list_tables",
          description: "List all tables in the database with row counts and descriptions",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "describe_table",
          description: "Get detailed information about a specific table including all columns, types, and constraints",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Name of the table to describe",
              },
            },
            required: ["table"],
          },
        },
        {
          name: "sample_data",
          description: "Get sample rows from a table to understand the data structure and content",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Name of the table to sample",
              },
              limit: {
                type: "integer",
                description: "Number of sample rows (default: 5, max: 20)",
                default: 5,
              },
            },
            required: ["table"],
          },
        },
        {
          name: "get_schema",
          description: "Get the complete database schema with all tables and columns",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "server_stats",
          description: "Get server statistics including connection pool status and rate limiter info",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    }
  })

  // ----------------------------------------
  // TOOLS: Handle tool execution
  // ----------------------------------------
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      await rateLimiter.checkLimit()

      switch (name) {
        case "query_database": {
          const queryText = args?.query
          if (!queryText || typeof queryText !== "string") {
            throw new McpError(ErrorCode.InvalidParams, "Query parameter is required")
          }

          // If it's a natural language question, return schema to help construct SQL
          if (!queryText.trim().toUpperCase().startsWith("SELECT")) {
            const schema = await getFullSchema()
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      type: "schema_info",
                      message:
                        "This appears to be a natural language question. Here's the database schema to help you construct a SQL query:",
                      schema: {
                        database: schema.database,
                        tables: schema.tables.map((t) => ({
                          name: t.name,
                          rows: t.rows,
                          columns: t.columns.map((c) => `${c.name} (${c.type})`),
                        })),
                      },
                      instructions: [
                        "1. Analyze the question and identify relevant tables/columns",
                        "2. Construct an appropriate SELECT query",
                        "3. Call this tool again with the SQL query",
                      ],
                    },
                    null,
                    2,
                  ),
                },
              ],
            }
          }

          // Execute SQL query
          const validatedSql = validateSelectQuery(queryText)
          const limit = validateLimit(args?.limit)

          // Add LIMIT if not present
          const sqlWithLimit = validatedSql.toUpperCase().includes("LIMIT")
            ? validatedSql
            : `${validatedSql} LIMIT ${limit}`

          const rows = await query<RowDataPacket[]>(sqlWithLimit)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    rowCount: rows.length,
                    data: rows,
                    query: validatedSql,
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        case "list_tables": {
          const dbName = getDatabaseName()
          const tables = await query<TableInfo[]>(
            `SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT 
             FROM information_schema.TABLES 
             WHERE TABLE_SCHEMA = ?
             ORDER BY TABLE_NAME`,
            [dbName],
          )

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    database: dbName,
                    tableCount: tables.length,
                    tables: tables.map((t) => ({
                      name: t.TABLE_NAME,
                      rows: t.TABLE_ROWS || 0,
                      comment: t.TABLE_COMMENT || "",
                    })),
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        case "describe_table": {
          const tableName = validateTableName(args?.table)
          const dbName = getDatabaseName()

          const columns = await query<ColumnInfo[]>(
            `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY,
                    COLUMN_DEFAULT, COLUMN_COMMENT
             FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
             ORDER BY ORDINAL_POSITION`,
            [dbName, tableName],
          )

          if (columns.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, `Table '${tableName}' not found in database '${dbName}'`)
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    table: tableName,
                    columnCount: columns.length,
                    columns: columns.map((c) => ({
                      name: c.COLUMN_NAME,
                      type: c.COLUMN_TYPE,
                      nullable: c.IS_NULLABLE === "YES",
                      key: c.COLUMN_KEY || null,
                      default: c.COLUMN_DEFAULT,
                      comment: c.COLUMN_COMMENT || "",
                    })),
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        case "sample_data": {
          const tableName = validateTableName(args?.table)
          const limit = Math.min(validateLimit(args?.limit), 20)

          const rows = await query<RowDataPacket[]>(`SELECT * FROM \`${tableName}\` LIMIT ?`, [limit])

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    table: tableName,
                    sampleSize: rows.length,
                    data: rows,
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        case "get_schema": {
          const schema = await getFullSchema()

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(schema, null, 2),
              },
            ],
          }
        }

        case "server_stats": {
          const poolStats = getPoolStats()
          const rateLimitStats = rateLimiter.getStats()

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    database: getDatabaseName(),
                    connectionPool: poolStats,
                    rateLimit: rateLimitStats,
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error
      }

      const msg = error instanceof Error ? error.message : "Unknown error occurred"
      console.error("[SQL Bridge] Tool execution error:", msg)
      throw new McpError(ErrorCode.InternalError, `Database operation failed: ${msg}`)
    }
  })

  // ----------------------------------------
  // RESOURCES: List available resources
  // ----------------------------------------
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "sqlbridge://schema",
          name: "Database Schema",
          description: "Complete database schema with all tables and columns",
          mimeType: "application/json",
        },
        {
          uri: "sqlbridge://stats",
          name: "Server Statistics",
          description: "Connection pool and server statistics",
          mimeType: "application/json",
        },
      ],
    }
  })

  // ----------------------------------------
  // RESOURCES: Read resource content
  // ----------------------------------------
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params

    await rateLimiter.checkLimit()

    switch (uri) {
      case "sqlbridge://schema": {
        const schema = await getFullSchema()
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(schema, null, 2),
            },
          ],
        }
      }

      case "sqlbridge://stats": {
        const poolStats = getPoolStats()
        const rateLimitStats = rateLimiter.getStats()

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  database: getDatabaseName(),
                  connectionPool: poolStats,
                  rateLimit: rateLimitStats,
                  uptime: process.uptime(),
                  memoryUsage: process.memoryUsage(),
                },
                null,
                2,
              ),
            },
          ],
        }
      }

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`)
    }
  })

  // ----------------------------------------
  // PROMPTS: List available prompts
  // ----------------------------------------
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "sql_assistant",
          description: "Natural language SQL assistant that helps explore and query the database",
          arguments: [],
        },
        {
          name: "data_analyst",
          description: "Data analysis assistant that generates insights from database queries",
          arguments: [
            {
              name: "focus",
              description: "Area of analysis (e.g., 'sales', 'users', 'performance')",
              required: false,
            },
          ],
        },
      ],
    }
  })

  // ----------------------------------------
  // PROMPTS: Get prompt content
  // ----------------------------------------
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    const schema = await getFullSchema()

    switch (name) {
      case "sql_assistant": {
        const schemaDescription = schema.tables
          .map(
            (t) =>
              `\n### ${t.name} (${t.rows} rows)\n` +
              `Columns: ${t.columns.map((c) => `${c.name} (${c.type}${c.nullable ? ", nullable" : ""})`).join(", ")}`,
          )
          .join("\n")

        return {
          description: "SQL Assistant with database context",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `You are a helpful SQL assistant with access to the "${schema.database}" MySQL database.

DATABASE SCHEMA:
${schemaDescription}

AVAILABLE TOOLS:
- query_database: Execute SELECT queries or ask natural language questions
- list_tables: List all available tables
- describe_table: Get detailed table structure
- sample_data: View sample rows from a table
- get_schema: Get complete database schema

GUIDELINES:
1. Always validate user questions and suggest appropriate queries
2. Use parameterized queries and explain security considerations
3. Provide clear, human-readable explanations of results
4. Suggest optimizations when relevant (indexes, query structure)
5. Be proactive in offering insights and analysis

SECURITY:
- Only SELECT queries are permitted
- All queries are validated and sanitized
- Rate limiting is active (10 requests/second)

How can I help you explore this database?`,
              },
            },
          ],
        }
      }

      case "data_analyst": {
        const focus = args?.focus || "general"

        return {
          description: "Data Analysis Assistant",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `You are a data analyst helping to derive insights from the "${schema.database}" database.

ANALYSIS FOCUS: ${focus}

DATABASE INFO:
- ${schema.tableCount} tables with ${schema.tables.reduce((sum, t) => sum + t.rows, 0).toLocaleString()} total rows
- Tables: ${schema.tables.map((t) => t.name).join(", ")}

YOUR ROLE:
1. Understand the user's analysis goals
2. Design appropriate queries to extract relevant data
3. Analyze results and identify patterns, trends, anomalies
4. Present findings clearly with context and recommendations
5. Suggest follow-up analyses when relevant

Start by asking what specific insights the user is looking for in the ${focus} area.`,
              },
            },
          ],
        }
      }

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`)
    }
  })

  return server
}

// ============================================
// Server Startup
// ============================================

export async function startMcpServer(): Promise<void> {
  console.error("[SQL Bridge] Starting server...")

  // Test database connection
  const connected = await testConnection()
  if (!connected) {
    console.error("[SQL Bridge] ERROR: Unable to connect to MySQL database")
    console.error("[SQL Bridge] Please check your environment variables and database configuration")
    process.exit(1)
  }

  const dbName = getDatabaseName()
  console.error(`[SQL Bridge] Connected to database: ${dbName}`)

  // Create and start the MCP server
  const server = createMcpServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)

  console.error("[SQL Bridge] MCP Server ready (stdio transport)")
  console.error("[SQL Bridge] Waiting for requests...")
}
