/**
 * SQL Bridge - MCP Server Universel
 * Permet a n'importe quel LLM d'interagir avec une base MySQL
 * en langage naturel avec des reponses agreables
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

  if (!normalized.startsWith("SELECT")) {
    throw new McpError(ErrorCode.InvalidParams, "Seules les requetes SELECT sont autorisees")
  }

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
  return Math.min(num, 500)
}

async function getFullSchema(): Promise<{
  database: string
  tables: Array<{
    name: string
    rows: number
    comment: string
    columns: Array<{
      name: string
      type: string
      nullable: boolean
      key: string | null
      default: string | null
    }>
  }>
}> {
  const dbName = getDatabaseName()

  const tables = await query<TableInfo[]>(
    `SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ?`,
    [dbName],
  )

  const columns = await query<(ColumnInfo & { TABLE_NAME: string })[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, 
            COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [dbName],
  )

  return {
    database: dbName,
    tables: tables.map((table) => ({
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
    })),
  }
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
          name: "ask",
          description: `Repond a une question en langage naturel sur la base de donnees.
          
IMPORTANT: Ce tool retourne le SCHEMA de la base pour que tu puisses:
1. Comprendre la structure des tables
2. Generer la requete SQL appropriee  
3. Executer la requete avec 'execute_sql'
4. Formater une reponse agreable pour l'utilisateur

Exemples de questions:
- "Combien d'utilisateurs se sont inscrits aujourd'hui ?"
- "Quels sont les 5 derniers produits ajoutes ?"
- "Montre-moi les commandes de plus de 100 euros"`,
          inputSchema: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "Question en langage naturel de l'utilisateur",
              },
            },
            required: ["question"],
          },
        },
        {
          name: "execute_sql",
          description: `Execute une requete SELECT et retourne les resultats.
          
IMPORTANT pour formater la reponse:
- Si peu de resultats: liste-les clairement avec des bullet points
- Si beaucoup de resultats: fais un resume + montre les plus pertinents
- Ajoute toujours un petit commentaire contextuel
- Utilise des emojis si approprie pour rendre la reponse agreable

Exemple de bonne reponse:
"J'ai trouve 3 utilisateurs inscrits aujourd'hui:
• Jean Dupont (jean@email.com) - inscrit a 14h32
• Marie Martin (marie@email.com) - inscrit a 16h45  
• Pierre Durand (pierre@email.com) - inscrit a 18h20

C'est une bonne journee pour les inscriptions!"`,
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
          name: "list_tables",
          description: "Liste toutes les tables de la base de donnees avec leur nombre de lignes",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "describe_table",
          description: "Affiche la structure detaillee d'une table (colonnes, types, cles)",
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
          name: "sample_data",
          description: "Recupere des exemples de donnees d'une table pour comprendre son contenu",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Nom de la table",
              },
              limit: {
                type: "integer",
                description: "Nombre de lignes (defaut: 5, max: 20)",
                default: 5,
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
        case "ask": {
          const question = args?.question
          if (typeof question !== "string" || !question.trim()) {
            throw new McpError(ErrorCode.InvalidParams, "Question requise")
          }

          const schema = await getFullSchema()

          // Generer une representation lisible du schema
          let schemaText = `Base de donnees: ${schema.database}\n\n`
          schemaText += `Tables disponibles (${schema.tables.length}):\n\n`

          for (const table of schema.tables) {
            schemaText += `📋 ${table.name}`
            if (table.rows) schemaText += ` (~${table.rows} lignes)`
            if (table.comment) schemaText += ` - ${table.comment}`
            schemaText += `\n`

            for (const col of table.columns) {
              const keyIcon = col.key === "PRI" ? "🔑" : col.key === "MUL" ? "🔗" : "  "
              schemaText += `   ${keyIcon} ${col.name}: ${col.type}`
              if (!col.nullable) schemaText += " (requis)"
              schemaText += `\n`
            }
            schemaText += `\n`
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    question: question,
                    instructions: `
L'utilisateur a pose cette question: "${question}"

Voici le schema de la base de donnees pour t'aider a construire la requete SQL:

${schemaText}

INSTRUCTIONS:
1. Analyse la question et identifie les tables/colonnes pertinentes
2. Construis une requete SELECT appropriee
3. Utilise le tool 'execute_sql' pour executer la requete
4. Formate une reponse AGREABLE et LISIBLE pour l'utilisateur:
   - Utilise des bullet points pour les listes
   - Ajoute un petit resume ou commentaire
   - Sois conversationnel et amical
   - Si pas de resultats, explique gentiment pourquoi

NE RETOURNE PAS de JSON brut a l'utilisateur final!`,
                    schema: schema,
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        case "execute_sql": {
          const sql = validateSelectQuery(args?.sql)
          const limit = validateLimit(args?.limit)

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
                    results: rows,
                    count: rows.length,
                    hint: "Formate ces resultats de maniere agreable pour l'utilisateur. Utilise des bullet points, un resume, et sois conversationnel.",
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

    throw new McpError(ErrorCode.InvalidRequest, `Resource inconnue: ${uri}`)
  })

  // ----------------------------------------
  // PROMPTS: Liste des prompts
  // ----------------------------------------
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "assistant_sql",
          description:
            "Transforme SQL Bridge en assistant conversationnel qui repond aux questions sur la base de donnees",
          arguments: [],
        },
        {
          name: "query_natural",
          description: "Convertit une question en langage naturel en requete SQL et formate une reponse agreable",
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

    if (name === "assistant_sql") {
      const schema = await getFullSchema()

      let schemaDescription = ""
      for (const table of schema.tables) {
        schemaDescription += `\n### Table: ${table.name}\n`
        schemaDescription += `Colonnes: ${table.columns.map((c) => `${c.name} (${c.type})`).join(", ")}\n`
      }

      return {
        description: "Assistant SQL conversationnel",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Tu es un assistant sympathique qui aide les utilisateurs a explorer leur base de donnees MySQL "${schema.database}".

SCHEMA DE LA BASE:
${schemaDescription}

OUTILS DISPONIBLES:
- ask: Pour comprendre une question et obtenir le schema
- execute_sql: Pour executer des requetes SELECT
- list_tables: Pour lister les tables
- describe_table: Pour decrire une table
- sample_data: Pour voir des exemples de donnees

REGLES DE REPONSE:
1. Reponds TOUJOURS de maniere conversationnelle et agreable
2. Utilise des bullet points (•) pour les listes
3. Ajoute des emojis quand c'est approprie (📊 📋 ✅ ❌ 🔍)
4. Fais un petit resume ou commentaire sur les resultats
5. Si pas de resultats, explique gentiment pourquoi
6. NE MONTRE JAMAIS de JSON brut a l'utilisateur

EXEMPLE DE BONNE REPONSE:
"J'ai trouve 3 utilisateurs inscrits aujourd'hui! 🎉

• Jean Dupont (jean@email.com) - inscrit a 14h32
• Marie Martin (marie@email.com) - inscrit a 16h45
• Pierre Durand (pierre@email.com) - inscrit a 18h20

C'est une bonne journee pour les inscriptions!"

EXEMPLE DE REPONSE SANS RESULTATS:
"Je n'ai trouve aucun utilisateur inscrit aujourd'hui. 🤔
C'est peut-etre normal si c'est tot dans la journee, ou alors il y a peut-etre un souci avec le formulaire d'inscription?"

L'utilisateur va te poser des questions. Utilise les outils disponibles pour y repondre.`,
            },
          },
        ],
      }
    }

    if (name === "query_natural") {
      const question = args?.question
      if (!question) {
        throw new McpError(ErrorCode.InvalidParams, "L'argument 'question' est requis")
      }

      const schema = await getFullSchema()

      let schemaDescription = ""
      for (const table of schema.tables) {
        schemaDescription += `Table ${table.name}: ${table.columns.map((c) => c.name).join(", ")}\n`
      }

      return {
        description: "Conversion question naturelle -> SQL -> reponse agreable",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Question de l'utilisateur: "${question}"

Schema de la base "${schema.database}":
${schemaDescription}

INSTRUCTIONS:
1. Analyse la question pour identifier les tables/colonnes necessaires
2. Construis une requete SELECT appropriee
3. Execute-la avec le tool 'execute_sql'
4. Formate une reponse AGREABLE:
   - Commence par repondre directement a la question
   - Utilise des bullet points si plusieurs resultats
   - Ajoute un emoji pertinent
   - Termine par un petit commentaire ou suggestion

IMPORTANT: Ne montre JAMAIS le JSON brut. Transforme-le en texte agreable.`,
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
