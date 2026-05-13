import express from "express";
import { jobRouter } from "./route";

const app = express();
app.use(express.json());

app.use("/jobs", jobRouter);

export default app;
