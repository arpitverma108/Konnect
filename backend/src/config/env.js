'use strict';

const Joi = require('joi');

const schema = Joi.object({

  PORT: Joi.number().default(3000),

  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // 🗄️ DATABASE
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),

  // 🔥 JWT (CRITICAL)
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // 🔐 SECURITY / HASHING
  BCRYPT_ROUNDS: Joi.number().default(12),

  // 📁 SVN CONFIG
  SVN_REPOS_ROOT: Joi.string().required(),
  SVN_BASE_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),

  // 🌐 APACHE CONFIG
  HTPASSWD_PATH: Joi.string().required(),
  AUTHZ_PATH: Joi.string().required(),
  APACHE_RELOAD_CMD: Joi.string().default('httpd -k graceful'),

  // ⚙️ SVN BINARIES
  SVNADMIN_PATH: Joi.string().default('svnadmin'),
  SVNLOOK_PATH: Joi.string().default('svnlook'),
  SVN_PATH: Joi.string().default('svn'),

  // 🌍 CORS
  CORS_ORIGIN: Joi.string().uri({ scheme: ['http', 'https'] }).required(),

  // 🔁 SYNC WEBHOOK (IMPORTANT)
  SYNC_WEBHOOK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .default('http://localhost:3000/api/sync'),
    }),

  // 🔐 HOOK SECURITY (IMPORTANT)
  SYNC_SECRET: Joi.string().min(16).required(),

}).unknown(true);


// 🔍 VALIDATION FUNCTION
function validateEnv() {
  const { error, value } = schema.validate(process.env, {
    abortEarly: false
  });

  if (error) {
    const missing = error.details
      .map(d => `  - ${d.message}`)
      .join('\n');

    console.error('❌ ENV VALIDATION ERROR:\n' + missing);

    process.exit(1);
  }

  return value;
}


// ✅ EXPORT VALIDATED ENV
const env = validateEnv();

module.exports = {
  ...env,
  baseUrl: env.SVN_BASE_URL
};