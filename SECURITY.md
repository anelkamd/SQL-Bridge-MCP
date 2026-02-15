# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | ✅ Active support  |
| 1.0.x   | ⚠️ Security fixes only |
| < 1.0   | ❌ No support      |

## Security Features

SQL Bridge MCP is designed with security as a top priority:

### 1. Read-Only Operations
- **Only SELECT queries permitted**: All modification operations (INSERT, UPDATE, DELETE, DROP, etc.) are strictly blocked
- **Validation at multiple layers**: Query validation occurs before execution
- **Parameterized queries**: All queries use prepared statements to prevent SQL injection

### 2. Query Validation
The following operations are **blocked**:
```sql
-- Data Modification
INSERT, UPDATE, DELETE, REPLACE, MERGE

-- Schema Modification  
DROP, CREATE, ALTER, TRUNCATE, RENAME

-- Permission Changes
GRANT, REVOKE

-- Dangerous Operations
EXEC, EXECUTE, CALL
LOAD_FILE, INTO OUTFILE, INTO DUMPFILE
SELECT ... INTO OUTFILE

-- Multiple Statements
; (statement separator)

-- Comments
--, /* */

-- System Procedures
xp_*, sp_* (some exceptions)
```

### 3. Rate Limiting
- **Default**: 10 requests per second
- **Sliding window algorithm**: More accurate than fixed windows
- **Configurable**: Can be adjusted based on your needs
- **Per-connection tracking**: Prevents abuse

### 4. Connection Security
- **Connection pooling**: Reuses connections securely
- **Timeout protection**: Prevents hanging connections
- **Resource limits**: Maximum connection pool size
- **No multiple statements**: Disabled at MySQL driver level

### 5. Input Validation
- **Table names**: Alphanumeric and underscores only, max 64 characters
- **Query length**: Reasonable limits to prevent DoS
- **Parameter types**: Strict type checking
- **SQL pattern detection**: Identifies dangerous patterns

## Recommended Security Practices

### 1. Database User Configuration

**✅ Best Practice: Create a dedicated read-only user**

```sql
-- Connect as root
mysql -u root -p

-- Create dedicated user
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';

-- Grant ONLY SELECT permissions
GRANT SELECT ON your_database.* TO 'sqlbridge'@'localhost';

-- Grant access to information_schema (needed for table discovery)
GRANT SELECT ON information_schema.* TO 'sqlbridge'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify (should only show SELECT)
SHOW GRANTS FOR 'sqlbridge'@'localhost';
```

**❌ Bad Practice: Using root or admin users**
```sql
-- DO NOT DO THIS
MYSQL_USER=root
MYSQL_PASSWORD=root

-- ALSO DO NOT DO THIS
GRANT ALL PRIVILEGES ON *.* TO 'sqlbridge'@'localhost';
```

### 2. Password Security

**✅ Strong passwords:**
```env
# Good: 20+ characters, mixed case, numbers, symbols
MYSQL_PASSWORD=K9$mP2#nQ7@wE5!rT8^uY3&vN6*xM1

# Use a password manager to generate these
```

**❌ Weak passwords:**
```env
# Bad examples - DO NOT USE
MYSQL_PASSWORD=password
MYSQL_PASSWORD=123456
MYSQL_PASSWORD=sqlbridge
```

### 3. Network Security

**For production environments:**

```sql
-- Limit user to specific host
CREATE USER 'sqlbridge'@'192.168.1.100' IDENTIFIED BY 'password';
GRANT SELECT ON database.* TO 'sqlbridge'@'192.168.1.100';

-- Or use localhost only
CREATE USER 'sqlbridge'@'localhost' IDENTIFIED BY 'password';
```

**Configure MySQL to listen only on localhost (if local only):**

In `/etc/mysql/my.cnf`:
```ini
[mysqld]
bind-address = 127.0.0.1
```

### 4. Environment Variable Security

**✅ Secure .env file:**
```bash
# Set restrictive permissions
chmod 600 .env

# Ensure .env is in .gitignore
echo ".env" >> .gitignore

# Never commit .env to version control
```

