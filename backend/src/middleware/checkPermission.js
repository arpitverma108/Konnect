'use strict';

const permService = require('../services/permissionService');

module.exports = (required = 'read') => {
  return async (req, res, next) => {

    try {
      const userId = req.user.id;
      const repoId = req.params.repoId || req.body.repoId;

      if (!repoId) {
        return res.status(400).json({ error: "repoId missing" });
      }

      // 🔓 super_admin bypass
      if (req.user.role === 'super_admin') {
        return next();
      }

      const perms = await permService.getUserPermissions(userId, repoId);

      let allowed = false;

      if (required === 'read') {
        allowed = permService.hasRead(perms);
      }

      if (required === 'write') {
        allowed = permService.hasWrite(perms);
      }

      if (!allowed) {
        return res.status(403).json({
          error: "Access denied"
        });
      }

      next();

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Permission check failed" });
    }
  };
};