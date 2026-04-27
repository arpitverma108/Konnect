require('dotenv').config({
  path: '/home/arihant/Desktop/arpit/Konnect/backend/.env'
});

const { execSync } = require('child_process');
const { Client } = require('pg');

// DB connection
const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function sync() {
  try {
    await client.connect();

    console.log("🔄 Sync started...");

    // 🔥 Get latest commits from SVN
    const output = execSync(
      `svn log file:///svn/repos/project1 --limit 20 --xml`
    ).toString();

    // Simple XML parsing (basic)
    const entries = output.split('<logentry').slice(1);

    for (const entry of entries) {
      const revision = entry.match(/revision="(\d+)"/)?.[1];
      const author = entry.match(/<author>(.*?)<\/author>/)?.[1];
      const date = entry.match(/<date>(.*?)<\/date>/)?.[1];
      const message = entry.match(/<msg>(.*?)<\/msg>/)?.[1];

      if (!revision) continue;

      // 🔥 Insert safely (no duplicates)
      await client.query(`
        INSERT INTO activity (repo_id, revision, author, message, committed_at)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (repo_id, revision) DO NOTHING
      `, [1, revision, author, message, date]);

      console.log(`✅ Synced revision ${revision}`);
    }

  } catch (err) {
    console.error("❌ Sync error:", err.message);
  } finally {
    await client.end();
  }
}

sync();