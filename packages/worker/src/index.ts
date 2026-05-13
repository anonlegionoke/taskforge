import "./config";
import { shutdownConsumer, startConsumer } from "./consumer";

process.on("SIGTERM", () => shutdownConsumer("SIGTERM"));
process.on("SIGINT", () => shutdownConsumer("SIGINT"));

startConsumer();
