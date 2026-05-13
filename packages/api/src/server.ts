import { pool } from "@taskforge/shared";
import { Server } from "http";
import app from "./app";

const PORT = process.env.API_SERVER_PORT || 3000;
let server: Server;

// Boot Sequence
export const startAPIServer = async () => {
  try {
    console.log("Starting Taskforge API Server...");

    // Test DB
    await pool.query("SELECT 1");
    console.log("SUCCESS: DB connected.");

    server = app.listen(PORT, () => {
      console.log("SUCCESS: Taskforge API listening on port:", PORT);
    });
  } catch (error) {
    console.error("FAILED: Fatal error during startup", error);
    process.exit(1);
  }
};

/* Graceful shutdown */
export const shutdownAPIServer = async (signal: string) => {
  console.log(`Received ${signal}. Starting API shutdown...`);

  if (server) {
    console.log("Refusing new HTTP requests and draining active ones...");

    server.close(async (error) => {
      if (error) {
        console.error("Error while closing express server:", error);
      }

      try {
        console.log("Closing Database connections...");
        await pool.end();
        console.log("API Shutdown complete!");
        process.exit(0);
      } catch (dbError) {
        console.error("Error closing Postgres pool:", dbError);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};
