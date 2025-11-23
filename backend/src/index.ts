import express from 'express';
import cors from 'cors';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { initDatabase } from './db';
import { config } from './config';

// Import routes
import uploadRoutes from './routes/upload';
import assetRoutes from './routes/asset';
import paymentRoutes from './routes/payment';
import unlockRoutes from './routes/unlock';
import negotiationRoutes from './routes/negotiation';
import derivativeRoutes from './routes/derivative';
import agentRoutes from './routes/agent';
import providerRoutes from './routes/provider';

const logger = pino({ level: config.server.nodeEnv === 'production' ? 'info' : 'debug' });

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(pinoHttp({ logger }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/upload', uploadRoutes);
app.use('/api/asset', assetRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/unlock', unlockRoutes);
app.use('/api/negotiation', negotiationRoutes);
app.use('/api/derivative', derivativeRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/provider', providerRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.server.nodeEnv === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function start() {
  try {
    // Initialize database
    await initDatabase();
    logger.info('Database initialized');

    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

