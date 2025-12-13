/**
 * Vercel Serverless Function Entry Point
 * This wraps the Express app to work with Vercel's serverless functions
 */

import express from "express";
import cors from "cors";
import pino from "pino";
import pinoHttp from "pino-http";
import { initDatabase } from "../src/db";
import { config } from "../src/config";

// Import routes
import uploadRoutes from "../src/routes/upload";
import assetRoutes from "../src/routes/asset";
import paymentRoutes from "../src/routes/payment";
import unlockRoutes from "../src/routes/unlock";
import negotiationRoutes from "../src/routes/negotiation";
import derivativeRoutes from "../src/routes/derivative";
import agentRoutes from "../src/routes/agent";
import providerRoutes from "../src/routes/provider";
import userRoutes from "../src/routes/user";
import royaltyRoutes from "../src/routes/royalty";

const logger = pino({
  level: config.server.nodeEnv === "production" ? "info" : "debug",
});

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(pinoHttp({ logger }));

// Health check (no payment required)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/upload", uploadRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/negotiation", negotiationRoutes);
app.use("/api/derivative", derivativeRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/user", userRoutes);
app.use("/api/royalty", royaltyRoutes);
app.use("/api/asset", assetRoutes);
app.use("/api/unlock", unlockRoutes);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(err);
    res.status(500).json({
      error: "Internal server error",
      message:
        config.server.nodeEnv === "development" ? err.message : undefined,
    });
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Initialize database on cold start
let dbInitialized = false;

async function ensureDatabaseInitialized() {
  if (!dbInitialized) {
    try {
      await initDatabase();
      logger.info("Database initialized");
      dbInitialized = true;
    } catch (error) {
      logger.error("Failed to initialize database:", error);
      throw error;
    }
  }
}

// Initialize database on module load (Vercel keeps functions warm)
ensureDatabaseInitialized().catch((error) => {
  logger.error("Failed to initialize database on startup:", error);
});

// Export the handler for Vercel
// Vercel expects a default export that handles the request
export default async function handler(
  req: express.Request,
  res: express.Response
) {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  // Handle the request with Express app
  app(req, res);
}
