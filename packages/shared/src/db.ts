// DB Pool
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('FATAL: DATABASE_URL environment variable is missing.');
}

export const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});


pool.on('error', (err, client) => {
    console.error(`Unexpected error on idle database client ${client}`, err);
});

export const query = (text: string, params?: unknown[]) => {
    return pool.query(text, params);
};
