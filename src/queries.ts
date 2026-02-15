/**
 * SQL Bridge - Reusable Query Functions
 * All queries use parameterized statements to prevent SQL injection
 */

import type { RowDataPacket } from "mysql2/promise"
import { query } from "./db.js"

/**
 * User interface representing a database user
 */
export interface User {
  id: number
  email: string
  fullname: string
  created_at: Date
  role: string
}

/**
 * Pagination result interface
 */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// Type aliases for query results
interface UserRow extends User, RowDataPacket {}

interface CountRow extends RowDataPacket {
  total: number
}

/**
 * Get a user by their ID
 * @param id - User ID (must be > 0)
 * @returns User object or null if not found
 * @throws Error if id is invalid
 */
export async function getUserById(id: number): Promise<User | null> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid user ID: ${id}. Must be a positive integer.`)
  }

  const sql = `
    SELECT id, email, fullname, created_at, role
    FROM users
    WHERE id = ?
    LIMIT 1
  `

  const rows = await query<UserRow[]>(sql, [id])

  return rows.length > 0 ? rows[0] : null
}

/**
 * List users with pagination support
 * @param limit - Maximum number of users to return (default: 10, max: 100)
 * @param offset - Offset for pagination (default: 0)
 * @returns Paginated list of users with metadata
 */
export async function listUsers(limit = 10, offset = 0): Promise<PaginatedResult<User>> {
  // Sanitize and validate inputs
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
  const safeOffset = Math.max(0, Math.floor(offset))

  // Query for users with pagination
  const sqlUsers = `
    SELECT id, email, fullname, created_at, role
    FROM users
    ORDER BY id ASC
    LIMIT ? OFFSET ?
  `

  // Query for total count
  const sqlCount = `SELECT COUNT(*) as total FROM users`

  // Execute both queries in parallel for better performance
  const [users, countResult] = await Promise.all([
    query<UserRow[]>(sqlUsers, [safeLimit, safeOffset]),
    query<CountRow[]>(sqlCount),
  ])

  const total = countResult[0]?.total || 0

  return {
    data: users,
    total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore: safeOffset + safeLimit < total,
  }
}

/**
 * Get all users (for MCP resource)
 * WARNING: Use with caution on large tables
 * @param maxLimit - Maximum number of users to return (default: 1000)
 * @returns List of all users up to maxLimit
 */
export async function getAllUsers(maxLimit = 1000): Promise<User[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(maxLimit)), 10000)

  const sql = `
    SELECT id, email, fullname, created_at, role
    FROM users
    ORDER BY id ASC
    LIMIT ?
  `

  return await query<UserRow[]>(sql, [safeLimit])
}

/**
 * Search users by email or name
 * @param searchTerm - Term to search for in email or fullname
 * @param limit - Maximum results (default: 20)
 * @returns List of matching users
 */
export async function searchUsers(searchTerm: string, limit = 20): Promise<User[]> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return []
  }

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
  const searchPattern = `%${searchTerm.trim()}%`

  const sql = `
    SELECT id, email, fullname, created_at, role
    FROM users
    WHERE email LIKE ? OR fullname LIKE ?
    ORDER BY id ASC
    LIMIT ?
  `

  return await query<UserRow[]>(sql, [searchPattern, searchPattern, safeLimit])
}

/**
 * Count users by role
 * @param role - Role to filter by (optional)
 * @returns Count of users with specified role or all users if no role specified
 */
export async function countUsersByRole(role?: string): Promise<number> {
  if (role) {
    const sql = `SELECT COUNT(*) as total FROM users WHERE role = ?`
    const result = await query<CountRow[]>(sql, [role])
    return result[0]?.total || 0
  }

  const sql = `SELECT COUNT(*) as total FROM users`
  const result = await query<CountRow[]>(sql)
  return result[0]?.total || 0
}

/**
 * Get users created within a date range
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @param limit - Maximum results (default: 100)
 * @returns List of users created within the date range
 */
export async function getUsersByDateRange(startDate: Date, endDate: Date, limit = 100): Promise<User[]> {
  if (startDate > endDate) {
    throw new Error("Start date must be before or equal to end date")
  }

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 1000)

  const sql = `
    SELECT id, email, fullname, created_at, role
    FROM users
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC
    LIMIT ?
  `

  return await query<UserRow[]>(sql, [startDate, endDate, safeLimit])
}

/**
 * Get recently created users
 * @param hours - Number of hours to look back (default: 24)
 * @param limit - Maximum results (default: 50)
 * @returns List of recently created users
 */
export async function getRecentUsers(hours = 24, limit = 50): Promise<User[]> {
  const safeHours = Math.max(1, Math.min(hours, 720)) // Max 30 days
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)

  const sql = `
    SELECT id, email, fullname, created_at, role
    FROM users
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    ORDER BY created_at DESC
    LIMIT ?
  `

  return await query<UserRow[]>(sql, [safeHours, safeLimit])
}
