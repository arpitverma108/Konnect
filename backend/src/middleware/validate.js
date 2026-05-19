// validate.js
'use strict';

/**
 * Returns an Express middleware that validates req.body against a Joi schema.
 * On failure it calls next(err) which the errorHandler will catch.
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) return next(error);
    req[property] = value;
    next();
  };
}

module.exports = validate;
