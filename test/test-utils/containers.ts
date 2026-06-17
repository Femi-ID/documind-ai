// Connects to your LOCAL Postgres and Redis instances instead of
// spinning up testcontainers. This is faster and works regardless
// of Docker setup issues on Windows.
//
// REQUIREMENTS:
// - Your local Postgres (with pgvector extension) must be running
// - Your local Redis must be running
// - A separate test database will be created/dropped per run
//
// Why a separate database? So tests can't accidentally wipe your
// dev data. Each run drops the test DB clean before migrations.

import { execSync } from 'child_process';
import { Client } from 'pg';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root (one level up from /test)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface PostgresContext {
  connectionString: string;
  container: { stop: () => Promise<void> };
}

export interface RedisContext {
  host: string;
  port: number;
  container: { stop: () => Promise<void> };
}

// ── Parse DATABASE_URL from .env ──
// Expected format: postgresql://user:password@host:port/dbname?schema=public
function parseDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL not found in .env. Integration tests need this to connect.',
    );
  }

  const match = url.match(
    /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/,
  );
  if (!match) {
    throw new Error(`Could not parse DATABASE_URL: ${url}`);
  }

  return {
    user: match[1],
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

const pgConfig = parseDatabaseUrl();
const LOCAL_REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const LOCAL_REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const TEST_DB_NAME = `documind_test_${Date.now()}`;

/**
 * Creates a fresh test database on local Postgres.
 */
export async function startPostgres(): Promise<PostgresContext> {
  console.log(`Creating test database: ${TEST_DB_NAME}`);

  // Connect to the user's default database (e.g. their dev DB) to create the test DB.
  // We use the user's existing database as the "admin" connection point —
  // any database the user can connect to lets them issue CREATE DATABASE.
  const adminClient = new Client({
    host: pgConfig.host,
    port: pgConfig.port,
    user: pgConfig.user,
    password: pgConfig.password,
    database: pgConfig.database, // connect to dev DB to issue CREATE
  });

  try {
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } catch (err: any) {
    throw new Error(
      `Failed to create test database "${TEST_DB_NAME}". ` +
        `Connected as user "${pgConfig.user}" to ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}. ` +
        `Original error: ${err.message}`,
    );
  } finally {
    await adminClient.end();
  }

  // Connect to the new test DB and enable pgvector
  const testClient = new Client({
    host: pgConfig.host,
    port: pgConfig.port,
    user: pgConfig.user,
    password: pgConfig.password,
    database: TEST_DB_NAME,
  });

  try {
    await testClient.connect();
    await testClient.query('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (err: any) {
    throw new Error(`Failed to enable pgvector: ${err.message}`);
  } finally {
    await testClient.end();
  }

  const connectionString = `postgresql://${pgConfig.user}:${encodeURIComponent(pgConfig.password)}@${pgConfig.host}:${pgConfig.port}/${TEST_DB_NAME}?schema=public`;

  return {
    connectionString,
    container: {
      stop: async () => {
        const cleanupClient = new Client({
          host: pgConfig.host,
          port: pgConfig.port,
          user: pgConfig.user,
          password: pgConfig.password,
          database: pgConfig.database,
        });
        try {
          await cleanupClient.connect();
          await cleanupClient.query(`
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()
          `);
          await cleanupClient.query(
            `DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`,
          );
          console.log(`Dropped test database: ${TEST_DB_NAME}`);
        } catch (err: any) {
          console.warn(`Failed to drop test database: ${err.message}`);
        } finally {
          await cleanupClient.end();
        }
      },
    },
  };
}

/**
 * Verifies local Redis is reachable. Uses db 15 to avoid colliding with dev data.
 */
export async function startRedis(): Promise<RedisContext> {
  const TEST_REDIS_DB = 15;

  const client = new Redis({
    host: LOCAL_REDIS_HOST,
    port: LOCAL_REDIS_PORT,
    db: TEST_REDIS_DB,
    lazyConnect: true,
  });

  try {
    await client.connect();
    await client.ping();
    await client.flushdb();
  } catch (err: any) {
    throw new Error(
      `Failed to connect to Redis at ${LOCAL_REDIS_HOST}:${LOCAL_REDIS_PORT}. ` +
        `Original error: ${err.message}`,
    );
  } finally {
    await client.disconnect();
  }

  return {
    host: LOCAL_REDIS_HOST,
    port: LOCAL_REDIS_PORT,
    container: {
      stop: async () => {
        const cleanupClient = new Redis({
          host: LOCAL_REDIS_HOST,
          port: LOCAL_REDIS_PORT,
          db: TEST_REDIS_DB,
        });
        try {
          await cleanupClient.flushdb();
        } catch (err: any) {
          console.warn(`Failed to flush Redis: ${err.message}`);
        } finally {
          await cleanupClient.disconnect();
        }
      },
    },
  };
}

/**
 * Runs Prisma migrations against the test database.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: 'pipe',
  });
}
