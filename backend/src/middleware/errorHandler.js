'use strict';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Joi validation errors
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details?.map(d => d.message) || [err.message],
    });
  }

  // Known operational errors (thrown with a statusCode)
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
    // NOTE: err.detail is NOT included — it can reveal column/value info
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Referenced resource does not exist' });
  }

  // MEDIUM: Never expose stack traces to the client in production
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    // In production: log server-side only, return generic error
    console.error('Unhandled error', { message: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal server error' });
  }

  // In development: include the message for easier debugging
  console.error('Unhandled error', { message: err.message, stack: err.stack });
  return res.status(500).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;