# 🔗 SQL Bridge MCP

[![MCP Badge](https://lobehub.com/badge/mcp/anelkamd-sql-bridge-mcp?style=for-the-badge)](https://lobehub.com/mcp/anelkamd-sql-bridge-mcp)


**Universal Model Context Protocol (MCP) server that enables AI assistants to interact with MySQL databases using natural language.**

Connect Claude, ChatGPT, Copilot, and other LLMs to your MySQL databases with full security, validation, and ease of use. SQL Bridge MCP provides a secure, read-only interface for database exploration and querying through natural language or SQL.

---

## 🌟 Key Features

### 🔒 Security First
- **Read-only access**: Only SELECT queries are permitted
- **SQL injection protection**: All queries are validated and parameterized
- **Rate limiting**: Configurable request throttling (default: 10 req/sec)
- **Input validation**: Strict filtering of dangerous SQL operations
- **Dedicated user support**: Easy MySQL user setup with minimal permissions

### ⚡ High Performance
- **Connection pooling**: Efficient connection reuse and management
- **Query optimization**: Smart caching and query validation
- **Error handling**: Graceful degradation and detailed error messages
- **Resource monitoring**: Built-in connection pool and memory statistics

### 🤖 AI-Ready
- **Natural language queries**: Ask questions in plain English
- **Schema awareness**: Automatic database structure discovery
- **Smart responses**: Contextual and human-readable results
- **Multiple prompts**: Pre-configured AI assistant personalities

### 🔌 Universal Compatibility
- ✅ Claude Desktop (macOS/Windows/Linux)
- ✅ Claude Code (CLI)
- ✅ VS Code + GitHub Copilot
- ✅ Cursor IDE
- ✅ Continue.dev
- ✅ LobeHub
- ✅ Any MCP-compatible client

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage Examples](#-usage-examples)
- [Tools Reference](#-tools-reference)
- [Security & Best Practices](#-security--best-practices)
- [LobeHub Integration](#-lobehub-integration)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Quick Start

### 1. Install

```bash
npm install -g sql-bridge-mcp
```

### 2. Create Database User (Recommended)

```sql
-- Connect as root
mysql -u root -p

-- Create read-only user
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'secure_password';
GRANT SELECT ON your_database.* TO 'sqlbridge'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Configure Environment

Create a `.env` file:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=sqlbridge
MYSQL_PASSWORD=secure_password
MYSQL_DATABASE=your_database
```

### 4. Add to Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sql-bridge": {
      "command": "sql-bridge-mcp",
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "sqlbridge",
        "MYSQL_PASSWORD": "secure_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

### 5. Start Querying!

Restart Claude Desktop and ask:
- "How many users signed up today?"
- "Show me the top 10 products by sales"
- "What tables are in this database?"

---

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g sql-bridge-mcp
```

Verify installation:

```bash
sql-bridge-mcp --version
which sql-bridge-mcp
```

### Local Development Installation

```bash
# Clone the repository
git clone https://github.com/anelkamd/sql-bridge-mcp
cd sql-bridge-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link locally
npm link
```

### Test Your Installation

```bash
# Run the test client
npm test

# Or directly
node dist/client.js
```

---

## ⚙️ Configuration

### Environment Variables

SQL Bridge MCP is configured via environment variables:

| Variable                  | Description                | Default     | Required |
| ------------------------- | -------------------------- | ----------- | -------- |
| `MYSQL_HOST`              | Database server address    | `localhost` | No       |
| `MYSQL_PORT`              | MySQL port                 | `3306`      | No       |
| `MYSQL_USER`              | Database username          | `root`      | No       |
| `MYSQL_PASSWORD`          | Database password          | (empty)     | No       |
| `MYSQL_DATABASE`          | Database name              | (none)      | **Yes**  |
| `MYSQL_CONNECTION_LIMIT`  | Max connections in pool    | `10`        | No       |
| `MYSQL_CONNECT_TIMEOUT`   | Connection timeout (ms)    | `10000`     | No       |

### MySQL User Setup

#### Option A: Create Dedicated User (Recommended)

```sql
-- Connect as root
sudo mysql -u root

-- Create user with SELECT-only permissions
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'strong_password_here';

-- Grant read access to specific database
GRANT SELECT ON your_database.* TO 'sqlbridge'@'localhost';

-- Grant access to information_schema (for table discovery)
GRANT SELECT ON information_schema.* TO 'sqlbridge'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify
SHOW GRANTS FOR 'sqlbridge'@'localhost';
```

#### Option B: Use Existing User

If you already have a read-only user, just use those credentials in your `.env` file.

#### Option C: Test Database

Use the included test schema:

```bash
# Create test database
mysql -u root -p < scripts/schema.sql

# This creates: sql_bridge_test database with users, products, and orders tables
```

---

## 🎯 Usage Examples

### Claude Desktop

Ask Claude:

```
User: "How many users do we have in each role?"

Claude: [Uses SQL Bridge MCP to query the database]
"Here's the breakdown of users by role:
• Admin: 5 users
• Manager: 12 users
• Employee: 143 users
• Guest: 28 users

Total: 188 users"
```

### Natural Language Queries

```
"Show me products with low stock (less than 10 items)"
"Find users who signed up in the last 7 days"
"What are the top 5 customers by total order value?"
"List all orders with status 'pending'"
```

### Direct SQL (For Advanced Users)

```
"SELECT name, price, stock FROM products WHERE category = 'Electronics' ORDER BY price DESC LIMIT 10"
```

### Database Exploration

```
"What tables are available?"
"Describe the users table"
"Show me sample data from the orders table"
"What's the database schema?"
```

---

## 🛠️ Tools Reference

SQL Bridge MCP provides 6 powerful tools:

### 1. `query_database`

Execute natural language questions or SQL SELECT queries.

**Input:**
- `query` (string, required): Natural language question or SQL SELECT statement
- `limit` (integer, optional): Max results (default: 50, max: 500)

**Example:**
```json
{
  "query": "How many users signed up today?",
  "limit": 100
}
```

### 2. `list_tables`

List all tables in the database with row counts.

**Input:** None

**Output:**
```json
{
  "success": true,
  "database": "your_database",
  "tableCount": 3,
  "tables": [
    {
      "name": "users",
      "rows": 1523,
      "comment": "User accounts"
    }
  ]
}
```

### 3. `describe_table`

Get detailed structure of a specific table.

**Input:**
- `table` (string, required): Table name

**Output:**
```json
{
  "success": true,
  "table": "users",
  "columnCount": 5,
  "columns": [
    {
      "name": "id",
      "type": "int",
      "nullable": false,
      "key": "PRI",
      "default": null
    }
  ]
}
```

### 4. `sample_data`

Get sample rows from a table.

**Input:**
- `table` (string, required): Table name
- `limit` (integer, optional): Sample size (default: 5, max: 20)

### 5. `get_schema`

Get the complete database schema.

**Input:** None

**Output:** Full schema with all tables and columns

### 6. `server_stats`

Get server statistics (connection pool, rate limiter, memory).

**Input:** None

---

## 🔐 Security & Best Practices

### Security Features

1. **Read-Only Operations**: Only SELECT queries are allowed
2. **SQL Injection Prevention**: All queries use parameterized statements
3. **Query Validation**: Strict filtering of dangerous operations (INSERT, UPDATE, DELETE, DROP, etc.)
4. **Rate Limiting**: Configurable request throttling (default: 10 req/sec)
5. **Connection Pooling**: Secure connection reuse with limits
6. **No Multiple Statements**: Protection against stacked queries
7. **Error Sanitization**: Sensitive information is not exposed in errors

### Forbidden Operations

The following SQL operations are **blocked**:
- INSERT, UPDATE, DELETE
- DROP, CREATE, ALTER, TRUNCATE
- GRANT, REVOKE
- EXEC, EXECUTE, CALL
- LOAD_FILE, INTO OUTFILE
- Multiple statements (`;` separator)
- SQL comments (`--`, `/* */`)

### Best Practices

#### 1. Use Dedicated Database User

```sql
-- ✓ Good: Limited permissions
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'password';
GRANT SELECT ON mydb.* TO 'sqlbridge'@'localhost';

-- ✗ Bad: Using root or admin user
-- DO NOT use root or users with write permissions
```

#### 2. Limit Connection Pool Size

```env
# Good for small databases
MYSQL_CONNECTION_LIMIT=5

# Good for high-traffic databases
MYSQL_CONNECTION_LIMIT=20
```

#### 3. Set Strong Passwords

```env
# ✗ Bad
MYSQL_PASSWORD=password123

# ✓ Good
MYSQL_PASSWORD=K9$mP2#nQ7@wE5!rT8
```

#### 4. Use Connection Timeouts

```env
MYSQL_CONNECT_TIMEOUT=10000  # 10 seconds
```

#### 5. Monitor Resource Usage

Use the `server_stats` tool to monitor:
- Active connections
- Memory usage
- Rate limit status

---

## 🎨 LobeHub Integration

SQL Bridge MCP is **fully compatible** with LobeHub. Follow these steps:

### 1. Verify MCP Server

Ensure your SQL Bridge MCP server is properly configured:

```bash
# Test the server
npm test

# You should see:
# ✓ Connected to MCP server
# ✓ Tools listed successfully
# ✓ Resources accessible
```

### 2. Configure LobeHub

In LobeHub, add SQL Bridge as an MCP server:

**Configuration:**
```json
{
  "mcpServers": {
    "sql-bridge": {
      "command": "sql-bridge-mcp",
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "sqlbridge",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

### 3. Verify in LobeHub

1. Open LobeHub settings
2. Navigate to "Model Context Protocol" or "Plugins"
3. Verify "sql-bridge" appears in the list
4. Check that status shows "Connected" or "Active"

### 4. Test Integration

In LobeHub chat, try:
```
"List all tables in my database"
"Show me the structure of the users table"
"How many records are in the orders table?"
```

### Common LobeHub Issues

#### Issue: MCP Server Not Found

**Solution:**
```bash
# Verify global installation
which sql-bridge-mcp

# If not found, reinstall
npm install -g sql-bridge-mcp
```

#### Issue: Connection Refused

**Solution:**
- Check MySQL is running: `systemctl status mysql` (Linux) or `brew services list | grep mysql` (macOS)
- Verify credentials in config
- Test connection: `mysql -h localhost -u sqlbridge -p your_database`

#### Issue: Permissions Error

**Solution:**
```sql
-- Verify grants
SHOW GRANTS FOR 'sqlbridge'@'localhost';

-- Re-grant if needed
GRANT SELECT ON your_database.* TO 'sqlbridge'@'localhost';
GRANT SELECT ON information_schema.* TO 'sqlbridge'@'localhost';
FLUSH PRIVILEGES;
```

---

## 🔧 Troubleshooting

### Connection Issues

#### Error: "Connection refused"

```bash
# Check if MySQL is running
sudo systemctl status mysql        # Linux
brew services list | grep mysql    # macOS
sc query MySQL80                   # Windows

# Start MySQL if needed
sudo systemctl start mysql         # Linux
brew services start mysql          # macOS
net start MySQL80                  # Windows
```

#### Error: "Access denied"

```bash
# Test credentials
mysql -h localhost -u sqlbridge -p your_database

# If it fails, recreate the user
mysql -u root -p
DROP USER 'sqlbridge'@'localhost';
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'new_password';
GRANT SELECT ON your_database.* TO 'sqlbridge'@'localhost';
FLUSH PRIVILEGES;
```

#### Error: "Unknown database"

```bash
# List databases
mysql -u root -p -e "SHOW DATABASES;"

# Create database if needed
mysql -u root -p -e "CREATE DATABASE your_database;"
```

### Configuration Issues

#### Error: "MYSQL_DATABASE is required"

**Solution:** Add to `.env` or environment:
```env
MYSQL_DATABASE=your_database_name
```

#### Error: "auth_socket" on Ubuntu

**Solution:**
```sql
-- Switch to mysql_native_password
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'new_password';
FLUSH PRIVILEGES;
```

### Performance Issues

#### Slow Queries

**Solutions:**
1. Add indexes to frequently queried columns
2. Use LIMIT in queries
3. Increase connection pool size
4. Check MySQL slow query log

```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
```

#### Connection Pool Exhausted

**Solution:** Increase pool size in `.env`:
```env
MYSQL_CONNECTION_LIMIT=20
```

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment variable
NODE_DEBUG=mysql:* sql-bridge-mcp

# Or add to your configuration
DEBUG=* sql-bridge-mcp
```

---

## 👨‍💻 Development

### Project Structure

```
sql-bridge-mcp/
├── src/
│   ├── index.ts           # Entry point
│   ├── mcp-server.ts      # MCP server implementation
│   ├── db.ts              # Database connection module
│   ├── queries.ts         # Reusable query functions
│   └── client.ts          # Test client
├── scripts/
│   └── schema.sql         # Test database schema
├── dist/                  # Compiled JavaScript (generated)
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .env.example           # Example environment variables
└── README.md              # This file
```

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/anelkamd/sql-bridge-mcp
cd sql-bridge-mcp

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

# Build TypeScript
npm run build

# Run tests
npm test
```

### Available Scripts

```bash
# Build once
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Run test client
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Running Tests

```bash
# Ensure test database exists
mysql -u root -p < scripts/schema.sql

# Run test suite
npm test

# Test specific functionality
node dist/client.js
```

### Publishing to npm

```bash
# Update version
npm version patch  # or minor/major

# Build
npm run build

# Publish
npm publish
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Reporting Bugs

Open an issue on [GitHub](https://github.com/anelkamd/sql-bridge-mcp/issues) with:
- SQL Bridge version: `npm list sql-bridge-mcp`
- MySQL version: `mysql --version`
- Operating system
- Complete error logs
- Steps to reproduce

### Feature Requests

We'd love to hear your ideas! Open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Alternative solutions considered
- Additional context

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Ensure tests pass: `npm test`
6. Commit: `git commit -m 'Add amazing feature'`
7. Push: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write clear, descriptive commit messages
- Add JSDoc comments for public functions
- Update README.md for new features
- Maintain backward compatibility when possible

### Ideas for Contributions

- 🗄️ Support for PostgreSQL and SQLite
- 📊 Query performance analytics
- 🔄 Query result caching
- 📝 Query history and logging
- 🌐 HTTP transport in addition to stdio
- 🧪 Extended test suite
- 📚 Additional example prompts
- 🌍 Internationalization (i18n)

---

## 📄 License

MIT © SQL Bridge Contributors

See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [mysql2](https://github.com/sidorares/node-mysql2) - MySQL client for Node.js
- All contributors and users of SQL Bridge MCP

---

## 📚 Additional Resources

- [MCP Documentation](https://modelcontextprotocol.io/docs)
- [MySQL Reference Manual](https://dev.mysql.com/doc/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 🆘 Support

### Community

- 💬 [GitHub Discussions](https://github.com/anelkamd/sql-bridge-mcp/discussions)
- 🐛 [Issue Tracker](https://github.com/anelkamd/sql-bridge-mcp/issues)
- 📧 Email: support@sqlbridge-mcp.dev

### Professional Support

For enterprise support, custom integrations, or consulting:
- 🏢 Contact: enterprise@sqlbridge-mcp.dev
- 📞 Schedule a call: [calendly.com/sqlbridge](https://calendly.com)

---

## 🔄 Changelog

### Version 2.0.0 (Latest)

**New Features:**
- ✨ Enhanced security with improved query validation
- 📊 Server statistics and monitoring
- 🎯 Better error messages and debugging
- 🚀 Performance improvements with optimized connection pooling
- 📖 Comprehensive documentation
- 🧪 Enhanced test suite

**Breaking Changes:**
- Tool naming convention changes (for consistency)
- Updated response formats (more structured JSON)

**Bug Fixes:**
- Fixed rate limiter edge cases
- Improved connection pool cleanup
- Better error handling for edge cases

### Version 1.0.0

- 🎉 Initial release
- ✅ Core MCP functionality
- 🔒 Security features
- 📚 Basic documentation

---

## ⭐ Star History

If you find SQL Bridge MCP useful, please consider starring the repository!

[![Star History Chart](https://api.star-history.com/svg?repos=anelkamd/sql-bridge-mcp&type=Date)](https://star-history.com/#anelkamd/sql-bridge-mcp&Date)

---

**Made with ❤️ by the SQL Bridge community**
