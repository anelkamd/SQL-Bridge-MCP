/**
 * SQL Bridge - MCP Tool Handlers
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import type { RowDataPacket } from "mysql2/promise"
import { query, getDatabaseName } from "../db.js"
import { RateLimiter } from "../rate-limiter.js"
import { validateTableName, validateSelectQuery, validateLimit } from "../validation.js"
import { getFullSchema, listTables, getServerStats } from "../schema.js"
import type { ColumnInfoRow } from "../types.js"

export function registerToolHandlers(server: Server, rateLimiter: RateLimiter): void {
  // ---- List available tools ----
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "query_database",
        description:
          "Execute a SQL SELECT query or a natural language question against the connected MySQL database. " +
          "For natural language questions, returns the database schema so you can construct a SELECT query. " +
          "For SQL queries, validates and executes them safely with parameterized limits. " +
          "Only SELECT statements are permitted — INSERT, UPDATE, DELETE, DROP, and all other write operations are blocked.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "A SQL SELECT statement (e.g. 'SELECT name, email FROM users WHERE active = 1') " +
                "or a natural language question (e.g. 'How many orders were placed this month?')",
            },
            limit: {
              type: "integer",
              description: "Maximum number of rows to return. Capped at 500.",
              default: 50,
              minimum: 1,
              maximum: 500,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list_tables",
        description:
          "List all tables in the connected MySQL database. Returns each table's name, approximate row count, and comment.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "describe_table",
        description:
          "Get the full column-level schema of a specific table, including column names, data types, " +
          "nullability, key constraints (PRI/UNI/MUL), default values, and comments.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "Exact name of the table to describe (alphanumeric and underscores only, max 64 chars)",
              pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$",
              maxLength: 64,
            },
          },
          required: ["table"],
        },
      },
      {
        name: "sample_data",
        description:
          "Retrieve a small set of sample rows from a table to preview its data structure, content, and value formats.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "Exact name of the table to sample (alphanumeric and underscores only, max 64 chars)",
              pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$",
              maxLength: 64,
            },
            limit: {
              type: "integer",
              description: "Number of sample rows to return. Capped at 20.",
              default: 5,
              minimum: 1,
              maximum: 20,
            },
          },
          required: ["table"],
        },
      },
      {
        name: "get_schema",
        description:
          "Get the complete database schema — all tables with every column's name, type, nullability, key, " +
          "default value, and comment. Also includes row counts and a generation timestamp.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "server_stats",
        description:
          "Get live server health metrics: connection pool status (total/active/idle), rate limiter state, " +
          "process uptime in seconds, and Node.js memory usage (rss, heapUsed, heapTotal).",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }))

  // ---- Execute tool calls ----
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

          // Natural language → return schema context
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

          // SQL query → validate & execute
          const validatedSql = validateSelectQuery(queryText)
          const limit = validateLimit(args?.limit)

          // Parameterized LIMIT for defense in depth
          const hasLimit = validatedSql.toUpperCase().includes("LIMIT")
          const finalSql = hasLimit ? validatedSql : `${validatedSql} LIMIT ?`
          const params = hasLimit ? [] : [limit]

          const rows = await query<RowDataPacket[]>(finalSql, params)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, rowCount: rows.length, data: rows, query: validatedSql }, null, 2),
              },
            ],
          }
        }

        case "list_tables": {
          const dbName = getDatabaseName()
          const tables = await listTables()

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, database: dbName, tableCount: tables.length, tables }, null, 2),
              },
            ],
          }
        }

        case "describe_table": {
          const tableName = validateTableName(args?.table)
          const dbName = getDatabaseName()

          const columns = await query<ColumnInfoRow[]>(
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
                text: JSON.stringify({ success: true, table: tableName, sampleSize: rows.length, data: rows }, null, 2),
              },
            ],
          }
        }

        case "get_schema": {
          const schema = await getFullSchema()
          return { content: [{ type: "text", text: JSON.stringify(schema, null, 2) }] }
        }

        case "server_stats": {
          const stats = getServerStats(rateLimiter)
          return { content: [{ type: "text", text: JSON.stringify({ success: true, ...stats }, null, 2) }] }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
      }
    } catch (error) {
      if (error instanceof McpError) throw error

      const msg = error instanceof Error ? error.message : "Unknown error occurred"
      console.error("[SQL Bridge] Tool execution error:", msg)
      throw new McpError(ErrorCode.InternalError, `Database operation failed: ${msg}`)
    }
  })
}
