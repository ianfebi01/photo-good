import 'server-only'

import { Pool } from 'pg'

const globalForPg = globalThis as unknown as {
  photoGoodPool?: Pool
}

export const db =
  globalForPg.photoGoodPool ??
  new Pool( {
    connectionString : process.env.POSTGRES_URL,
    user             : process.env.POSTGRES_USER,
    host             : process.env.POSTGRES_HOST,
    database         : process.env.POSTGRES_DATABASE,
    password         : process.env.POSTGRES_PASSWORD,
    port             : process.env.POSTGRES_PORT
      ? Number.parseInt( process.env.POSTGRES_PORT, 10 )
      : 5432,
    ssl : process.env.POSTGRES_SSL === 'true'
      ? { rejectUnauthorized : false }
      : undefined,
  } )

if ( process.env.NODE_ENV !== 'production' ) {
  globalForPg.photoGoodPool = db
}
