# Changelog

All notable changes to SQL Bridge MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-02-15

### Added
- 🔒 Enhanced security with improved query validation
- 📊 Server statistics and monitoring capabilities
- 🎯 Better error messages and debugging information
- 🚀 Performance improvements with optimized connection pooling
- 📖 Comprehensive documentation and README
- 🧪 Enhanced test suite with detailed client
- 🔧 Configuration validation and helpful error messages
- 🌍 LobeHub compatibility and integration guide
- 📝 Detailed JSDoc comments throughout codebase
- ⚡ Rate limiter with sliding window algorithm
- 🔍 Query result formatting for better readability
- 📈 Connection pool statistics endpoint
- 🛡️ Additional SQL injection protection patterns

### Changed
- 🔄 Renamed tools for better clarity and consistency
- 📦 Updated response formats to use structured JSON
- 🔧 Improved TypeScript configuration with stricter rules
- 📚 Reorganized documentation structure
- 🎨 Better code organization and modularity
- 🔐 Enhanced password and connection security practices

### Fixed
- 🐛 Rate limiter edge cases and race conditions
- 🔌 Connection pool cleanup and resource leaks
- ⚠️ Error handling for various edge cases
- 🔍 Schema discovery for databases with many tables
- 📝 Type safety issues in query functions

### Security
- 🛡️ Added protection against stacked queries
- 🚫 Enhanced forbidden operation detection
- 🔒 Improved parameterized query handling
- ✅ Stricter input validation for all parameters

## [1.0.0] - 2024-12-01

### Added
- 🎉 Initial release of SQL Bridge MCP
- ✅ Core MCP server functionality
- 🔒 Basic security features (read-only, query validation)
- 🔌 MySQL connection pooling
- 📚 Basic documentation
- 🛠️ Essential tools (ask, execute_sql, list_tables, describe_table, sample_data)
- 📊 Schema resource for database structure
- 🎭 SQL assistant and query prompts
- 🔄 Rate limiting (5 req/sec)

### Known Issues
- Limited error messages in some edge cases
- No built-in monitoring or statistics

---

## Upcoming Features (Roadmap)

### Version 2.1.0 (Planned)
- 🗄️ PostgreSQL support
- 📊 Query performance analytics
- 🔄 Query result caching
- 📝 Query history and audit logging
- 🌐 HTTP transport option
- 🧪 Extended test coverage

### Version 2.2.0 (Planned)
- 🗃️ SQLite support
- 🔍 Advanced query optimization suggestions
- 📈 Database health monitoring
- 🌍 Internationalization (i18n)
- 🎨 Custom prompt templates
- 📱 Mobile-friendly configuration tools

### Version 3.0.0 (Future)
- 🚀 GraphQL query interface
- 🔐 Advanced security features (encryption, RBAC)
- 📊 Built-in analytics dashboard
- 🤝 Multi-database federation
- 🔄 Real-time query streaming
- 🧠 AI-powered query optimization

---

## Support

For questions, issues, or feature requests:
- 🐛 [Issue Tracker](https://github.com/anelkamd/sql-bridge-mcp/issues)
- 💬 [Discussions](https://github.com/anelkamd/sql-bridge-mcp/discussions)
- 📧 Email: support@sqlbridge-mcp.dev

---

**Note:** This project follows [Semantic Versioning](https://semver.org/).
- Major version (X.0.0): Breaking changes
- Minor version (0.X.0): New features, backward compatible
- Patch version (0.0.X): Bug fixes, backward compatible
