// 'use strict';

// // ─────────────────────────────────────────────
// // 🔔 NOTIFICATIONS API
// // ─────────────────────────────────────────────

// const express = require('express');
// const router  = express.Router();

// const db   = require('../config/database');
// const wrap = require('../middleware/asyncWrapper');
// const auth = require('../middleware/auth');

// // ─────────────────────────────────────────────
// // GET /api/notifications/count  (bell badge)
// // ─────────────────────────────────────────────

// router.get('/count', auth, wrap(async (req, res) => {

//   const isAdminOrAbove = ['admin', 'super_admin'].includes(req.user.role);

//   // BUG FIX: same as activity — super_admin has no rows in permissions table,
//   // so the subquery returned 0. Admins bypass the permission filter.
//   let commitCount = 0;
//   if (isAdminOrAbove) {
//     const { rows } = await db.query(`
//       SELECT COUNT(*) AS cnt
//       FROM activity
//       WHERE committed_at >= NOW() - INTERVAL '7 days'
//     `);
//     commitCount = parseInt(rows[0].cnt, 10);
//   } else {
//     const { rows } = await db.query(`
//       SELECT COUNT(*) AS cnt
//       FROM activity a
//       WHERE a.committed_at >= NOW() - INTERVAL '7 days'
//         AND a.repo_id IN (
//           SELECT repo_id FROM permissions
//           WHERE
//             (subject_type = 'user'  AND subject_id = $1)
//             OR
//             (subject_type = 'group' AND subject_id IN (
//               SELECT group_id FROM group_members WHERE user_id = $1
//             ))
//         )
//     `, [req.user.id]);
//     commitCount = parseInt(rows[0].cnt, 10);
//   }

//   let adminCount = 0;
//   if (isAdminOrAbove) {
//     const { rows } = await db.query(`
//       SELECT COUNT(*) AS cnt FROM admin_logs
//       WHERE created_at >= NOW() - INTERVAL '7 days'
//     `);
//     adminCount = parseInt(rows[0].cnt, 10);
//   }

//   res.json({ count: Math.min(commitCount + adminCount, 99) });
// }));

// // ─────────────────────────────────────────────
// // GET /api/notifications?limit=20&offset=0
// //
// // BUG FIX: `total` previously returned all.length (the sliced page size),
// // not the real total count before pagination.
// // ─────────────────────────────────────────────

// router.get('/', auth, wrap(async (req, res) => {

//   const limit  = Math.min(parseInt(req.query.limit)  || 20, 50);
//   const offset = Math.max(parseInt(req.query.offset) || 0,  0);

//   const isAdminOrAbove = ['admin', 'super_admin'].includes(req.user.role);

//   // Fetch commit notifications — admins see all, viewers see permitted repos only
//   let commits = [];
//   if (isAdminOrAbove) {
//     const { rows } = await db.query(`
//       SELECT
//         'commit'       AS type,
//         a.id,
//         a.author       AS actor,
//         a.message      AS description,
//         r.name         AS context,
//         a.committed_at AS created_at,
//         a.revision
//       FROM activity a
//       JOIN repositories r ON r.id = a.repo_id
//       ORDER BY a.committed_at DESC
//       LIMIT $1
//     `, [limit + offset]); // fetch enough to cover offset
//     commits = rows;
//   } else {
//     const { rows } = await db.query(`
//       SELECT
//         'commit'       AS type,
//         a.id,
//         a.author       AS actor,
//         a.message      AS description,
//         r.name         AS context,
//         a.committed_at AS created_at,
//         a.revision
//       FROM activity a
//       JOIN repositories r ON r.id = a.repo_id
//       WHERE a.repo_id IN (
//         SELECT repo_id FROM permissions
//         WHERE
//           (subject_type = 'user'  AND subject_id = $1)
//           OR
//           (subject_type = 'group' AND subject_id IN (
//             SELECT group_id FROM group_members WHERE user_id = $1
//           ))
//       )
//       ORDER BY a.committed_at DESC
//       LIMIT $2
//     `, [req.user.id, limit + offset]);
//     commits = rows;
//   }

//   // Admin log events
//   let adminEvents = [];
//   if (isAdminOrAbove) {
//     const { rows } = await db.query(`
//       SELECT
//         'admin'      AS type,
//         al.id,
//         u.username   AS actor,
//         al.action    AS description,
//         al.entity    AS context,
//         al.created_at,
//         NULL::integer AS revision
//       FROM admin_logs al
//       LEFT JOIN users u ON u.id = al.user_id
//       ORDER BY al.created_at DESC
//       LIMIT $1
//     `, [limit + offset]);
//     adminEvents = rows;
//   }

//   // Merge, sort, then paginate correctly
//   const all = [...commits, ...adminEvents]
//     .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

//   const totalCount = all.length; // total before pagination
//   const page       = all.slice(offset, offset + limit);

//   res.json({
//     total:  totalCount,  // FIX: real total, not page size
//     limit,
//     offset,
//     data:   page,
//   });
// }));

