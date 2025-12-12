import express, { Request, Response } from "express";
import cors from "cors";
import pino from "pino";
import pinoHttp from "pino-http";
// import { facilitator } from '@coinbase/x402'; // For mainnet - uncomment when ready
import { initDatabase } from "./db";
import { config } from "./config";

// Import routes
import uploadRoutes from "./routes/upload";
import assetRoutes from "./routes/asset";
import paymentRoutes from "./routes/payment";
import unlockRoutes from "./routes/unlock";
import negotiationRoutes from "./routes/negotiation";
import derivativeRoutes from "./routes/derivative";
import agentRoutes from "./routes/agent";
import providerRoutes from "./routes/provider";
import userRoutes from "./routes/user";
import royaltyRoutes from "./routes/royalty";

const logger = pino({
  level: config.server.nodeEnv === "production" ? "info" : "debug",
});

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

// x402 Payment Middleware
// Note: Route configurations are dynamically loaded from database
// For now, we'll set up a basic configuration that can be extended
const facilitatorConfig =
  process.env.NODE_ENV === "production"
    ? undefined // Use @coinbase/x402 facilitator for mainnet
    : { url: "https://x402.org/facilitator" }; // Testnet facilitator

// We'll apply x402 middleware selectively to specific routes
// The asset and unlock routes will use dynamic pricing from database

// API routes (upload doesn't require payment)
app.use("/api/upload", uploadRoutes);

// Payment verification route (no payment required - it verifies payments)
app.use("/api/payment", paymentRoutes);

// Other routes that don't require payment
app.use("/api/negotiation", negotiationRoutes);
app.use("/api/derivative", derivativeRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/user", userRoutes);
app.use("/api/royalty", royaltyRoutes);

// Asset and unlock routes will use x402 middleware with dynamic pricing
// We'll handle this in the route handlers themselves
app.use("/api/asset", assetRoutes);
app.use("/api/unlock", unlockRoutes);

// Error handling middleware
app.use(
  (err: Error, req: Request, res: Response, next: express.NextFunction) => {
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

async function start() {
  try {
    // Initialize database
    await initDatabase();
    logger.info("Database initialized");

    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
