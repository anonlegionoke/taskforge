import express from "express";
import cors from "cors";
import { jobRouter } from "./route";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/jobs", jobRouter);

export default app;
