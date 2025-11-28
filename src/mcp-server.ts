/**
 * SQL Bridge - MCP Server Universel
 * Permet a n'importe quel LLM d'interagir avec une base MySQL
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
import { query, testConnection, getDatabaseName } from "./db.js"
import type { RowDataPacket } from "mysql2/promise"

// ============================================
// Types
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

// ============================================
// Rate Limiter (securite)
// ============================================
class RateLimiter {
  private lastRequestTime = 0
  private minInterval: number

  constructor(requestsPerSecond = 5) {
    this.minInterval = 1000 / requestsPerSecond
  }

  async checkLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise((resolve) => setTimeout(resolve, this.minInterval - timeSinceLastRequest))
    }
    this.lastRequestTime = Date.now()
  }
}

const rateLimiter = new RateLimiter(5)

// ============================================
// Validation et Securite
// ============================================
function validateTableName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "Nom de table requis")
  }
  // Securite: empecher injection SQL dans les noms de table
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new McpError(ErrorCode.InvalidParams, "Nom de table invalide (alphanumerique et underscore uniquement)")
  }
  return name
}

function validateSelectQuery(sql: unknown): string {
  if (typeof sql !== "string" || !sql.trim()) {
    throw new McpError(ErrorCode.InvalidParams, "Requete SQL requise")
  }

  const normalized = sql.trim().toUpperCase()

  // Securite: uniquement SELECT autorise
  if (!normalized.startsWith("SELECT")) {
    throw new McpError(ErrorCode.InvalidParams, "Seules les requetes SELECT sont autorisees")
  }

  // Bloquer les operations dangereuses
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
  ]

  for (const keyword of forbidden) {
    if (normalized.includes(keyword)) {
      throw new McpError(ErrorCode.InvalidParams, `Operation '${keyword}' non autorisee`)
    }
  }

  return sql.trim()
}

function validateLimit(limit: unknown): number {
  if (limit === undefined || limit === null) return 50
  const num = typeof limit === "number" ? limit : Number.parseInt(String(limit), 10)
  if (isNaN(num) || num < 1) return 50
  return Math.min(num, 500) // Max 500 lignes
}

// ============================================
// Creation du serveur MCP
// ============================================
export function createMcpServer(): Server {
  const server = new Server(
    {
      name: "sql-bridge-mcp",
      version: "1.0.0",
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
  // TOOLS: Liste des outils disponibles
  // ----------------------------------------
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list_tables",
          description: "Liste toutes les tables de la base de donnees avec leur nombre de lignes et commentaires",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "describe_table",
          description: "Affiche la structure d'une table (colonnes, types, cles, valeurs par defaut)",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Nom de la table a decrire",
              },
            },
            required: ["table"],
          },
        },
        {
          name: "select_query",
          description: "Execute une requete SELECT sur la base de donnees (lecture seule)",
          inputSchema: {
            type: "object",
            properties: {
              sql: {
                type: "string",
                description: "Requete SELECT a executer",
              },
              limit: {
                type: "integer",
                description: "Nombre max de resultats (defaut: 50, max: 500)",
                default: 50,
              },
            },
            required: ["sql"],
          },
        },
        {
          name: "sample_data",
          description: "Recupere un echantillon de donnees d'une table pour comprendre sa structure",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Nom de la table",
              },
              limit: {
                type: "integer",
                description: "Nombre de lignes (defaut: 10, max: 100)",
                default: 10,
              },
            },
            required: ["table"],
          },
        },
      ],
    }
  })

  // ----------------------------------------
  // TOOLS: Execution des outils
  // ----------------------------------------
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    await rateLimiter.checkLimit()

    try {
      switch (name) {
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
                    tables: tables.map((t) => ({
                      name: t.TABLE_NAME,
                      rows: t.TABLE_ROWS,
                      comment: t.TABLE_COMMENT || "",
                    })),
                    count: tables.length,
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
            throw new McpError(ErrorCode.InvalidParams, `Table '${tableName}' non trouvee`)
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    table: tableName,
                    columns: columns.map((c) => ({
                      name: c.COLUMN_NAME,
                      type: c.COLUMN_TYPE,
                      nullable: c.IS_NULLABLE === "YES",
                      key: c.COLUMN_KEY || null,
                      default: c.COLUMN_DEFAULT,
                      comment: c.COLUMN_COMMENT || "",
                    })),
                    count: columns.length,
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        case "select_query": {
          const sql = validateSelectQuery(args?.sql)
          const limit = validateLimit(args?.limit)

          // Ajouter LIMIT si non present
          const normalizedSql = sql.toUpperCase()
          const finalSql = normalizedSql.includes("LIMIT") ? sql : `${sql} LIMIT ${limit}`

          const rows = await query<RowDataPacket[]>(finalSql)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    query: sql,
                    rows: rows,
                    count: rows.length,
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
          const limit = Math.min(validateLimit(args?.limit), 100)

          const rows = await query<RowDataPacket[]>(`SELECT * FROM \`${tableName}\` LIMIT ?`, [limit])

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    table: tableName,
                    sample: rows,
                    count: rows.length,
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Tool inconnu: ${name}`)
      }
    } catch (error) {
      if (error instanceof McpError) throw error
      const msg = error instanceof Error ? error.message : "Erreur inconnue"
      throw new McpError(ErrorCode.InternalError, `Erreur SQL: ${msg}`)
    }
  })

  // ----------------------------------------
  // RESOURCES: Liste des ressources
  // ----------------------------------------
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "sqlbridge://schema",
          name: "database-schema",
          description: "Schema complet de la base de donnees (tables et colonnes)",
          mimeType: "application/json",
        },
      ],
    }
  })

  // ----------------------------------------
  // RESOURCES: Lecture des ressources
  // ----------------------------------------
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    await rateLimiter.checkLimit()

    if (uri === "sqlbridge://schema") {
      const dbName = getDatabaseName()

      // Recuperer toutes les tables
      const tables = await query<TableInfo[]>(
        `SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT 
         FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ?`,
        [dbName],
      )

      // Recuperer toutes les colonnes
      const columns = await query<(ColumnInfo & { TABLE_NAME: string })[]>(
        `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, 
                COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME, ORDINAL_POSITION`,
        [dbName],
      )

      // Grouper les colonnes par table
      const schema = tables.map((table) => ({
        name: table.TABLE_NAME,
        rows: table.TABLE_ROWS,
        comment: table.TABLE_COMMENT || "",
        columns: columns
          .filter((c) => c.TABLE_NAME === table.TABLE_NAME)
          .map((c) => ({
            name: c.COLUMN_NAME,
            type: c.COLUMN_TYPE,
            nullable: c.IS_NULLABLE === "YES",
            key: c.COLUMN_KEY || null,
            default: c.COLUMN_DEFAULT,
          })),
      }))

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                database: dbName,
                tables: schema,
                tableCount: tables.length,
              },
              null,
              2,
            ),
          },
        ],
      }
    }

    throw new McpError(ErrorCode.InvalidRequest, `Resource inconnue: ${uri}`)
  })

  // ----------------------------------------
  // PROMPTS: Liste des prompts
  // ----------------------------------------
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "explore_database",
          description: "Guide le LLM pour explorer et comprendre la structure de la base de donnees",
          arguments: [],
        },
        {
          name: "query_assistant",
          description: "Aide a construire des requetes SQL basees sur une question en langage naturel",
          arguments: [
            {
              name: "question",
              description: "Question en langage naturel",
              required: true,
            },
          ],
        },
      ],
    }
  })

  // ----------------------------------------
  // PROMPTS: Recuperation des prompts
  // ----------------------------------------
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    if (name === "explore_database") {
      const dbName = getDatabaseName()
      return {
        description: "Guide d'exploration de la base de donnees",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Tu es connecte a la base de donnees MySQL "${dbName}" via SQL Bridge MCP.

Voici les outils disponibles:
1. list_tables - Liste toutes les tables
2. describe_table - Decrit la structure d'une table
3. sample_data - Recupere des exemples de donnees
4. select_query - Execute des requetes SELECT

Commence par lister les tables disponibles, puis explore leur structure pour comprendre le schema de la base.`,
            },
          },
        ],
      }
    }

    if (name === "query_assistant") {
      const question = args?.question
      if (!question) {
        throw new McpError(ErrorCode.InvalidParams, "L'argument 'question' est requis")
      }

      return {
        description: "Assistant de requetes SQL",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Question de l'utilisateur: "${question}"

Instructions:
1. Utilise d'abord list_tables pour voir les tables disponibles
2. Utilise describe_table pour comprendre la structure des tables pertinentes
3. Construis une requete SELECT appropriee
4. Execute la requete avec select_query
5. Explique les resultats a l'utilisateur

Important: Seules les requetes SELECT sont autorisees (lecture seule).`,
            },
          },
        ],
      }
    }

    throw new McpError(ErrorCode.InvalidRequest, `Prompt inconnu: ${name}`)
  })

  return server
}

// ============================================
// Demarrage du serveur
// ============================================
export async function startMcpServer(): Promise<void> {
  const connected = await testConnection()
  if (!connected) {
    console.error("[SQL Bridge] Impossible de se connecter a MySQL. Verifiez votre .env")
    process.exit(1)
  }

  console.error(`[SQL Bridge] Connecte a la base: ${getDatabaseName()}`)

  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error("[SQL Bridge] Serveur MCP demarre (stdio)")
}
