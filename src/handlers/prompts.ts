/**
 * SQL Bridge - MCP Prompt Handlers
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { ListPromptsRequestSchema, GetPromptRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { getFullSchema } from "../schema.js"

export function registerPromptHandlers(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
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
  }))

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
- Rate limiting is active

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
}
