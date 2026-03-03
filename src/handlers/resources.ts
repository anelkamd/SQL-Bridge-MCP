/**
 * SQL Bridge - MCP Resource Handlers
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js"
import { RateLimiter } from "../rate-limiter.js"
import { getFullSchema, getServerStats } from "../schema.js"

export function registerResourceHandlers(server: Server, rateLimiter: RateLimiter): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
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
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    await rateLimiter.checkLimit()

    switch (uri) {
      case "sqlbridge://schema": {
        const schema = await getFullSchema()
        return {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(schema, null, 2) }],
        }
      }

      case "sqlbridge://stats": {
        const stats = getServerStats(rateLimiter)
        return {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(stats, null, 2) }],
        }
      }

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`)
    }
  })
}
