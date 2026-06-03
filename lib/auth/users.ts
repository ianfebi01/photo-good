import 'server-only'

import { db } from '@/lib/db'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { type AuthUser, type Role, isRole } from '@/lib/auth/types'

type UserRow = {
  id: string
  email: string
  name: string
  role: Role
  avatar_url: string | null
  created_at: Date
  updated_at: Date
}

function normalizeEmail( email: string ) {
  return email.trim().toLowerCase()
}

function mapUser( row: UserRow ): AuthUser {
  return {
    id        : row.id,
    email     : row.email,
    name      : row.name,
    role      : row.role,
    image     : row.avatar_url,
    createdAt : row.created_at,
    updatedAt : row.updated_at,
  }
}

export async function upsertGoogleUser( input: {
  email: string
  name: string
  googleId: string
  avatarUrl?: string | null
} ) {
  await ensureAuthSchema()
  const client = await db.connect()

  try {
    await client.query( 'BEGIN' )
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('photo_good_first_user_signup'))`,
    )

    const { rows: existingRows } = await client.query<UserRow>(
      `
        SELECT id, email, name, role, avatar_url, created_at, updated_at
        FROM app_users
        WHERE google_id = $1 OR email = $2
        LIMIT 1
      `,
      [input.googleId, normalizeEmail( input.email )],
    )

    if ( existingRows[0] ) {
      const { rows } = await client.query<UserRow>(
        `
          UPDATE app_users
          SET name = $2,
              email = $3,
              google_id = $4,
              avatar_url = $5,
              last_login_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, email, name, role, avatar_url, created_at, updated_at
        `,
        [
          existingRows[0].id,
          input.name.trim(),
          normalizeEmail( input.email ),
          input.googleId,
          input.avatarUrl ?? null,
        ],
      )

      await client.query( 'COMMIT' )

      return mapUser( rows[0] )
    }

    const { rows: countRows } = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM app_users',
    )
    const userCount = Number.parseInt( countRows[0]?.count ?? '0', 10 )
    const role: Role = userCount === 0 ? 'super_admin' : 'viewer'

    const { rows } = await client.query<UserRow>(
      `
        INSERT INTO app_users (name, email, google_id, avatar_url, role, last_login_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, email, name, role, avatar_url, created_at, updated_at
      `,
      [
        input.name.trim(),
        normalizeEmail( input.email ),
        input.googleId,
        input.avatarUrl ?? null,
        role,
      ],
    )

    await client.query( 'COMMIT' )

    return mapUser( rows[0] )
  } catch ( error ) {
    await client.query( 'ROLLBACK' )
    throw error
  } finally {
    client.release()
  }
}

export async function updateUserProfile( userId: string, input: {
  name: string
  email: string
} ) {
  await ensureAuthSchema()

  const { rows } = await db.query<UserRow>(
    `
      UPDATE app_users
      SET name = $2, email = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, role, avatar_url, created_at, updated_at
    `,
    [userId, input.name.trim(), normalizeEmail( input.email )],
  )

  return rows[0] ? mapUser( rows[0] ) : null
}

export async function listUsers() {
  await ensureAuthSchema()

  const { rows } = await db.query<UserRow & { last_login_at: Date | null }>(
    `
      SELECT id, email, name, role, avatar_url, created_at, updated_at, last_login_at
      FROM app_users
      ORDER BY created_at ASC
    `,
  )

  return rows
}

export async function updateUserRole( userId: string, role: string ) {
  await ensureAuthSchema()
  if ( !isRole( role ) ) return null

  const { rows } = await db.query<UserRow>(
    `
      UPDATE app_users
      SET role = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, role, avatar_url, created_at, updated_at
    `,
    [userId, role],
  )

  return rows[0] ? mapUser( rows[0] ) : null
}
