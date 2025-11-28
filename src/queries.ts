/**
 * Fonctions SQL réutilisables pour les utilisateurs
 * Toutes les requêtes sont paramétrées pour éviter les injections SQL
 */

import type { RowDataPacket } from "mysql2/promise"
import { query } from "./db.js"

// Interface représentant un utilisateur
export interface User {
  id: number
  email: string
  fullname: string
  created_at: Date
  role: string
}

// Type pour les résultats de requête
interface UserRow extends User, RowDataPacket {}

// Type pour le comptage
interface CountRow extends RowDataPacket {
  total: number
}

/**
 * Récupérer un utilisateur par son ID
 * @param id - ID de l'utilisateur (doit être > 0)
 * @returns L'utilisateur trouvé ou null
 */
export async function getUserById(id: number): Promise<User | null> {
  const sql = `
    SELECT id, email, fullname, created_at, role
    FROM users
    WHERE id = ?
    LIMIT 1
  `

  const rows = await query<UserRow[]>(sql, [id])

  if (rows.length === 0) {
    return null
  }

  return rows[0]
}

/**
 * Lister les utilisateurs avec pagination
 * @param limit - Nombre maximum d'utilisateurs à retourner (défaut: 10, max: 100)
 * @param offset - Décalage pour la pagination (défaut: 0)
 * @returns Liste des utilisateurs et total
 */
export async function listUsers(
  limit = 10,
  offset = 0,
): Promise<{ users: User[]; total: number; limit: number; offset: number }> {
  // Limiter le nombre maximum de résultats
  const safeLimit = Math.min(Math.max(1, limit), 100)
  const safeOffset = Math.max(0, offset)

  // Requête pour obtenir les utilisateurs
  const sqlUsers = `
    SELECT id, email, fullname, created_at, role
    FROM users
    ORDER BY id ASC
    LIMIT ? OFFSET ?
  `

  // Requête pour obtenir le total
  const sqlCount = `SELECT COUNT(*) as total FROM users`

  const [users, countResult] = await Promise.all([
    query<UserRow[]>(sqlUsers, [safeLimit, safeOffset]),
    query<CountRow[]>(sqlCount),
  ])

  return {
    users,
    total: countResult[0]?.total || 0,
    limit: safeLimit,
    offset: safeOffset,
  }
}

/**
 * Récupérer tous les utilisateurs (pour la resource MCP)
 * @returns Liste de tous les utilisateurs
 */
export async function getAllUsers(): Promise<User[]> {
  const sql = `
    SELECT id, email, fullname, created_at, role
    FROM users
    ORDER BY id ASC
  `

  return await query<UserRow[]>(sql)
}
