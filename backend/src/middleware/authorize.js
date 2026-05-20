'use strict';

module.exports = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: no user context' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: requires one of [${roles.join(', ')}], got "${req.user.role}"`,
      });
    }
    next();
  };
};
