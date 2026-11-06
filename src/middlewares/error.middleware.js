/**
 * 404 Route Not Found Middleware
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Centralized Global Error Handler
 */
export function globalErrorHandler(err, req, res, next) {
  console.error('[Unhandled Error]', err);

  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    status: 'error',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: isProduction
      ? 'An unexpected internal error occurred. Please try again later.'
      : err.message || 'Internal server error',
    ...(!isProduction && { stack: err.stack }),
  });
}
