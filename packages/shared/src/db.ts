// DB Pool
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: '../../../.env' });

if (!process.env.DATABASE_URL) {
    throw new Error('FATAL: DATABASE_URL environment variable is missing.');
}

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});


pool.on('error', (err, client) => {
    console.error(`Unexpected error on idle database client ${client}`, err);
});

export const query = (text: string, params?: any[]) => {
    return pool.query(text, params);
}
