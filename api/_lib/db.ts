import { neon } from '@neondatabase/serverless'

/**
 * Neon serverless SQL client. Uses the pooled DATABASE_URL connection string
 * set in the Vercel project environment. Tagged-template usage is
 * automatically parameterized, so interpolated values are safe from injection.
 */
export const sql = neon(process.env.DATABASE_URL || '')

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
