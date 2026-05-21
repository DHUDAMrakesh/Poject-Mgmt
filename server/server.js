import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";

const app = express();

app.use(cors());
app.use(express.json());

// Clerk (can stay here)
app.use(clerkMiddleware());

// Inngest MUST be mounted like this
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: functions,
  }),
);

app.get("/", (req, res) => {
  res.send("Server is Live");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Inngest: http://localhost:${PORT}/api/inngest`);
});
