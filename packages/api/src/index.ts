import "./config";
import { shutdownAPIServer, startAPIServer } from "./server";

process.on("SIGTERM", () => shutdownAPIServer("SIGTERM"));
process.on("SIGINT", () => shutdownAPIServer("SIGINT"));

startAPIServer();
