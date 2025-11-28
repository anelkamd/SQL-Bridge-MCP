/**
 * Client de test pour SQL Bridge MCP
 * Selon les bonnes pratiques: https://modelcontextprotocol.io/docs/develop/build-client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "No content"

  for (const item of content) {
    if (item && typeof item === "object" && "type" in item && "text" in item) {
      if (item.type === "text" && typeof item.text === "string") {
        return item.text
      }
    }
  }
  return "No text content"
}

function extractResourceText(contents: unknown): string {
  if (!Array.isArray(contents)) return "No contents"

  for (const item of contents) {
    if (item && typeof item === "object" && "text" in item) {
      if (typeof item.text === "string") {
        return item.text
      }
    }
  }
  return "No resource text"
}

async function main() {
  console.log("=".repeat(60))
  console.log("SQL Bridge MCP - Client de Test")
  console.log("=".repeat(60))
  console.log()

  const serverPath = path.join(__dirname, "index.js")
  console.log(`Demarrage du serveur: ${serverPath}\n`)

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
  })

  const client = new Client({ name: "sql-bridge-test-client", version: "1.0.0" }, { capabilities: {} })

  try {
    await client.connect(transport)
    console.log("Connecte au serveur MCP\n")

    // Test 1: Lister les tools
    console.log("-".repeat(60))
    console.log("TEST 1: Liste des tools")
    console.log("-".repeat(60))
    const tools = await client.listTools()
    tools.tools.forEach((t) => console.log(`  - ${t.name}: ${t.description}`))
    console.log()

    // Test 2: Lister les tables
    console.log("-".repeat(60))
    console.log("TEST 2: list_tables")
    console.log("-".repeat(60))
    const tablesResult = await client.callTool({
      name: "list_tables",
      arguments: {},
    })
    console.log(extractText(tablesResult.content))
    console.log()

    // Test 3: Decrire une table
    console.log("-".repeat(60))
    console.log("TEST 3: describe_table (users)")
    console.log("-".repeat(60))
    try {
      const descResult = await client.callTool({
        name: "describe_table",
        arguments: { table: "users" },
      })
      console.log(extractText(descResult.content))
    } catch {
      console.log("Table 'users' non trouvee (normal si votre base est differente)")
    }
    console.log()

    // Test 4: Lire le schema complet (resource)
    console.log("-".repeat(60))
    console.log("TEST 4: Resource sqlbridge://schema")
    console.log("-".repeat(60))
    const schema = await client.readResource({ uri: "sqlbridge://schema" })
    const schemaText = extractResourceText(schema.contents)
    try {
      const parsed = JSON.parse(schemaText)
      console.log(`Base: ${parsed.database}`)
      console.log(`Tables: ${parsed.tableCount}`)
      parsed.tables.slice(0, 5).forEach((t: { name: string; columns: unknown[] }) => {
        console.log(`  - ${t.name} (${t.columns.length} colonnes)`)
      })
      if (parsed.tableCount > 5) console.log(`  ... et ${parsed.tableCount - 5} autres`)
    } catch {
      console.log(schemaText)
    }
    console.log()

    // Test 5: Lister les prompts
    console.log("-".repeat(60))
    console.log("TEST 5: Liste des prompts")
    console.log("-".repeat(60))
    const prompts = await client.listPrompts()
    prompts.prompts.forEach((p) => console.log(`  - ${p.name}: ${p.description}`))
    console.log()

    console.log("=".repeat(60))
    console.log("Tous les tests termines!")
    console.log("=".repeat(60))
  } catch (error) {
    console.error("Erreur:", error)
  } finally {
    await client.close()
    process.exit(0)
  }
}

main()
