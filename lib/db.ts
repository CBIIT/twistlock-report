import { Pool } from "pg";

type SslConfig = false | { rejectUnauthorized: boolean } | undefined;
type DbPoolConfig = {
	connectionString?: string;
	host?: string;
	port?: number;
	database?: string;
	user?: string;
	password?: string;
	ssl?: SslConfig;
	max?: number;
	idleTimeoutMillis?: number;
};
type QueryRow = Record<string, unknown>;

type PoolHolder = {
	pool?: Pool;
};

function parsePort(value: string | undefined): number {
	if (!value) return 5432;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 5432;
}

function resolveSsl(): SslConfig {
	const sslMode = (process.env.PGSSLMODE ?? "").toLowerCase();
	const ssl = (process.env.PGSSL ?? "").toLowerCase();
	const rejectUnauthorizedSetting = (process.env.PGSSL_REJECT_UNAUTHORIZED ?? "").toLowerCase();

	if (sslMode === "disable" || ssl === "false" || ssl === "0") {
		return false;
	}

	if (rejectUnauthorizedSetting === "true" || rejectUnauthorizedSetting === "1") {
		return { rejectUnauthorized: true };
	}

	if (rejectUnauthorizedSetting === "false" || rejectUnauthorizedSetting === "0") {
		return { rejectUnauthorized: false };
	}

	if (
		sslMode === "require" ||
		sslMode === "verify-ca" ||
		sslMode === "verify-full" ||
		sslMode === "no-verify" ||
		ssl === "true" ||
		ssl === "1"
	) {
		return { rejectUnauthorized: sslMode !== "no-verify" };
	}

	// Default to encrypted transport for managed PostgreSQL instances that require SSL.
	return { rejectUnauthorized: false };
}

function getPoolConfig(): DbPoolConfig {
	const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.PG_URL;
	const ssl = resolveSsl();

	if (connectionString) {
		return {
			connectionString,
			ssl,
		};
	}

	const host = process.env.PGHOST ?? process.env.POSTGRES_HOST;
	const database = process.env.PGDATABASE ?? process.env.POSTGRES_DB;
	const user = process.env.PGUSER ?? process.env.POSTGRES_USER;
	const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD;

	if (!host || !database || !user || !password) {
		throw new Error(
			"Database connection is not configured. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD."
		);
	}

	return {
		host,
		port: parsePort(process.env.PGPORT ?? process.env.POSTGRES_PORT),
		database,
		user,
		password,
		ssl,
	};
}

function getPool(): Pool {
	const globalPool = globalThis as typeof globalThis & PoolHolder;

	if (!globalPool.pool) {
		globalPool.pool = new Pool({
			...getPoolConfig(),
			max: 10,
			idleTimeoutMillis: 30_000,
		});
	}

	return globalPool.pool;
}

export async function query<T extends QueryRow>(text: string, params: unknown[] = []): Promise<T[]> {
	const pool = getPool();
	const result = await pool.query(text, params);
	return result.rows as T[];
}
