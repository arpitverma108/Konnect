// validate.js
'use strict';

/**
 * Returns an Express middleware that validates req.body against a Joi schema.
 * On failure it calls next(err) which the errorHandler will catch.
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });
    if (error) return next(error);
    next();
  };
}

module.exports = validate;