**✅ Use environment-specific configs:**
```bash
# Development
.env.development

# Production  
.env.production

# Never mix them!
```

### 5. Connection Pool Limits

**Configure appropriate limits:**
```env
# Small database / development
MYSQL_CONNECTION_LIMIT=5

# Medium traffic
MYSQL_CONNECTION_LIMIT=10

# High traffic
MYSQL_CONNECTION_LIMIT=20

# Never go too high (causes resource exhaustion)
# MYSQL_CONNECTION_LIMIT=100  ❌ TOO HIGH
```

### 6. Monitor and Audit

**Check server stats regularly:**
```javascript
// Use the server_stats tool
{
  "name": "server_stats",
  "arguments": {}
}
```

**Enable MySQL query logging for auditing:**
```sql
-- Enable general log (development only - performance impact)
SET GLOBAL general_log = 'ON';
SET GLOBAL general_log_file = '/var/log/mysql/sql-bridge.log';

-- Enable slow query log (production)
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
```

## Reporting Security Vulnerabilities

**⚠️ IMPORTANT: Do NOT open public issues for security vulnerabilities**

If you discover a security vulnerability, please:

1. **Email**: security@sqlbridge-mcp.dev
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Wait for response**: We aim to respond within 48 hours
4. **Coordinated disclosure**: We'll work with you on disclosure timing

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: 1 month
- **Disclosure**: After fix is released
- **Credit**: You'll be credited in release notes (if desired)

## Security Checklist

Before deploying SQL Bridge MCP in production:

- [ ] Created dedicated MySQL user with SELECT-only permissions
- [ ] Used strong, randomly generated password
- [ ] Set restrictive file permissions on .env (chmod 600)
- [ ] Verified .env is in .gitignore
- [ ] Configured appropriate connection pool limits
- [ ] Tested with non-admin database user
- [ ] Reviewed MySQL user grants (SHOW GRANTS)
- [ ] Set up monitoring and logging
- [ ] Documented security procedures for your team
- [ ] Tested rate limiting under load
- [ ] Verified network access controls (if remote database)
- [ ] Enabled MySQL slow query log
- [ ] Set up regular security updates
- [ ] Reviewed and understood blocked SQL operations
- [ ] Tested error handling (doesn't expose sensitive info)

## Known Security Considerations

### 1. Schema Visibility
SQL Bridge MCP exposes database schema (table and column names) through the `get_schema` tool and resource. This is **intentional** for LLM functionality, but be aware:

- Table names are visible
- Column names and types are visible
- Row counts are visible
- Comments are visible

**Mitigation**: Only use on databases where schema visibility is acceptable.

### 2. Data Exposure
SELECT queries can read **any data** the database user has access to.

**Mitigation**: 
- Use dedicated read-only user
- Grant SELECT only on necessary tables
- Consider views for additional access control

### 3. Performance Impact
Complex queries can impact database performance.

**Mitigation**:
- Rate limiting (10 req/sec default)
- Query timeouts
- Connection pool limits
- Monitor slow query log

### 4. Information Disclosure
Error messages are sanitized but may still reveal some information.

**Current behavior**:
- Generic error messages in production
- No SQL queries in error responses
- No stack traces to users

## Security Updates

Subscribe to security updates:
- **Watch** the GitHub repository
- **Star** for notifications
- Check [CHANGELOG.md](CHANGELOG.md) for security fixes
- Monitor [GitHub Security Advisories](https://github.com/anelkamd/sql-bridge-mcp/security/advisories)

## Compliance

SQL Bridge MCP follows security best practices from:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MySQL Security Guidelines](https://dev.mysql.com/doc/refman/8.0/en/security.html)

## License

This security policy is part of SQL Bridge MCP and is licensed under MIT License.

---

**Last Updated**: 2025-02-15  
**Next Review**: 2025-05-15  
**Contact**: security@sqlbridge-mcp.dev
