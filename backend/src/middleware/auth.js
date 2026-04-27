'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1️⃣ Check header exists + correct format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  // 2️⃣ Extract token
  const token = authHeader.split(' ')[1];

  try {
    // 3️⃣ Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // 4️⃣ Attach user
    req.user = decoded;

    next();

  } catch (err) {

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: "Token expired"
      });
    }

    return res.status(401).json({
      error: "Invalid token"
    });
  }
};