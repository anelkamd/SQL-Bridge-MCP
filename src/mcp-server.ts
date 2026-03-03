/**
 * SQL Bridge - MCP Server Orchestrator
 * Creates the MCP server and registers all handlers
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { getConfig } from "./config.js"
import { testConnection, getDatabaseName } from "./db.js"
import { RateLimiter } from "./rate-limiter.js"
import { registerToolHandlers } from "./handlers/tools.js"
import { registerResourceHandlers } from "./handlers/resources.js"
import { registerPromptHandlers } from "./handlers/prompts.js"

export function createMcpServer(): Server {
  const config = getConfig()

  const rateLimiter = new RateLimiter(
    config.rateLimit.maxRequests,
    config.rateLimit.windowMs,
  )

  const server = new Server(
    { name: "sql-bridge-mcp", version: "2.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  )

  registerToolHandlers(server, rateLimiter)
  registerResourceHandlers(server, rateLimiter)
  registerPromptHandlers(server)

  return server
}

export async function startMcpServer(): Promise<void> {
  console.error("[SQL Bridge] Starting server...")

  const connected = await testConnection()
  if (!connected) {
    console.error("[SQL Bridge] ERROR: Unable to connect to MySQL database")
    console.error("[SQL Bridge] Please check your environment variables and database configuration")
    process.exit(1)
  }

  const dbName = getDatabaseName()
  console.error(`[SQL Bridge] Connected to database: ${dbName}`)

  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error("[SQL Bridge] MCP Server ready (stdio transport)")
  console.error("[SQL Bridge] Waiting for requests...")
}
