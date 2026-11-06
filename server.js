import 'dotenv/config';
import app from './src/app.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`
======================================================
  EmailGuard API - Ready for High-Performance Traffic
======================================================
  Status:      ONLINE
  Port:        ${PORT}
  Host:        ${HOST}
  Environment: ${process.env.NODE_ENV || 'development'}
  Health Check: http://localhost:${PORT}/health
  Verify API:   http://localhost:${PORT}/v1/verify
======================================================
  RapidAPI Proxy Secret: ${
    process.env.RAPIDAPI_PROXY_SECRET
      ? 'ENABLED (Protected)'
      : 'DISABLED (Accepting all requests)'
  }
======================================================
`);
});

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('[Server] HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force shutdown after 10s timeout
  setTimeout(() => {
    console.error('[Server] Forceful shutdown initiated after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
