#!/usr/bin/env node
/**
 * SQL Bridge MCP - Entry Point
 * Universal MCP server for MySQL databases
 */

import { startMcpServer } from "./mcp-server.js"
import { closePool } from "./db.js"

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  console.error(`\n[SQL Bridge] Received ${signal}, shutting down gracefully...`)

  try {
    await closePool()
    console.error("[SQL Bridge] Cleanup complete")
    process.exit(0)
  } catch (error) {
    console.error("[SQL Bridge] Error during shutdown:", error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

// Handle graceful shutdown signals
process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[SQL Bridge] Uncaught Exception:", error)
  console.error("[SQL Bridge] Stack:", error.stack)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("[SQL Bridge] Unhandled Rejection at:", promise)
  console.error("[SQL Bridge] Reason:", reason)
  process.exit(1)
})

// Start the server
;(async () => {
  try {
    await startMcpServer()
  } catch (error) {
    console.error("[SQL Bridge] Fatal error during startup:", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error("[SQL Bridge] Stack trace:", error.stack)
    }
    process.exit(1)
  }
})()
