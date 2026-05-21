import { pool, SystemLogger } from "@taskforge/shared";
import { Server } from "http";
import app from "./app";

const PORT = process.env.API_SERVER_PORT || 3000;
let server: Server;

const logger = new SystemLogger("API_SERVER");

// Boot Sequence
export const startAPIServer = async () => {
  try {
    logger.info("Starting Taskforge API Server...");

    // Test DB
    await pool.query("SELECT 1");
    logger.info("SUCCESS: DB connected.");

    server = app.listen(PORT, () => {
      logger.info("SUCCESS: Taskforge API listening on port:", PORT);
    });
  } catch (error) {
    logger.error("FAILED: Fatal error during startup", error);
    process.exit(1);
  }
};

/* Graceful shutdown */
export const shutdownAPIServer = async (signal: string) => {
  logger.info(`Received ${signal}. Starting API shutdown...`);

  if (server) {
    logger.info("Refusing new HTTP requests and draining active ones...");

    server.close(async (error) => {
      if (error) {
        logger.error("Error while closing express server:", error);
      }

      try {
        logger.info("Closing Database connections...");
        await pool.end();
        logger.info("API Shutdown complete!");
        process.exit(0);
      } catch (dbError) {
        logger.error("Error closing Postgres pool:", dbError);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};
