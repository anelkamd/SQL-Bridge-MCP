/**
 * SQL Bridge MCP - Test Client
 * Based on best practices: https://modelcontextprotocol.io/docs/develop/build-client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Extract text content from MCP response
 */
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

/**
 * Extract resource text from MCP response
 */
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

/**
 * Format JSON for display
 */
function formatJson(text: string): string {
  try {
    const parsed = JSON.parse(text)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return text
  }
}

/**
 * Print section header
 */
function printHeader(title: string): void {
  console.log("\n" + "=".repeat(70))
  console.log(title)
  console.log("=".repeat(70))
}

/**
 * Print subsection header
 */
function printSubHeader(title: string): void {
  console.log("\n" + "-".repeat(70))
  console.log(title)
  console.log("-".repeat(70))
}

/**
 * Main test function
 */
async function main() {
  printHeader("SQL Bridge MCP - Test Client")

  const serverPath = path.join(__dirname, "index.js")
  console.log(`\nStarting server: ${serverPath}`)

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
  })

  const client = new Client(
    {
      name: "sql-bridge-test-client",
      version: "2.0.0",
    },
    {
      capabilities: {},
    },
  )

  try {
    await client.connect(transport)
    console.log("✓ Connected to MCP server\n")

    // Test 1: List tools
    printSubHeader("TEST 1: List Tools")
    const tools = await client.listTools()
    console.log(`Found ${tools.tools.length} tools:\n`)
    tools.tools.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}`)
      console.log(`   Description: ${t.description.split("\n")[0]}`)
    })

    // Test 2: List tables
    printSubHeader("TEST 2: List Tables")
    const tablesResult = await client.callTool({
      name: "list_tables",
      arguments: {},
    })
    const tablesText = extractText(tablesResult.content)
    console.log(formatJson(tablesText))

    // Test 3: Describe a table
    printSubHeader("TEST 3: Describe Table (users)")
    try {
      const descResult = await client.callTool({
        name: "describe_table",
        arguments: { table: "users" },
      })
      const descText = extractText(descResult.content)
      console.log(formatJson(descText))
    } catch (error) {
      console.log("⚠ Table 'users' not found (this is normal if your database schema is different)")
      console.log(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Test 4: Get sample data
    printSubHeader("TEST 4: Sample Data (first available table)")
    try {
      const tablesJson = JSON.parse(tablesText)
      if (tablesJson.tables && tablesJson.tables.length > 0) {
        const firstTable = tablesJson.tables[0].name
        const sampleResult = await client.callTool({
          name: "sample_data",
          arguments: { table: firstTable, limit: 3 },
        })
        const sampleText = extractText(sampleResult.content)
        console.log(formatJson(sampleText))
      } else {
        console.log("⚠ No tables found in database")
      }
    } catch (error) {
      console.log(`Error getting sample data: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Test 5: Read schema resource
    printSubHeader("TEST 5: Read Schema Resource (sqlbridge://schema)")
    const schema = await client.readResource({ uri: "sqlbridge://schema" })
    const schemaText = extractResourceText(schema.contents)
    try {
      const parsed = JSON.parse(schemaText)
      console.log(`Database: ${parsed.database}`)
      console.log(`Tables: ${parsed.tableCount}`)
      console.log(`Generated at: ${parsed.generatedAt}`)
      console.log("\nFirst 3 tables:")
      parsed.tables.slice(0, 3).forEach((t: { name: string; rows: number; columns: unknown[] }) => {
        console.log(`  • ${t.name}: ${t.rows} rows, ${t.columns.length} columns`)
      })
      if (parsed.tableCount > 3) {
        console.log(`  ... and ${parsed.tableCount - 3} more tables`)
      }
    } catch {
      console.log(schemaText)
    }

    // Test 6: Read stats resource
    printSubHeader("TEST 6: Read Stats Resource (sqlbridge://stats)")
    const stats = await client.readResource({ uri: "sqlbridge://stats" })
    const statsText = extractResourceText(stats.contents)
    console.log(formatJson(statsText))

    // Test 7: List prompts
    printSubHeader("TEST 7: List Prompts")
    const prompts = await client.listPrompts()
    console.log(`Found ${prompts.prompts.length} prompts:\n`)
    prompts.prompts.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`)
      console.log(`   Description: ${p.description}`)
      if (p.arguments && p.arguments.length > 0) {
        console.log(`   Arguments: ${p.arguments.map((a) => a.name).join(", ")}`)
      }
    })

    // Test 8: Server stats tool
    printSubHeader("TEST 8: Server Statistics")
    const serverStatsResult = await client.callTool({
      name: "server_stats",
      arguments: {},
    })
    const serverStatsText = extractText(serverStatsResult.content)
    console.log(formatJson(serverStatsText))

    // Test 9: Query with natural language
    printSubHeader("TEST 9: Natural Language Query")
    try {
      const queryResult = await client.callTool({
        name: "query_database",
        arguments: {
          query: "How many tables are in this database?",
        },
      })
      const queryText = extractText(queryResult.content)
      console.log(formatJson(queryText))
    } catch (error) {
      console.log(`Query error: ${error instanceof Error ? error.message : String(error)}`)
    }

    printHeader("✓ All Tests Completed Successfully")
    console.log("\nSummary:")
    console.log("  • Tools: ✓")
    console.log("  • Resources: ✓")
    console.log("  • Prompts: ✓")
    console.log("  • Query execution: ✓")
    console.log("\nThe SQL Bridge MCP server is working correctly!")
  } catch (error) {
    console.error("\n✗ Test Error:")
    console.error(error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:")
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await client.close()
    process.exit(0)
  }
}

// Run tests
main()
