// groups.js
'use strict';

const express  = require('express');
const Joi      = require('joi');
const router   = express.Router();

const db       = require('../config/database');
const validate = require('../middleware/validate');
const wrap     = require('../middleware/asyncWrapper');
const authzSvc = require('../services/authzService');

// ─── Validation ──────────────────────────────────────────────────────────────

const createGroupSchema = Joi.object({
  name:        Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).min(1).max(64).required(),
  description: Joi.string().max(512).optional().allow('', null),
});

const addMemberSchema = Joi.object({
  userId: Joi.number().integer().required(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/groups
router.get('/', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT g.*,
       COUNT(gm.user_id) AS member_count
     FROM groups g
     LEFT JOIN group_members gm ON gm.group_id = g.id
     GROUP BY g.id
     ORDER BY g.name`
  );
  res.json(rows);
}));

// POST /api/groups
router.post('/', validate(createGroupSchema), wrap(async (req, res) => {
  const { name, description } = req.body;
  const { rows } = await db.query(
    `INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING *`,
    [name, description || null]
  );
  res.status(201).json(rows[0]);
}));

// GET /api/groups/:id
router.get('/:id', wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Group not found' });
  res.json(rows[0]);
}));

// DELETE /api/groups/:id
router.delete('/:id', wrap(async (req, res) => {
  const { rows } = await db.query('DELETE FROM groups WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Group not found' });
  await authzSvc.rebuildAuthzFile(db);
  res.json({ message: `Group '${rows[0].name}' deleted` });
}));

// GET /api/groups/:id/members
router.get('/:id/members', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.email, u.full_name
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY u.username`,
    [req.params.id]
  );
  res.json(rows);
}));

// POST /api/groups/:id/members
router.post('/:id/members', validate(addMemberSchema), wrap(async (req, res) => {
  const { userId } = req.body;
  await db.query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.params.id, userId]
  );
  await authzSvc.rebuildAuthzFile(db);
  res.status(201).json({ message: 'Member added' });
}));

// DELETE /api/groups/:id/members/:userId
router.delete('/:id/members/:userId', wrap(async (req, res) => {
  await db.query(
    'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
    [req.params.id, req.params.userId]
  );
  await authzSvc.rebuildAuthzFile(db);
  res.json({ message: 'Member removed' });
}));

module.exports = router;
