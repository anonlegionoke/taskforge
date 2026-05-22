import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

async function setup() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL missing in .env.test");
    
    // Connect to the default 'postgres' admin database to execute DROP/CREATE
    const adminUrl = url.replace('/taskforge_test', '/postgres');
    const client = new Client({ connectionString: adminUrl });
    
    try {
        await client.connect();
        
        // Terminate any active connections so we can drop it safely
        await client.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = 'taskforge_test'
              AND pid <> pg_backend_pid();
        `);
        
        console.log("Recreating taskforge_test database...");
        await client.query('DROP DATABASE IF EXISTS taskforge_test');
        await client.query('CREATE DATABASE taskforge_test');
        console.log("Successfully recreated taskforge_test database.");
    } catch (err) {
        console.error("Failed to setup test database:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setup();
