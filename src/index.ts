#!/usr/bin/env node
/**
 * SQL Bridge MCP - Point d'entree
 * Serveur MCP universel pour bases de donnees MySQL
 */

import { startMcpServer } from "./mcp-server.js"
import { closePool } from "./db.js"

// Gestion propre de l'arret
process.on("SIGINT", async () => {
  console.error("\n[SQL Bridge] Arret...")
  await closePool()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  await closePool()
  process.exit(0)
})

process.on("uncaughtException", (error) => {
  console.error("[SQL Bridge] Erreur:", error)
  process.exit(1)
})

// Demarrage
startMcpServer().catch((error) => {
  console.error("[SQL Bridge] Erreur au demarrage:", error)
  process.exit(1)
})
