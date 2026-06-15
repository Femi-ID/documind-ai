// Helpers to spin up Postgres (with pgvector) and Redis containers
// for integration tests. Each test suite calls these in beforeAll,
// gets the connection details, and tears down in afterAll.
//
// We use the pgvector/pgvector image instead of plain postgres
// so the extension is pre-installed — saves 30+ seconds per suite.

import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export interface PostgresContext {
  container: StartedTestContainer;
  connectionString: string;
}

export interface RedisContext {
  container: StartedTestContainer;
  host: string;
  port: number;
}

/**
 * Starts a Postgres container with pgvector pre-installed.
 * Returns connection details for the test to inject into its env.
 *
 * Usage:
 *   let pg: PostgresContext;
 *   beforeAll(async () => { pg = await startPostgres(); });
 *   afterAll(async () => { await pg.container.stop(); });
 */
export async function startPostgres(): Promise<PostgresContext> {
  const container = await new GenericContainer('pgvector/pgvector:pg16')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'documind_test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage('database system is ready to accept connections', 2),
    )
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgresql://test:test@${host}:${port}/documind_test?schema=public`;

  return { container, connectionString };
}

/**
 * Starts a Redis container.
 */
export async function startRedis(): Promise<RedisContext> {
  const container = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();

  return {
    container,
    host: container.getHost(),
    port: container.getMappedPort(6379),
  };
}

/**
 * Runs Prisma migrations against the test Postgres instance.
 * Call this after startPostgres() and before any tests.
 *
 * NOTE: This shells out to `prisma migrate deploy`. For this to work,
 * Prisma must be installed (it is used it in production).
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const { execSync } = await import('child_process');

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: 'pipe', // suppress output unless something fails
  });
}
