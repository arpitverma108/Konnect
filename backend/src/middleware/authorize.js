'use strict';


module.exports = (...roles) => {
  return (req, res, next) => {

    // Auth middleware failed silently or route was misconfigured
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: no user context' });
    }

    // User is authenticated but doesn't have the required role
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: requires one of [${roles.join(', ')}], got "${req.user.role}"`,
      });
    }

    next();
  };
};