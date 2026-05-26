import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import prisma from "./configs/prisma.js";
import workspaceRouter from "./Routes/workspaceRoutes.js";
import { protect } from "./middleware/authMiddleware.js";
import taskRouter from "./Routes/taskRoutes.js";
import commentRouter from "./Routes/commentRoutes.js";
import ProjectRouter from "./Routes/projectRoutes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.error("Blocked CORS origin:", origin);
      callback(new Error(`CORS policy blocked origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signingSecret =
      process.env.CLERK_WEBHOOK_SECRET ||
      process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!signingSecret) {
      return res.status(500).json({ message: "Missing Clerk webhook secret" });
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
      } else if (value) {
        headers.set(key, value);
      }
    }

    const request = new Request(
      `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      {
        method: req.method,
        headers,
        body: req.body,
      },
    );

    let event;
    try {
      event = await verifyWebhook(request, { signingSecret });
    } catch (error) {
      console.error("Clerk webhook verification failed:", error);
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const data = event.data;
    const rawType = event.type || "";
    const type = rawType.startsWith("clerk/")
      ? rawType.replace(/^clerk\//, "")
      : rawType;

    console.log(
      "Received Clerk webhook event:",
      type,
      "for",
      data?.id || data?.organization_id || "unknown",
    );

    try {
      if (type === "user.created" || type === "user.updated") {
        const email = data.email_addresses?.[0]?.email_address ?? "";
        const name =
          `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
          data.username ||
          email;

        await prisma.user.upsert({
          where: { id: data.id },
          create: {
            id: data.id,
            email,
            name,
            image: data.image_url ?? "",
          },
          update: {
            email,
            name,
            image: data.image_url ?? "",
          },
        });
      }

      if (type === "user.deleted") {
        await prisma.user.deleteMany({
          where: { id: data.id },
        });
      }

      if (type === "organization.created") {
        await prisma.$transaction(async (tx) => {
          await tx.workspace.upsert({
            where: { id: data.id },
            create: {
              id: data.id,
              name: data.name,
              slug: data.slug,
              ownerId: data.created_by,
              image_url: data.image_url,
            },
            update: {
              name: data.name,
              slug: data.slug,
              ownerId: data.created_by,
              image_url: data.image_url,
            },
          });

          await tx.workspaceMember.upsert({
            where: {
              userId_workspaceId: {
                userId: data.created_by,
                workspaceId: data.id,
              },
            },
            create: {
              userId: data.created_by,
              workspaceId: data.id,
              role: "ADMIN",
            },
            update: {
              role: "ADMIN",
            },
          });
        });
      }

      if (type === "organization.updated") {
        await prisma.workspace.update({
          where: { id: data.id },
          data: {
            name: data.name,
            slug: data.slug,
            image_url: data.image_url,
          },
        });
      }

      if (type === "organization.deleted") {
        await prisma.workspace.delete({
          where: { id: data.id },
        });
      }

      if (type === "organizationInvitation.accepted") {
        const role = String(data.role_name || "MEMBER").toUpperCase();
        const workspaceId = data.organization_id;

        await prisma.workspaceMember.upsert({
          where: {
            userId_workspaceId: {
              userId: data.user_id,
              workspaceId,
            },
          },
          create: {
            userId: data.user_id,
            workspaceId,
            role: role === "ADMIN" ? "ADMIN" : "MEMBER",
          },
          update: {
            role: role === "ADMIN" ? "ADMIN" : "MEMBER",
          },
        });
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Clerk webhook handler failed:", error);
      return res.status(500).json({ message: "Webhook handler failed" });
    }
  },
);

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

// Routes
app.use("/api/workspaces", protect, workspaceRouter);
app.use("/api/projects", protect, ProjectRouter);
app.use("/api/tasks", protect, taskRouter);
app.use("/api/comments", protect, commentRouter);
app.get("/", (req, res) => {
  res.send("Server is Live");
});

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
