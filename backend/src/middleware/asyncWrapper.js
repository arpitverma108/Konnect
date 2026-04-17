// asyncWrapper.js
'use strict';

/**
 * Wraps async route handlers to forward errors to Express error handler.
 */
const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncWrapper;
