import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import mongoose from "mongoose";
import path from "node:path";
import { entityNames } from "./config/entities.js";
import entitiesRouter from "./routes/entities.js";
import uploadsRouter from "./routes/uploads.js";
import authRouter from "./routes/auth.js";
import publicRouter from "./routes/public.js";
import { ensureAdminUser } from "./lib/bootstrap.js";

dotenv.config();

const app = express();
const port = Number.parseInt(process.env.PORT || "4000", 10);
const mongoUri = process.env.MONGODB_URI;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

if (!mongoUri) {
  throw new Error("Missing MONGODB_URI in environment variables.");
}

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "100mb" }));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/public", publicRouter);
app.use("/api/entities", entitiesRouter);
app.use("/api/integrations", uploadsRouter);

const distDir = path.resolve(process.cwd(), "dist");
const hasFrontendBuild = fs.existsSync(path.join(distDir, "index.html"));

if (hasFrontendBuild) {
  app.use(express.static(distDir));

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
      return next();
    }
    res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: error.message || "Internal server error",
  });
});

async function start() {
  await mongoose.connect(mongoUri);
  await ensureAdminUser();
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log(
      `Registered entities (${entityNames.length}): ${entityNames.join(", ")}`,
    );
    if (hasFrontendBuild) {
      console.log(`Serving frontend from ${distDir}`);
    }
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
