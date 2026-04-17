'use strict';

const Joi = require('joi');

const schema = Joi.object({
  PORT:              Joi.number().default(3000),
  NODE_ENV:          Joi.string().valid('development','production','test').default('development'),
  DB_HOST:           Joi.string().default('localhost'),
  DB_PORT:           Joi.number().default(5432),
  DB_NAME:           Joi.string().required(),
  DB_USER:           Joi.string().required(),
  DB_PASSWORD:       Joi.string().required(),
  SVN_REPOS_ROOT:    Joi.string().required(),
  HTPASSWD_PATH:     Joi.string().required(),
  AUTHZ_PATH:        Joi.string().required(),
  APACHE_RELOAD_CMD: Joi.string().default('httpd -k graceful'),
  SVNADMIN_PATH:     Joi.string().default('svnadmin'),
  SVNLOOK_PATH:      Joi.string().default('svnlook'),
  SVN_PATH:          Joi.string().default('svn'),
  BCRYPT_ROUNDS:     Joi.number().default(12),
}).unknown(true);

function validateEnv() {
  const { error, value } = schema.validate(process.env, { abortEarly: false });
  if (error) {
    const missing = error.details.map(d => `  - ${d.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${missing}`);
  }
  return value;
}

module.exports = { validateEnv };
