// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Error Handling Middleware
// ============================================================

/**
 * Catch-all 404 handler.
 * Responds when no route matches the request.
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Global error handler.
 * Catches any unhandled errors thrown in route handlers.
 * In development, includes the error stack trace for debugging.
 */
function errorHandler(err, _req, res, _next) {
  console.error('[Error]', err.stack || err.message);

  const statusCode = err.statusCode || 500;
  // Determine if it's a known error with a safe message
  const isSafeMessage = statusCode < 500;
  
  const response = {
    success: false,
    message: isSafeMessage ? err.message : 'An internal server error occurred.',
  };

  // Include actual message and stack trace in development only
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    if (!isSafeMessage) response.message = err.message || 'Internal Server Error';
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = { notFoundHandler, errorHandler };
