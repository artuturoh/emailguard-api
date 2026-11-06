import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import v1Routes from './routes/v1.routes.js';
import { getHealth } from './controllers/verify.controller.js';
import { rapidApiProxyMiddleware } from './middlewares/rapidapi.middleware.js';
import {
  notFoundHandler,
  globalErrorHandler,
} from './middlewares/error.middleware.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// Enable CORS for cross-origin integration
app.use(cors());

// Parse incoming JSON payloads (strict limit to prevent memory abuse)
app.use(express.json({ limit: '100kb' }));

// Healthcheck at root level (bypasses proxy secret for external monitors like BetterStack/RapidAPI)
app.get('/health', getHealth);
app.get('/', (req, res) => {
  res.json({
    name: 'EmailGuard API',
    description:
      'High-performance email hygiene, disposable detection, and MX verification microservice',
    documentation: 'https://rapidapi.com',
    health: '/health',
    version: '1.0.0',
  });
});

// RapidAPI proxy authentication middleware
app.use(rapidApiProxyMiddleware);

// Mount API v1 routes
app.use('/v1', v1Routes);

// Catch 404
app.use(notFoundHandler);

// Centralized error handler
app.use(globalErrorHandler);

export default app;
