'use strict';

const db = require('../config/database');
const svnManagementService = require('../services/svnManagementService');

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

    const { rows } = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (!rows[0]) {
      throw new Error(`User '${username}' not found`);
    }

    return await svnManagementService.provisionSvnUser(rows[0].id, password);

  } catch (error) {
    console.error("SVN USER CREATION ERROR:", error.message);
    throw error;
  }
}

module.exports = { createSvnUser };
