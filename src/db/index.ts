import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // Serverless (Vercel) runs many small instances: keep each pool small.
    max: process.env.VERCEL ? 5 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    // Hosted Postgres (Neon, Supabase, Vercel Postgres…) requires TLS.
    ssl: isLocal || /sslmode=disable/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
  });

globalForDb.__arenaNextJsPostgresqlPool = pool;

export const db = drizzle(pool);
