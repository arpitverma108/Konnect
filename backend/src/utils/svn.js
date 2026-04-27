'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const HT_PASSWD_PATH = process.env.HTPASSWD_PATH;

if (!HT_PASSWD_PATH) {
  throw new Error("HTPASSWD_PATH env var is required");
}

// ✅ Strong validation
function validateUsername(username) {
  if (!username) throw new Error("Username is required");

  const isValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);

  if (!isValid) {
    throw new Error("Invalid username (3-20 chars, alphanumeric + underscore only)");
  }
}

function validatePassword(password) {
  if (!password) throw new Error("Password is required");

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
}

// 🔐 Create SVN user (SAFE)
async function createSvnUser(username, password) {
  try {
    validateUsername(username);
    validatePassword(password);

    // -b → batch mode
    // -c → create file (optional, use only first time)
    const args = ['-b', HT_PASSWD_PATH, username, password];

    const { stdout, stderr } = await execFileAsync('htpasswd', args);

    if (stderr) {
      console.warn("HTPASSWD WARNING:", stderr);
    }

    return stdout || `User ${username} created successfully`;

  } catch (error) {
    console.error("SVN USER CREATION ERROR:", error.message);
    throw error;
  }
}

module.exports = { createSvnUser };