import express from "express";
import cors from "cors";
import { jobRouter, systemRouter } from "./route";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/jobs", jobRouter);
app.use("/system", systemRouter);

export default app;
