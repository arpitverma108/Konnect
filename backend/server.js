'use strict';

require('dotenv').config();
require('./src/config/env'); // ✅ validates env automatically

const app = require('./src/app');
const db = require('./src/config/database');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('✅ PostgreSQL connection established');

    // app.listen(PORT, '0.0.0.0',() => {
    //   console.log(`🚀 Server running on http://localhost:${PORT}`);
    //   console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    // });
    app.listen(PORT, '0.0.0.0',() => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();