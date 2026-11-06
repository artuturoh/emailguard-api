import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import v1Routes from './routes/v1.routes.js';
import { getHealth } from './controllers/verify.controller.js';
import { rapidApiProxyMiddleware } from './middlewares/rapidapi.middleware.js';
import {
  notFoundHandler,
  globalErrorHandler,
} from './middlewares/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Security HTTP headers configured to allow Tailwind CDN & Google Fonts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// Enable CORS for cross-origin integration
app.use(cors());

// Parse incoming JSON payloads (strict limit to prevent memory abuse)
app.use(express.json({ limit: '100kb' }));

// Healthcheck at root level (bypasses proxy secret for external monitors like BetterStack/RapidAPI)
app.get('/health', getHealth);

// Root route: serves modern dark landing page if HTML requested, or JSON for API clients
app.get('/', (req, res) => {
  const explicitJson = req.get('accept')?.includes('application/json');

  if (explicitJson && !req.get('accept')?.includes('text/html')) {
    return res.json({
      name: 'EmailGuard API',
      description:
        'High-performance email hygiene, disposable detection, and MX verification microservice',
      documentation:
        'https://rapidapi.com/artuturoh/api/emailguard-disposable-email-detector-and-hygiene',
      health: '/health',
      version: '1.0.0',
    });
  }

  if (req.accepts('html')) {
    return res.sendFile(join(__dirname, '../public/index.html'));
  }

  return res.json({
    name: 'EmailGuard API',
    description:
      'High-performance email hygiene, disposable detection, and MX verification microservice',
    documentation:
      'https://rapidapi.com/artuturoh/api/emailguard-disposable-email-detector-and-hygiene',
    health: '/health',
    version: '1.0.0',
  });
});

// Serve static assets from public directory (without intercepting GET /)
app.use(express.static(join(__dirname, '../public'), { index: false }));

// RapidAPI proxy authentication middleware
app.use(rapidApiProxyMiddleware);

// Mount API v1 routes
app.use('/v1', v1Routes);

// Catch 404
app.use(notFoundHandler);

// Centralized error handler
app.use(globalErrorHandler);

export default app;
