'use strict';

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');

const hookSvc = require('../src/services/hookService');
const env = require('../src/config/env');

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function installHook(repoPath) {
  const hooksDir = path.join(repoPath, 'hooks');
  const hookPath = path.join(hooksDir, process.platform === 'win32' ? 'post-commit.bat' : 'post-commit');
  const hookContent = process.platform === 'win32'
    ? hookSvc.generatePostCommitHook().windows
    : hookSvc.generatePostCommitHook().unix;

  await fs.mkdir(hooksDir, { recursive: true });

  if (await pathExists(hookPath)) {
    const existing = await fs.readFile(hookPath, 'utf8');
    if (existing === hookContent) {
      await fs.chmod(hookPath, 0o755).catch(() => {});
      return { repoPath, status: 'unchanged' };
    }

    const backupPath = `${hookPath}.bak-${Date.now()}`;
    await fs.copyFile(hookPath, backupPath);
  }

  await fs.writeFile(hookPath, hookContent, 'utf8');
  await fs.chmod(hookPath, 0o755);

  return { repoPath, status: 'installed' };
}

async function listRepoPaths() {
  const root = env.SVN_REPOS_ROOT;
  const entries = await fs.readdir(root, { withFileTypes: true });

  const repos = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const repoPath = path.join(root, entry.name);
    if (await pathExists(path.join(repoPath, 'format'))) {
      repos.push(repoPath);
    }
  }

  return repos;
}

async function main() {
  const repoPaths = process.argv.slice(2);
  const targets = repoPaths.length ? repoPaths : await listRepoPaths();

  if (!targets.length) {
    console.log('No SVN repositories found.');
    return;
  }

  console.log(`Installing post-commit hooks for ${targets.length} repositories.`);
  console.log(`HOOK_WEBHOOK_URL=${env.HOOK_WEBHOOK_URL}`);

  let failed = 0;

  for (const repoPath of targets) {
    try {
      const result = await installHook(repoPath);
      console.log(`${result.status}: ${result.repoPath}`);
    } catch (error) {
      failed++;
      console.error(`failed: ${repoPath}: ${error.message}`);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  installHook,
  listRepoPaths,
};