// // ─────────────────────────────────────────────
// // POST /api/notifications/mark-read
// // ─────────────────────────────────────────────

// router.post('/mark-read', auth, wrap(async (_req, res) => {
//   res.json({ message: 'Marked as read' });
// }));

// module.exports = router;

'use strict';

// ─────────────────────────────────────────────
// 🔔 NOTIFICATIONS API
// ─────────────────────────────────────────────

const express = require('express');
const router  = express.Router();

const db   = require('../config/database');
const wrap = require('../middleware/asyncWrapper');
const auth = require('../middleware/auth');

// ─────────────────────────────────────────────
// GET /api/notifications/count
// ─────────────────────────────────────────────

router.get('/count', auth, wrap(async (req, res) => {

  const isAdminOrAbove =
    ['admin','super_admin']
      .includes(req.user.role)

  let commitCount = 0

  if(isAdminOrAbove){

    const {rows}=await db.query(`
      SELECT COUNT(*) AS cnt
      FROM activity
      WHERE committed_at >= NOW() - INTERVAL '7 days'
    `)

    commitCount=
      parseInt(rows[0].cnt,10)

  }else{

    const {rows}=await db.query(`
      SELECT COUNT(*) AS cnt
      FROM activity a
      WHERE a.committed_at >= NOW() - INTERVAL '7 days'
        AND a.repo_id IN (
          SELECT repo_id
          FROM permissions
          WHERE
            (
              subject_type='user'
              AND subject_id=$1
            )
            OR
            (
              subject_type='group'
              AND subject_id IN (
                SELECT group_id
                FROM group_members
                WHERE user_id=$1
              )
            )
        )
    `,[req.user.id])

    commitCount=
      parseInt(rows[0].cnt,10)
  }

  let adminCount = 0

  if(isAdminOrAbove){

    const {rows}=await db.query(`
      SELECT COUNT(*) AS cnt
      FROM admin_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `)

    adminCount=
      parseInt(rows[0].cnt,10)
  }

  const total=
    commitCount + adminCount

  res.json({
    count:Math.min(total,99)
  })
}))

// ─────────────────────────────────────────────
// GET /api/notifications
// ─────────────────────────────────────────────

router.get('/', auth, wrap(async (req, res) => {

  const limit =
    Math.min(
      parseInt(req.query.limit) || 20,
      50
    )

  const offset =
    Math.max(
      parseInt(req.query.offset) || 0,
      0
    )

  const isAdminOrAbove =
    ['admin','super_admin']
      .includes(req.user.role)

  let commits=[]

  if(isAdminOrAbove){

    const {rows}=await db.query(`
      SELECT
        'commit'       AS type,
        a.id,
        a.author       AS actor,
        a.message      AS description,
        r.name         AS context,
        a.committed_at AS created_at,
        a.revision
      FROM activity a
      JOIN repositories r
        ON r.id=a.repo_id
      ORDER BY a.committed_at DESC
      LIMIT $1
    `,[limit + offset])

    commits=rows

  }else{

    const {rows}=await db.query(`
      SELECT
        'commit'       AS type,
        a.id,
        a.author       AS actor,
        a.message      AS description,
        r.name         AS context,
        a.committed_at AS created_at,
        a.revision
      FROM activity a
      JOIN repositories r
        ON r.id=a.repo_id
      WHERE a.repo_id IN (
        SELECT repo_id
        FROM permissions
        WHERE
          (
            subject_type='user'
            AND subject_id=$1
          )
          OR
          (
            subject_type='group'
            AND subject_id IN (
              SELECT group_id
              FROM group_members
              WHERE user_id=$1
            )
          )
      )
      ORDER BY a.committed_at DESC
      LIMIT $2
    `,[req.user.id,limit + offset])

    commits=rows
  }

  let adminEvents=[]

  if(isAdminOrAbove){

    const {rows}=await db.query(`
      SELECT
        'admin'      AS type,
        al.id,
        u.username   AS actor,
        al.action    AS description,
        al.entity    AS context,
        al.created_at,
        NULL::integer AS revision
      FROM admin_logs al
      LEFT JOIN users u
        ON u.id=al.user_id
      ORDER BY al.created_at DESC
      LIMIT $1
    `,[limit + offset])

    adminEvents=rows
  }

  const all=
    [...commits,...adminEvents]
      .sort(
        (a,b)=>
          new Date(b.created_at)
          - new Date(a.created_at)
      )

  const totalCount=
    all.length

  const page=
    all.slice(
      offset,
      offset + limit
    )

  res.json({
    total:totalCount,
    limit,
    offset,
    data:page,
  })
}))

// ─────────────────────────────────────────────
// POST /api/notifications/mark-read
// ─────────────────────────────────────────────

router.post(
  '/mark-read',
  auth,
  wrap(async(_req,res)=>{

    res.json({
      message:'Marked as read'
    })
  })
)

module.exports = router