import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { jobRouter, systemRouter } from "./route";

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin === "*" ? "*" : corsOrigin }));

app.set("trust proxy", 1);

// Global Rate Limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: "Too many request, please try again later." },
});
app.use(limiter);

app.use(express.json());

app.use("/jobs", jobRouter);
app.use("/system", systemRouter);

export default app;
