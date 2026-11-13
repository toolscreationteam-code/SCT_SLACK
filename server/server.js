import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import pool from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads directory
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Public download directory for AVK Workspace Desktop Software (.exe)
const downloadDir = path.join(__dirname, '..', 'public', 'download');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}
app.use('/download', express.static(downloadDir));

// API Endpoints to download Windows Software
app.get('/api/download/desktop', (req, res) => {
  // Primary desktop download: Setup Installer with Desktop Shortcut
  const setupExe = path.join(downloadDir, 'AVK-Workspace-Setup.exe');
  const portableExe = path.join(downloadDir, 'AVK-Workspace-Portable.exe');
  const legacyExe = path.join(downloadDir, 'AVK-Workspace-Windows.exe');

  if (fs.existsSync(setupExe)) {
    return res.download(setupExe, 'AVK-Workspace-Setup.exe');
  } else if (fs.existsSync(portableExe)) {
    return res.download(portableExe, 'AVK-Workspace-Portable.exe');
  } else if (fs.existsSync(legacyExe)) {
    return res.download(legacyExe, 'AVK-Workspace-Windows.exe');
  }
  return res.status(404).json({ 
    error: 'Desktop application executable is being prepared. Please try again in a moment.' 
  });
});

app.get('/api/download/setup', (req, res) => {
  const setupExe = path.join(downloadDir, 'AVK-Workspace-Setup.exe');
  if (fs.existsSync(setupExe)) {
    return res.download(setupExe, 'AVK-Workspace-Setup.exe');
  }
  return res.status(404).json({ error: 'Installer is being prepared.' });
});

app.get('/api/download/portable', (req, res) => {
  const portableExe = path.join(downloadDir, 'AVK-Workspace-Portable.exe');
  if (fs.existsSync(portableExe)) {
    return res.download(portableExe, 'AVK-Workspace-Portable.exe');
  }
  return res.status(404).json({ error: 'Portable executable is being prepared.' });
});

// Multer storage for attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB
});

// Online users map: userId -> Set of socketIds (supports multi-device / multi-tab)
const onlineUsers = new Map();

// Helper: extract @mentions from text and dispatch in-app notifications
async function processMentionsAndNotify(channelId, senderId, content, messageId) {
  try {
    const [[sender]] = await pool.query('SELECT name FROM SCT_users WHERE id = ?', [senderId]);
    const [[channel]] = await pool.query('SELECT name, is_announcement, is_direct FROM SCT_channels WHERE id = ?', [channelId]);

    const [members] = await pool.query(
      'SELECT u.id, u.name, u.username FROM SCT_channel_members cm JOIN SCT_users u ON cm.user_id = u.id WHERE cm.channel_id = ?',
      [channelId]
    );

    const isAll = /@all\b/i.test(content) || channel?.is_announcement === 1;
    const isDirect = channel?.is_direct === 1;
    const mentionedUserIds = new Set();

    if (isDirect) {
      for (const m of members) {
        if (m.id !== senderId) mentionedUserIds.add(m.id);
      }
    } else if (isAll) {
      for (const m of members) {
        if (m.id !== senderId) mentionedUserIds.add(m.id);
      }
    } else {
      for (const m of members) {
        if (m.id !== senderId) {
          const regexName = new RegExp(`@${m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          const regexUser = m.username ? new RegExp(`@${m.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') : null;
          if (regexName.test(content) || (regexUser && regexUser.test(content))) {
            mentionedUserIds.add(m.id);
          }
        }
      }
    }

    const senderName = sender ? sender.name : 'Someone';
    const channelName = channel ? channel.name : 'chat';

    for (const userId of mentionedUserIds) {
      let noticeText = '';
      if (isDirect) {
        noticeText = `💬 New direct message from ${senderName}`;
      } else if (isAll && channel.is_announcement === 1) {
        noticeText = `📢 New announcement in #${channelName} by ${senderName}`;
      } else {
        noticeText = `@ ${senderName} mentioned you in #${channelName}`;
      }

      const [res] = await pool.query(
        'INSERT INTO SCT_notifications (user_id, channel_id, message_id, sender_id, content) VALUES (?, ?, ?, ?, ?)',
        [userId, channelId, messageId, senderId, noticeText]
      );

      const notificationData = {
        id: res.insertId,
        user_id: userId,
        channel_id: channelId,
        message_id: messageId,
        sender_id: senderId,
        sender_name: senderName,
        channel_name: channelName,
        content: noticeText,
        is_read: 0,
        created_at: new Date()
      };

      io.to(`user_${userId}`).emit('notification', notificationData);
    }
  } catch (err) {
    console.error('Error processing mentions:', err);
  }
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// 1. Health check & DB status
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ status: 'ok', db: 'connected', test: rows[0]?.test, time: new Date() });
  } catch (err) {
    console.error('DB Health Error:', err);
    res.status(500).json({ 
      status: 'error', 
      error: err.message || err.code || err.sqlMessage || String(err),
      code: err.code,
      sqlMessage: err.sqlMessage 
    });
  }
});

// Diagnostic DB connection tester
app.get('/api/test-db', async (req, res) => {
  const mysql = await import('mysql2/promise');
  const testHost = req.query.host || '91.108.107.40';
  const testUser = req.query.user || process.env.DB_USER || 'u339048620_stkreq';
  const testDb = req.query.db || process.env.DB_NAME || 'u339048620_stkreq';
  try {
    const conn = await mysql.default.createConnection({
      host: testHost,
      user: testUser,
      password: process.env.DB_PASSWORD || '8yc7zuc8z*A',
      database: testDb,
      port: 3306,
      connectTimeout: 5000
    });
    const [rows] = await conn.query('SELECT 1 as success');
    await conn.end();
    res.json({ success: true, host: testHost, user: testUser, db: testDb, rows });
  } catch(err) {
    res.status(500).json({ 
      success: false, 
      host: testHost, 
      user: testUser,
      error: err.message, 
      code: err.code 
    });
  }
});

// 2. Authentication: Password Login with 20-day session
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const trimmedInput = String(username).trim();
    const cleanPass = String(password).trim();

    // 1. Strict Priority: Exact username or exact name match (case-insensitive)
    // Note: 's112' (Khush Maharaj) and '112' (P Swayamprakashswami) are TWO DIFFERENT USERS.
    // They must NEVER be combined or confused with each other.
    let [matchedUsers] = await pool.query(
      `SELECT id, username, name, password, role, team_name, avatar 
       FROM SCT_users 
       WHERE LOWER(username) = LOWER(?) OR LOWER(name) = LOWER(?)`,
      [trimmedInput, trimmedInput]
    );

    // 2. Safe Fallback ONLY if NO exact match exists (e.g. user typed 120 instead of s120)
    if (matchedUsers.length === 0) {
      const withS = trimmedInput.toLowerCase().startsWith('s') ? trimmedInput : `s${trimmedInput}`;
      const [fallback] = await pool.query(
        `SELECT id, username, name, password, role, team_name, avatar 
         FROM SCT_users 
         WHERE LOWER(username) = LOWER(?)`,
        [withS]
      );
      if (fallback.length > 0) {
        matchedUsers = fallback;
      }
    }

    if (matchedUsers.length === 0) {
      return res.status(401).json({
        error: 'Invalid username. Please click your name on the right to auto-fill.'
      });
    }

    const targetUser = matchedUsers[0];
    const userPass = String(targetUser.password || '').trim();
    const targetUsername = String(targetUser.username || '').trim();

    // Validate password for this specific user
    const isPassValid =
      cleanPass === userPass ||
      cleanPass.toLowerCase() === userPass.toLowerCase() ||
      cleanPass === targetUsername ||
      cleanPass.toLowerCase() === targetUsername.toLowerCase() ||
      `s${cleanPass}` === userPass ||
      cleanPass.replace(/^[sS]/, '') === userPass;

    if (!isPassValid) {
      return res.status(401).json({
        error: 'Invalid password. Please check your credentials or click your name on the right.'
      });
    }

    const matchedUser = targetUser;

    // Query accessible workspaces for this user
    const isSuperAdmin = matchedUser.role === 'super_admin';
    let workspaces = [];
    if (isSuperAdmin) {
      const [allWs] = await pool.query(
        `SELECT w.*, 
                u.name as head_user_name,
                (SELECT COUNT(*) FROM SCT_workspace_members wm WHERE wm.workspace_id = w.id) as member_count,
                'super_admin' as my_role,
                COALESCE((SELECT is_default FROM SCT_workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = ?), 0) as is_default
         FROM SCT_workspaces w
         LEFT JOIN SCT_users u ON w.head_user_id = u.id
         ORDER BY w.id ASC`,
        [matchedUser.id]
      );
      workspaces = allWs;
    } else {
      const [userWs] = await pool.query(
        `SELECT w.*, 
                u.name as head_user_name,
                (SELECT COUNT(*) FROM SCT_workspace_members wm2 WHERE wm2.workspace_id = w.id) as member_count,
                wm.workspace_role as my_role,
                wm.is_default
         FROM SCT_workspaces w
         JOIN SCT_workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
         LEFT JOIN SCT_users u ON w.head_user_id = u.id
         ORDER BY wm.is_default DESC, w.id ASC`,
        [matchedUser.id]
      );
      workspaces = userWs;
    }

    const defaultWorkspace = workspaces.find((w) => w.is_default === 1) || workspaces[0] || null;

    // 20-day validity timestamp
    const expiresAt = Date.now() + 20 * 24 * 60 * 60 * 1000;
    const { password: _, ...userInfo } = matchedUser;

    res.json({
      user: userInfo,
      workspaces,
      defaultWorkspace,
      expiresAt,
      token: `sct_session_${matchedUser.id}_${Date.now()}`
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ 
      error: `Database connection error (${err.code || err.message || 'Timeout'}). Please check DB settings.` 
    });
  }
});

// 3. Get users (optionally filtered by workspace)
app.get('/api/users', async (req, res) => {
  try {
    const workspaceId = Number(req.query.workspaceId);
    const requesterId = Number(req.query.userId);
    let users;
    if (workspaceId) {
      if (!requesterId) return res.status(400).json({ error: 'userId is required when requesting workspace users' });
      const [[requester]] = await pool.query('SELECT role FROM SCT_users WHERE id = ?', [requesterId]);
      const [[membership]] = await pool.query(
        'SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?',
        [workspaceId, requesterId]
      );
      if (!requester || (requester.role !== 'super_admin' && !membership)) {
        return res.status(403).json({ error: 'You do not have access to this workspace' });
      }
      [users] = await pool.query(
        `SELECT u.id, u.username, u.name, u.avatar, u.created_at,
                wm.workspace_role as role,
                COALESCE(wm.team_name, u.team_name) as team_name,
                wm.is_default
         FROM SCT_users u
         JOIN SCT_workspace_members wm ON u.id = wm.user_id AND wm.workspace_id = ?
         ORDER BY u.id ASC`,
        [workspaceId]
      );
    } else {
      [users] = await pool.query(
        'SELECT id, username, name, role, team_name, avatar, created_at FROM SCT_users ORDER BY id ASC'
      );
    }
    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: `Database error (${err.code || err.message || 'Timeout'})` });
  }
});

// Real-time online users list endpoint
app.get('/api/online-users', (req, res) => {
  res.json(Array.from(onlineUsers.keys()));
});

// ============================================================
// WORKSPACE MANAGEMENT ROUTES
// ============================================================

// 3.1 Get workspaces for user
app.get('/api/workspaces', async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const [[user]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSuperAdmin = user.role === 'super_admin';
    let workspaces = [];

    if (isSuperAdmin) {
      const [allWs] = await pool.query(
        `SELECT w.*, 
                u.name as head_user_name,
                (SELECT COUNT(*) FROM SCT_workspace_members wm WHERE wm.workspace_id = w.id) as member_count,
                (SELECT COUNT(*) FROM SCT_channels c WHERE c.workspace_id = w.id AND c.is_direct = 0) as channel_count,
                'super_admin' as my_role,
                COALESCE((SELECT is_default FROM SCT_workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = ?), 0) as is_default
         FROM SCT_workspaces w
         LEFT JOIN SCT_users u ON w.head_user_id = u.id
         ORDER BY w.id ASC`,
        [userId]
      );
      workspaces = allWs;
    } else {
      const [userWs] = await pool.query(
        `SELECT w.*, 
                u.name as head_user_name,
                (SELECT COUNT(*) FROM SCT_workspace_members wm2 WHERE wm2.workspace_id = w.id) as member_count,
                (SELECT COUNT(*) FROM SCT_channels c WHERE c.workspace_id = w.id AND c.is_direct = 0) as channel_count,
                wm.workspace_role as my_role,
                wm.is_default
         FROM SCT_workspaces w
         JOIN SCT_workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
         LEFT JOIN SCT_users u ON w.head_user_id = u.id
         ORDER BY wm.is_default DESC, w.id ASC`,
        [userId]
      );
      workspaces = userWs;
    }

    res.json(workspaces);
  } catch (err) {
    console.error('Fetch workspaces error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3.2 Create new workspace (Super Admin only)
app.post('/api/workspaces', async (req, res) => {
  try {
    const { name, slug, icon, description, head_user_id, requested_by } = req.body;
    if (!name || !requested_by) {
      return res.status(400).json({ error: 'Workspace name and requested_by are required' });
    }

    const [[admin]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requested_by]);
    if (!admin || admin.role !== 'super_admin' || admin.username !== '002') {
      return res.status(403).json({ error: 'Only the Master Admin can create workspaces' });
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');

    const cleanIcon = (icon || name.slice(0, 3)).trim().toUpperCase();

    const [wsResult] = await pool.query(
      `INSERT INTO SCT_workspaces (name, slug, icon, description, head_user_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), cleanSlug, cleanIcon, description || '', head_user_id || null, requested_by]
    );

    const workspaceId = wsResult.insertId;

    // If head_user_id is different, add as workspace_head
    if (head_user_id && head_user_id !== requested_by) {
      await pool.query(
        `INSERT INTO SCT_workspace_members (workspace_id, user_id, workspace_role, team_name, is_default)
         VALUES (?, ?, 'workspace_head', 'Lead', 0)
         ON DUPLICATE KEY UPDATE workspace_role = 'workspace_head'`,
        [workspaceId, head_user_id]
      );
    }

    const [[newWorkspace]] = await pool.query('SELECT * FROM SCT_workspaces WHERE id = ?', [workspaceId]);
    io.emit('workspace_created', newWorkspace);
    res.status(201).json(newWorkspace);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A workspace with this slug/name already exists.' });
    }
    console.error('Create workspace error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3.3 Edit workspace
app.put('/api/workspaces/:id', async (req, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const { name, icon, description, head_user_id, requested_by } = req.body;

    const [[admin]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requested_by]);
    if (!admin || admin.role !== 'super_admin' || admin.username !== '002') {
      return res.status(403).json({ error: 'Only the Master Admin can edit workspace settings' });
    }

    const updates = [];
    const params = [];
    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (icon) { updates.push('icon = ?'); params.push(icon.trim().toUpperCase()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (head_user_id !== undefined) { updates.push('head_user_id = ?'); params.push(head_user_id || null); }

    if (updates.length > 0) {
      params.push(workspaceId);
      await pool.query(`UPDATE SCT_workspaces SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (head_user_id) {
      await pool.query(
        "UPDATE SCT_workspace_members SET workspace_role = 'member' WHERE workspace_id = ? AND workspace_role = 'workspace_head' AND user_id <> ?",
        [workspaceId, head_user_id]
      );
      await pool.query(
        `INSERT INTO SCT_workspace_members (workspace_id, user_id, workspace_role, team_name, is_default)
         VALUES (?, ?, 'workspace_head', 'Lead', 0)
         ON DUPLICATE KEY UPDATE workspace_role = 'workspace_head'`,
        [workspaceId, head_user_id]
      );
    } else if (head_user_id !== undefined) {
      await pool.query("UPDATE SCT_workspace_members SET workspace_role = 'member' WHERE workspace_id = ? AND workspace_role = 'workspace_head'", [workspaceId]);
    }

    const [[updated]] = await pool.query('SELECT * FROM SCT_workspaces WHERE id = ?', [workspaceId]);
    io.emit('workspace_updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.4 Delete workspace (Super Admin only; keep at least one workspace)
app.delete('/api/workspaces/:id', async (req, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const requestedBy = Number(req.query.requestedBy);

    const [[admin]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requestedBy]);
    if (!admin || admin.role !== 'super_admin' || admin.username !== '002') {
      return res.status(403).json({ error: 'Only the Master Admin can delete workspaces' });
    }

    const [[{ workspaceCount }]] = await pool.query('SELECT COUNT(*) AS workspaceCount FROM SCT_workspaces');
    if (workspaceCount <= 1) {
      return res.status(400).json({ error: 'At least one workspace must remain.' });
    }

    await pool.query('DELETE FROM SCT_workspaces WHERE id = ?', [workspaceId]);
    io.emit('workspace_deleted', { workspaceId });
    res.json({ success: true, workspaceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.5 Get workspace members
app.get('/api/workspaces/:id/members', async (req, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const requesterId = Number(req.query.userId);
    const [[requester]] = await pool.query('SELECT role FROM SCT_users WHERE id = ?', [requesterId]);
    const [[membership]] = await pool.query(
      'SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, requesterId]
    );
    if (!requester || (requester.role !== 'super_admin' && !membership)) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }
    const [members] = await pool.query(
      `SELECT u.id, u.username, u.name, u.avatar,
              wm.workspace_role, wm.team_name, wm.is_default, wm.joined_at
       FROM SCT_workspace_members wm
       JOIN SCT_users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ?
       ORDER BY FIELD(wm.workspace_role, 'super_admin', 'workspace_head', 'team_leader', 'member'), u.name ASC`,
      [workspaceId]
    );
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.6 Add or update member in workspace
app.post('/api/workspaces/:id/members', async (req, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const { user_id, workspace_role, team_name, requested_by } = req.body;

    const [[admin]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requested_by]);
    const [[wsMember]] = await pool.query(
      'SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, requested_by]
    );

    const isSuperAdmin = admin?.role === 'super_admin' && admin.username === '002';
    const isWorkspaceHead = wsMember?.workspace_role === 'workspace_head';
    const isAuthorized = isSuperAdmin || isWorkspaceHead;

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only Super Admin or Workspace Head can add members' });
    }

    const requestedRole = workspace_role || 'member';
    if (!['member', 'team_leader', 'workspace_head'].includes(requestedRole)) {
      return res.status(400).json({ error: 'Invalid workspace role' });
    }
    if (!isSuperAdmin && requestedRole === 'workspace_head') {
      return res.status(403).json({ error: 'Only Master Admin can assign a workspace leader role' });
    }

    const [[targetWorkspace]] = await pool.query('SELECT name FROM SCT_workspaces WHERE id = ?', [workspaceId]);
    if (!targetWorkspace) return res.status(404).json({ error: 'Workspace not found' });

    if (requestedRole === 'workspace_head') {
      await pool.query(
        "UPDATE SCT_workspace_members SET workspace_role = 'member' WHERE workspace_id = ? AND workspace_role = 'workspace_head' AND user_id <> ?",
        [workspaceId, user_id]
      );
      await pool.query('UPDATE SCT_workspaces SET head_user_id = ? WHERE id = ?', [user_id, workspaceId]);
    } else {
      await pool.query('UPDATE SCT_workspaces SET head_user_id = NULL WHERE id = ? AND head_user_id = ?', [workspaceId, user_id]);
    }

    await pool.query(
      `INSERT INTO SCT_workspace_members (workspace_id, user_id, workspace_role, team_name, is_default)
       VALUES (?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE workspace_role = VALUES(workspace_role), team_name = VALUES(team_name)`,
      [workspaceId, user_id, requestedRole, team_name || targetWorkspace.name]
    );

    io.emit('workspace_member_updated', { workspaceId, userId: user_id });
    const [[workspace]] = await pool.query('SELECT * FROM SCT_workspaces WHERE id = ?', [workspaceId]);
    res.json({ success: true, workspaceId, userId: user_id, workspace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.7 Remove member from workspace
app.delete('/api/workspaces/:id/members/:userId', async (req, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const requestedBy = Number(req.query.requestedBy);

    const [[admin]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requestedBy]);
    const [[wsMember]] = await pool.query(
      'SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, requestedBy]
    );

    const isAuthorized = (admin?.role === 'super_admin' && admin.username === '002') || (wsMember && wsMember.workspace_role === 'workspace_head');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only Super Admin or Workspace Head can remove members' });
    }

    const [[targetMembership]] = await pool.query(
      'SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, targetUserId]
    );
    if (!(admin?.role === 'super_admin' && admin.username === '002') && targetMembership?.workspace_role === 'workspace_head') {
      return res.status(403).json({ error: 'Only the Master Admin can remove a Workspace Leader' });
    }

    await pool.query('DELETE FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [workspaceId, targetUserId]);
    await pool.query(
      `DELETE cm FROM SCT_channel_members cm
       JOIN SCT_channels c ON c.id = cm.channel_id
       WHERE c.workspace_id = ? AND cm.user_id = ?`,
      [workspaceId, targetUserId]
    );
    io.emit('workspace_member_removed', { workspaceId, userId: targetUserId });
    res.json({ success: true, workspaceId, userId: targetUserId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.8 Set workspace as default for user
app.post('/api/workspaces/:id/set-default', async (req, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const userId = Number(req.body.user_id || req.body.userId);
    const [[user]] = await pool.query('SELECT role FROM SCT_users WHERE id = ?', [userId]);
    const [[membership]] = await pool.query('SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [workspaceId, userId]);
    if (!user || (user.role !== 'super_admin' && !membership)) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }

    await pool.query('UPDATE SCT_workspace_members SET is_default = 0 WHERE user_id = ?', [userId]);
    await pool.query('UPDATE SCT_workspace_members SET is_default = 1 WHERE workspace_id = ? AND user_id = ?', [workspaceId, userId]);

    res.json({ success: true, defaultWorkspaceId: workspaceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get channels & DMs for a user (with persistent unread counts)
app.get('/api/channels', async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const workspaceId = Number(req.query.workspaceId) || 1;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const [[user]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Master Admin administers all workspaces but is not a chat participant.
    if (user.role === 'super_admin' && user.username === '002') return res.json([]);

    const isSuperAdmin = user.role === 'super_admin';
    if (!isSuperAdmin) {
      const [[membership]] = await pool.query(
        'SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?',
        [workspaceId, userId]
      );
      if (!membership) return res.status(403).json({ error: 'You do not have access to this workspace' });
    }
    let query = '';
    let params = [];

    if (isSuperAdmin) {
      // Super Admin sees all normal channels of this workspace AND their own DMs
      query = `
        SELECT c.*, 
          COUNT(DISTINCT cm.user_id) as member_count,
          1 as is_member,
          COALESCE(cm_user.last_read_message_id, 0) as last_read_message_id,
          (
            SELECT COUNT(*)
            FROM SCT_messages m
            WHERE m.channel_id = c.id
              AND m.id > COALESCE(cm_user.last_read_message_id, 0)
              AND m.user_id != ?
          ) as unread_count
        FROM SCT_channels c
        LEFT JOIN SCT_channel_members cm ON c.id = cm.channel_id
        LEFT JOIN SCT_channel_members cm_user ON c.id = cm_user.channel_id AND cm_user.user_id = ?
        WHERE (c.is_direct = 0 AND (c.workspace_id = ? OR c.workspace_id IS NULL))
           OR (c.is_direct = 1 AND EXISTS (SELECT 1 FROM SCT_channel_members WHERE channel_id = c.id AND user_id = ?))
        GROUP BY c.id, cm_user.last_read_message_id
        ORDER BY c.is_announcement DESC, c.is_direct ASC, c.id ASC
      `;
      params = [userId, userId, workspaceId, userId];
    } else {
      // Members and Leaders see assigned channels in this workspace & their own DMs
      query = `
        SELECT c.*, 
          COUNT(DISTINCT cm2.user_id) as member_count,
          1 as is_member,
          COALESCE(cm.last_read_message_id, 0) as last_read_message_id,
          (
            SELECT COUNT(*)
            FROM SCT_messages m
            WHERE m.channel_id = c.id
              AND m.id > COALESCE(cm.last_read_message_id, 0)
              AND m.user_id != ?
          ) as unread_count
        FROM SCT_channels c
        JOIN SCT_channel_members cm ON c.id = cm.channel_id AND cm.user_id = ?
        LEFT JOIN SCT_channel_members cm2 ON c.id = cm2.channel_id
        WHERE (c.is_direct = 0 AND (c.workspace_id = ? OR c.workspace_id IS NULL))
           OR (c.is_direct = 1)
        GROUP BY c.id, cm.last_read_message_id
        ORDER BY c.is_announcement DESC, c.is_direct ASC, c.id ASC
      `;
      params = [userId, userId, workspaceId];
    }

    const [channels] = await pool.query(query, params);

    for (const chan of channels) {
      if (chan.is_direct === 1) {
        const [[otherUser]] = await pool.query(
          `SELECT u.id, u.username, u.name, u.role, u.team_name, u.avatar
           FROM SCT_channel_members cm
           JOIN SCT_users u ON cm.user_id = u.id
           WHERE cm.channel_id = ? AND cm.user_id != ?
           LIMIT 1`,
          [chan.id, userId]
        );
        chan.dm_user = otherUser || null;
      }
    }

    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4.1 Mark channel / DM as read (Clear unread badge and persist in database)
app.post('/api/channels/:channelId/read', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const userId = Number(req.body.user_id);
    let messageId = req.body.message_id ? Number(req.body.message_id) : null;

    if (!channelId || !userId) {
      return res.status(400).json({ error: 'channelId and user_id are required' });
    }

    if (!messageId) {
      const [[maxMsg]] = await pool.query(
        'SELECT COALESCE(MAX(id), 0) as max_id FROM SCT_messages WHERE channel_id = ?',
        [channelId]
      );
      messageId = maxMsg ? maxMsg.max_id : 0;
    }

    // Persist last_read_message_id and last_read_at for this user & channel
    await pool.query(
      `INSERT INTO SCT_channel_members (channel_id, user_id, last_read_message_id, last_read_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         last_read_message_id = GREATEST(last_read_message_id, VALUES(last_read_message_id)),
         last_read_at = NOW()`,
      [channelId, userId, messageId]
    );

    const [[userRow]] = await pool.query('SELECT name, avatar, role FROM SCT_users WHERE id = ?', [userId]);
    const userName = userRow ? userRow.name : 'A member';
    const readAt = new Date().toISOString();

    // Sync across user's open browser tabs / devices in real time
    io.to(`user_${userId}`).emit('channel_marked_read', {
      channelId,
      lastReadMessageId: messageId
    });

    // Broadcast to channel so sender immediately sees Blue Double Ticks!
    io.to(`channel_${channelId}`).emit('messages_read', {
      channelId,
      userId,
      userName,
      avatar: userRow?.avatar,
      userRole: userRow?.role,
      lastReadMessageId: messageId,
      readAt
    });

    res.json({ success: true, channelId, lastReadMessageId: messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get or Create Direct Message (DM)
app.post('/api/dm/get-or-create', async (req, res) => {
  try {
    const { userId1, userId2, workspaceId } = req.body;
    const targetWorkspaceId = Number(workspaceId);
    if (!userId1 || !userId2 || !targetWorkspaceId) {
      return res.status(400).json({ error: 'Both user IDs and workspaceId are required for DM' });
    }

    const [[sender]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [userId1]);
    if (sender?.role === 'super_admin' && sender.username === '002') {
      return res.status(403).json({ error: 'Master Admin is limited to administration and settings.' });
    }
    const [[senderMembership]] = await pool.query('SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [targetWorkspaceId, userId1]);
    const [[recipientMembership]] = await pool.query('SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [targetWorkspaceId, userId2]);
    if (!sender || (!senderMembership && sender.role !== 'super_admin') || !recipientMembership) {
      return res.status(403).json({ error: 'Direct messages are available only to people in this workspace' });
    }

    const [existing] = await pool.query(
      `SELECT c.* FROM SCT_channels c
       JOIN SCT_channel_members cm1 ON c.id = cm1.channel_id AND cm1.user_id = ?
       JOIN SCT_channel_members cm2 ON c.id = cm2.channel_id AND cm2.user_id = ?
       WHERE c.is_direct = 1 AND c.workspace_id = ?
       LIMIT 1`,
      [userId1, userId2, targetWorkspaceId]
    );

    if (existing.length > 0) {
      const channel = existing[0];
      const [[otherUser]] = await pool.query(
        'SELECT id, username, name, role, team_name, avatar FROM SCT_users WHERE id = ?',
        [userId2]
      );
      channel.dm_user = otherUser;
      return res.json(channel);
    }

    const minId = Math.min(userId1, userId2);
    const maxId = Math.max(userId1, userId2);
    const dmName = `dm_${minId}_${maxId}`;

    const [ins] = await pool.query(
      'INSERT INTO SCT_channels (workspace_id, name, description, is_announcement, is_global_announcement, is_direct, post_permission, created_by) VALUES (?, ?, ?, 0, 0, 1, \'all\', ?)',
      [targetWorkspaceId, dmName, 'Direct Message', userId1]
    );
    const newChannelId = ins.insertId;

    await pool.query('INSERT INTO SCT_channel_members (channel_id, user_id) VALUES (?, ?), (?, ?)', [
      newChannelId,
      userId1,
      newChannelId,
      userId2
    ]);

    const [[newChannel]] = await pool.query('SELECT * FROM SCT_channels WHERE id = ?', [newChannelId]);
    const [[otherUser]] = await pool.query(
      'SELECT id, username, name, role, team_name, avatar FROM SCT_users WHERE id = ?',
      [userId2]
    );
    newChannel.dm_user = otherUser;

    io.to(`user_${userId1}`).emit('channel_created', newChannel);
    io.to(`user_${userId2}`).emit('channel_created', newChannel);

    res.status(201).json(newChannel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Create channel
app.post('/api/channels', async (req, res) => {
  try {
    const { name, description, is_announcement, post_permission, created_by, member_ids, workspace_id, team_leader_id } = req.body;
    if (!name || !created_by) {
      return res.status(400).json({ error: 'Channel name and creator are required' });
    }

    const targetWsId = Number(workspace_id) || 1;
    const [[creator]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [created_by]);
    const [[wsMember]] = await pool.query(
      'SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?',
      [targetWsId, created_by]
    );

    const isAuthorized = wsMember?.workspace_role === 'workspace_head';

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the Workspace Leader can create teams or channels' });
    }

    const cleanName = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
    const permission = is_announcement ? 'admin_only' : (post_permission || 'all');

    let teamLeaderId = Number(team_leader_id) || null;
    if (teamLeaderId) {
      const [[teamLeader]] = await pool.query('SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [targetWsId, teamLeaderId]);
      if (!teamLeader) return res.status(400).json({ error: 'Team leader must belong to this workspace' });
      await pool.query("UPDATE SCT_workspace_members SET workspace_role = 'team_leader' WHERE workspace_id = ? AND user_id = ?", [targetWsId, teamLeaderId]);
    }
    const [insertResult] = await pool.query(
      'INSERT INTO SCT_channels (workspace_id, name, description, is_announcement, is_global_announcement, is_direct, post_permission, created_by, leader_user_id) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)',
      [targetWsId, cleanName, description || '', is_announcement ? 1 : 0, permission, created_by, teamLeaderId]
    );
    const channelId = insertResult.insertId;

    await pool.query('INSERT IGNORE INTO SCT_channel_members (channel_id, user_id) VALUES (?, ?)', [channelId, created_by]);

    if (teamLeaderId) {
      await pool.query('INSERT IGNORE INTO SCT_channel_members (channel_id, user_id) VALUES (?, ?)', [channelId, teamLeaderId]);
    }

    if (is_announcement) {
      // Local announcements are readable by every workspace member, but posting is
      // restricted below to the workspace leadership and channel creator.
      await pool.query(
        'INSERT IGNORE INTO SCT_channel_members (channel_id, user_id) SELECT ?, user_id FROM SCT_workspace_members WHERE workspace_id = ?',
        [channelId, targetWsId]
      );
    } else if (Array.isArray(member_ids)) {
      for (const mId of member_ids) {
        const [[member]] = await pool.query('SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [targetWsId, mId]);
        if (member) await pool.query('INSERT IGNORE INTO SCT_channel_members (channel_id, user_id) VALUES (?, ?)', [channelId, mId]);
      }
    }

    const [[newChannel]] = await pool.query('SELECT * FROM SCT_channels WHERE id = ?', [channelId]);
    io.emit('channel_created', newChannel);
    res.status(201).json(newChannel);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A channel with this name already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 7. Edit Channel Details (Name, Description, Post Permission) - Admin / Creator
app.put('/api/channels/:channelId', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const { requested_by, name, description, post_permission } = req.body;

    const [[user]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requested_by]);
    const [[channel]] = await pool.query('SELECT * FROM SCT_channels WHERE id = ?', [channelId]);

    if (!user || !channel) {
      return res.status(404).json({ error: 'User or channel not found' });
    }

    const [[workspaceMember]] = await pool.query('SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [channel.workspace_id, requested_by]);
    // A workspace leader manages every channel in their workspace. A team leader
    // is deliberately limited to member assignment only.
    if (workspaceMember?.workspace_role !== 'workspace_head' && channel.created_by !== requested_by) {
      return res.status(403).json({ error: 'Only the Workspace Leader or channel creator can edit this channel.' });
    }

    const updates = [];
    const params = [];

    if (name) {
      const cleanName = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
      updates.push('name = ?');
      params.push(cleanName);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description.trim());
    }
    if (post_permission) {
      updates.push('post_permission = ?');
      params.push(post_permission);
    }

    if (updates.length > 0) {
      params.push(channelId);
      await pool.query(`UPDATE SCT_channels SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [[updatedChannel]] = await pool.query('SELECT * FROM SCT_channels WHERE id = ?', [channelId]);
    io.emit('channel_updated', updatedChannel);
    res.json(updatedChannel);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A channel with this name already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 8. Delete Channel (Admin only, cannot delete default channels)
app.delete('/api/channels/:channelId', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const requestedBy = Number(req.query.requestedBy);

    const [[user]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requestedBy]);
    const [[channel]] = await pool.query('SELECT name, workspace_id FROM SCT_channels WHERE id = ?', [channelId]);
    const [[workspaceMember]] = channel ? await pool.query('SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [channel.workspace_id, requestedBy]) : [[]];
    if (!user || workspaceMember?.workspace_role !== 'workspace_head') {
      return res.status(403).json({ error: 'Only the Workspace Leader can delete channels.' });
    }
    if (channel?.name === 'announcements' || channel?.name === 'general') {
      return res.status(400).json({ error: 'Default channels cannot be deleted.' });
    }

    await pool.query('DELETE FROM SCT_channels WHERE id = ?', [channelId]);
    io.emit('channel_deleted', { channelId });
    res.json({ success: true, channelId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Update channel post permission shortcut
app.put('/api/channels/:channelId/permissions', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const { post_permission, requested_by } = req.body;

    const [[user]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requested_by]);
    const [[channel]] = await pool.query('SELECT workspace_id FROM SCT_channels WHERE id = ?', [channelId]);
    const [[workspaceMember]] = channel ? await pool.query('SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [channel.workspace_id, requested_by]) : [[]];
    if (!user || workspaceMember?.workspace_role !== 'workspace_head') {
      return res.status(403).json({ error: 'Only the Workspace Leader can change channel permissions.' });
    }

    await pool.query('UPDATE SCT_channels SET post_permission = ? WHERE id = ?', [post_permission, channelId]);
    io.emit('channel_updated', { id: channelId, post_permission });
    res.json({ success: true, post_permission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Get channel members
app.get('/api/channels/:channelId/members', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const requesterId = Number(req.query.userId);
    const [[channel]] = await pool.query('SELECT workspace_id, is_direct FROM SCT_channels WHERE id = ?', [channelId]);
    const [[requester]] = await pool.query('SELECT role FROM SCT_users WHERE id = ?', [requesterId]);
    const [[channelMembership]] = await pool.query('SELECT 1 AS membership FROM SCT_channel_members WHERE channel_id = ? AND user_id = ?', [channelId, requesterId]);
    if (!channel || !requester || (!channelMembership && !(requester.role === 'super_admin' && channel.is_direct === 0))) {
      return res.status(403).json({ error: 'You do not have access to this channel' });
    }
    const [members] = await pool.query(
      `SELECT u.id, u.username, u.name, u.role, u.team_name, u.avatar, cm.joined_at
       FROM SCT_channel_members cm
       JOIN SCT_users u ON cm.user_id = u.id
       WHERE cm.channel_id = ?
       ORDER BY u.id ASC`,
      [channelId]
    );
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Add member to channel
app.post('/api/channels/:channelId/members', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const { user_id, requested_by } = req.body;

    const [[requester]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requested_by]);
    const [[channel]] = await pool.query('SELECT workspace_id, leader_user_id FROM SCT_channels WHERE id = ?', [channelId]);
    const [[workspaceMember]] = channel ? await pool.query('SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [channel.workspace_id, requested_by]) : [[]];
    const canManage = workspaceMember?.workspace_role === 'workspace_head' || Number(channel?.leader_user_id) === Number(requested_by);
    if (!canManage) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const [[targetMember]] = await pool.query('SELECT id FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [channel.workspace_id, user_id]);
    if (!targetMember) return res.status(400).json({ error: 'Member must belong to this workspace' });

    await pool.query('INSERT IGNORE INTO SCT_channel_members (channel_id, user_id) VALUES (?, ?)', [channelId, user_id]);
    io.emit('member_updated', { channelId, user_id, action: 'added' });
    res.json({ success: true, message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Remove member from channel
app.delete('/api/channels/:channelId/members/:userId', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const targetUserId = Number(req.params.userId);
    const requestedBy = Number(req.query.requestedBy);

    const [[requester]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requestedBy]);
    const [[channel]] = await pool.query('SELECT workspace_id, leader_user_id FROM SCT_channels WHERE id = ?', [channelId]);
    const [[workspaceMember]] = channel ? await pool.query('SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?', [channel.workspace_id, requestedBy]) : [[]];
    const canManage = workspaceMember?.workspace_role === 'workspace_head' || Number(channel?.leader_user_id) === Number(requestedBy);
    if (!canManage) {
      return res.status(403).json({ error: 'Only the workspace or team leader can remove members' });
    }

    await pool.query('DELETE FROM SCT_channel_members WHERE channel_id = ? AND user_id = ?', [channelId, targetUserId]);
    io.emit('member_updated', { channelId, user_id: targetUserId, action: 'removed' });
    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: get grouped reactions for a message
async function getMessageReactions(messageId) {
  const [rows] = await pool.query(
    `SELECT r.emoji, r.user_id, r.created_at, u.name as user_name, u.avatar, u.role as user_role
     FROM SCT_message_reactions r
     JOIN SCT_users u ON r.user_id = u.id
     WHERE r.message_id = ?
     ORDER BY r.created_at ASC`,
    [messageId]
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.emoji]) {
      map[r.emoji] = { emoji: r.emoji, count: 0, users: [], user_names: [], users_detail: [] };
    }
    map[r.emoji].count += 1;
    map[r.emoji].users.push(r.user_id);
    map[r.emoji].user_names.push(r.user_name);
    map[r.emoji].users_detail.push({
      user_id: r.user_id,
      user_name: r.user_name,
      avatar: r.avatar,
      user_role: r.user_role,
      created_at: r.created_at
    });
  }
  return Object.values(map);
}

// 13. Get messages of a channel / DM
app.get('/api/channels/:channelId/messages', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const userId = Number(req.query.userId);
    const [[channel]] = await pool.query('SELECT workspace_id, is_direct FROM SCT_channels WHERE id = ?', [channelId]);
    const [[user]] = await pool.query('SELECT role FROM SCT_users WHERE id = ?', [userId]);
    const [[membership]] = await pool.query('SELECT 1 AS membership FROM SCT_channel_members WHERE channel_id = ? AND user_id = ?', [channelId, userId]);
    if (!channel || !user || (!membership && !(user.role === 'super_admin' && channel.is_direct === 0))) {
      return res.status(403).json({ error: 'You do not have access to this channel' });
    }
    const [messages] = await pool.query(
      `SELECT m.*, u.username, u.name as user_name, u.role as user_role, u.team_name, u.avatar
       FROM SCT_messages m
       JOIN SCT_users u ON m.user_id = u.id
       WHERE m.channel_id = ?
       ORDER BY m.created_at ASC
       LIMIT 300`,
      [channelId]
    );

    if (messages.length === 0) {
      return res.json([]);
    }

    // Fetch channel members and their last_read_message_id for read receipts
    const [channelMembers] = await pool.query(
      `SELECT cm.user_id, cm.last_read_message_id, cm.last_read_at, u.name as user_name, u.avatar, u.role as user_role
       FROM SCT_channel_members cm
       JOIN SCT_users u ON cm.user_id = u.id
       WHERE cm.channel_id = ?`,
      [channelId]
    );

    // Fetch all reactions for these messages with full user detail
    const messageIds = messages.map((m) => m.id);
    const [rawReactions] = await pool.query(
      `SELECT r.message_id, r.user_id, r.emoji, r.created_at, u.name as user_name, u.avatar, u.role as user_role
       FROM SCT_message_reactions r
       JOIN SCT_users u ON r.user_id = u.id
       WHERE r.message_id IN (?)
       ORDER BY r.created_at ASC`,
      [messageIds]
    );

    // Group reactions by message_id and emoji
    const reactionsByMessage = {};
    for (const r of rawReactions) {
      if (!reactionsByMessage[r.message_id]) {
        reactionsByMessage[r.message_id] = {};
      }
      if (!reactionsByMessage[r.message_id][r.emoji]) {
        reactionsByMessage[r.message_id][r.emoji] = {
          emoji: r.emoji,
          count: 0,
          users: [],
          user_names: [],
          users_detail: []
        };
      }
      reactionsByMessage[r.message_id][r.emoji].count += 1;
      reactionsByMessage[r.message_id][r.emoji].users.push(r.user_id);
      reactionsByMessage[r.message_id][r.emoji].user_names.push(r.user_name);
      reactionsByMessage[r.message_id][r.emoji].users_detail.push({
        user_id: r.user_id,
        user_name: r.user_name,
        avatar: r.avatar,
        user_role: r.user_role,
        created_at: r.created_at
      });
    }

    const messagesWithReactionsAndReads = messages.map((m) => {
      const otherMembers = channelMembers.filter((cm) => cm.user_id !== m.user_id);
      const readByMembers = otherMembers.filter((cm) => cm.last_read_message_id >= m.id);
      const isReadAll = otherMembers.length > 0 && readByMembers.length === otherMembers.length;
      const isRead = otherMembers.length > 0 && readByMembers.length > 0;

      return {
        ...m,
        reactions: reactionsByMessage[m.id] ? Object.values(reactionsByMessage[m.id]) : [],
        read_by: readByMembers.map((cm) => ({
          user_id: cm.user_id,
          user_name: cm.user_name,
          avatar: cm.avatar,
          user_role: cm.user_role,
          read_at: cm.last_read_at
        })),
        delivered_to: otherMembers.map((cm) => ({
          user_id: cm.user_id,
          user_name: cm.user_name,
          avatar: cm.avatar,
          user_role: cm.user_role
        })),
        is_read: isRead,
        is_read_all: isReadAll
      };
    });

    res.json(messagesWithReactionsAndReads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Send message
app.post('/api/channels/:channelId/messages', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const { user_id, content, file_url, file_name, file_type, drive_link } = req.body;

    if (!user_id || (!content && !file_url && !drive_link)) {
      return res.status(400).json({ error: 'Message content or attachment is required.' });
    }

    const [[user]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [user_id]);
    const [[channel]] = await pool.query('SELECT post_permission, name, workspace_id, is_announcement, is_direct, created_by FROM SCT_channels WHERE id = ?', [channelId]);

    if (!user || !channel) {
      return res.status(404).json({ error: 'User or channel not found' });
    }

    if (user.role === 'super_admin' && user.username === '002') {
      return res.status(403).json({ error: 'Master Admin is limited to administration and settings.' });
    }

    const isSuperAdmin = user.role === 'super_admin';
    const [[workspaceMembership]] = await pool.query(
      'SELECT workspace_role FROM SCT_workspace_members WHERE workspace_id = ? AND user_id = ?',
      [channel.workspace_id, user_id]
    );
    const [[channelMembership]] = await pool.query(
      'SELECT 1 AS membership FROM SCT_channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, user_id]
    );
    if (!channelMembership && !(isSuperAdmin && channel.is_direct === 0)) {
      return res.status(403).json({ error: 'You are not a member of this channel.' });
    }

    const isWorkspaceLeader = ['workspace_head', 'team_leader'].includes(workspaceMembership?.workspace_role);
    const canPostAnnouncement = isSuperAdmin || isWorkspaceLeader || Number(channel.created_by) === Number(user_id);

    if (channel.post_permission === 'admin_only' && !canPostAnnouncement) {
      return res.status(403).json({
        error: '🔒 Only the workspace leader or Super Admin can post in this announcement channel.'
      });
    }

    if (channel.post_permission === 'leaders_only' && !canPostAnnouncement) {
      return res.status(403).json({
        error: '🔒 Only Super Admin, Workspace Head and Team Leaders can post in this channel.'
      });
    }

    let finalContent = content || '';
    if (drive_link) {
      finalContent = finalContent ? `${finalContent}\n${drive_link}` : drive_link;
    }

    const [insertRes] = await pool.query(
      `INSERT INTO SCT_messages (channel_id, user_id, content, file_url, file_name, file_type, is_global_broadcast)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [channelId, user_id, finalContent, file_url || null, file_name || null, file_type || null, 0]
    );

    const messageId = insertRes.insertId;

    const [[fullMessage]] = await pool.query(
      `SELECT m.*, u.username, u.name as user_name, u.role as user_role, u.team_name, u.avatar
       FROM SCT_messages m
       JOIN SCT_users u ON m.user_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    fullMessage.is_direct = channel.is_direct;
    fullMessage.channel_name = channel.name;
    fullMessage.reactions = [];

    // Sender automatically marks their own sent message as read
    await pool.query(
      `INSERT INTO SCT_channel_members (channel_id, user_id, last_read_message_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE last_read_message_id = GREATEST(last_read_message_id, VALUES(last_read_message_id))`,
      [channelId, user_id, messageId]
    );

    // Broadcast to the current channel room
    io.to(`channel_${channelId}`).emit('new_message', fullMessage);

    // Also notify all member user rooms so unread counts update in real time across the workspace
    const [channelMems] = await pool.query(
      'SELECT user_id FROM SCT_channel_members WHERE channel_id = ?',
      [channelId]
    );
    for (const mem of channelMems) {
      if (mem.user_id !== user_id) {
        io.to(`user_${mem.user_id}`).emit('new_message', fullMessage);
      }
    }

    processMentionsAndNotify(channelId, user_id, finalContent, messageId);

    res.status(201).json(fullMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Delete message permanently from database (ONLY sender can delete, not even admin)
app.delete('/api/channels/:channelId/messages/:messageId', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const messageId = Number(req.params.messageId);
    const requestedBy = Number(req.query.requestedBy);

    const [[msg]] = await pool.query('SELECT * FROM SCT_messages WHERE id = ?', [messageId]);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Only the author who sent the message can delete it (not even admin)
    if (Number(msg.user_id) !== requestedBy) {
      return res.status(403).json({ error: 'Only the user who sent this message can delete it.' });
    }

    // Permanently delete message from SCT_messages
    await pool.query('DELETE FROM SCT_messages WHERE id = ?', [messageId]);

    // Delete reactions linked to this message
    await pool.query('DELETE FROM SCT_message_reactions WHERE message_id = ?', [messageId]);

    // Also delete any notifications linked to this message
    await pool.query('DELETE FROM SCT_notifications WHERE message_id = ?', [messageId]);

    // Broadcast deletion in real time to all clients
    io.to(`channel_${channelId}`).emit('message_deleted', { channelId, messageId });

    res.json({ success: true, messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15.1. Edit message (ONLY sender can edit, marks is_edited = 1)
app.put('/api/channels/:channelId/messages/:messageId', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const messageId = Number(req.params.messageId);
    const { content, requested_by } = req.body;
    const requestedBy = Number(requested_by);

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const [[msg]] = await pool.query('SELECT * FROM SCT_messages WHERE id = ?', [messageId]);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Only the author can edit their own message
    if (Number(msg.user_id) !== requestedBy) {
      return res.status(403).json({ error: 'Only the author can edit this message.' });
    }

    // Update message content and flag is_edited = 1
    await pool.query(
      'UPDATE SCT_messages SET content = ?, is_edited = 1 WHERE id = ?',
      [content.trim(), messageId]
    );

    const [[updatedMsg]] = await pool.query(
      `SELECT m.*, u.username, u.name as user_name, u.role as user_role, u.team_name, u.avatar
       FROM SCT_messages m
       JOIN SCT_users u ON m.user_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    // Broadcast updated message to channel
    io.to(`channel_${channelId}`).emit('message_updated', updatedMsg);

    res.json(updatedMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15.2. Toggle message emoji reaction (WhatsApp-style toggle)
app.post('/api/messages/:messageId/reactions', async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const { user_id, emoji } = req.body;

    if (!user_id || !emoji) {
      return res.status(400).json({ error: 'user_id and emoji are required.' });
    }

    const [[msg]] = await pool.query('SELECT channel_id FROM SCT_messages WHERE id = ?', [messageId]);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Toggle reaction: check if user already reacted with this emoji
    const [[existing]] = await pool.query(
      'SELECT id FROM SCT_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [messageId, user_id, emoji]
    );

    if (existing) {
      // User tapped reaction again: toggle off / remove
      await pool.query('DELETE FROM SCT_message_reactions WHERE id = ?', [existing.id]);
    } else {
      // User added reaction
      await pool.query(
        'INSERT INTO SCT_message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
        [messageId, user_id, emoji]
      );
    }

    const updatedReactions = await getMessageReactions(messageId);

    // Broadcast updated reactions in real time to everyone in the channel
    io.to(`channel_${msg.channel_id}`).emit('message_reaction_updated', {
      channelId: msg.channel_id,
      messageId,
      reactions: updatedReactions
    });

    res.json({ messageId, reactions: updatedReactions });
  } catch (err) {
    console.error('Error toggling reaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// 16. File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    size: req.file.size
  });
});

// 17. Get notifications for user
app.get('/api/notifications', async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const [notifications] = await pool.query(
      `SELECT n.*, c.name as channel_name, c.is_direct, u.name as sender_name
       FROM SCT_notifications n
       JOIN SCT_channels c ON n.channel_id = c.id
       LEFT JOIN SCT_users u ON n.sender_id = u.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 18. Dismiss / Delete notification on click
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const notifId = Number(req.params.id);
    await pool.query('DELETE FROM SCT_notifications WHERE id = ?', [notifId]);
    res.json({ success: true, id: notifId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const notifId = Number(req.params.id);
    await pool.query('UPDATE SCT_notifications SET is_read = 1 WHERE id = ?', [notifId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all notifications read
app.post('/api/notifications/mark-read', async (req, res) => {
  try {
    const { userId } = req.body;
    if (userId) {
      await pool.query('UPDATE SCT_notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// USER MANAGEMENT (ADMIN ONLY)
// -------------------------------------------------------------

// Add User
app.post('/api/admin/users', async (req, res) => {
  try {
    const { requested_by, username, name, password, role, team_name } = req.body;
    const [[admin]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requested_by]);
    if (!admin || admin.role !== 'super_admin' || admin.username !== '002') {
      return res.status(403).json({ error: 'Only the Master Admin can add new users.' });
    }

    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required.' });
    }

    const finalUsername = (username || name).trim().toLowerCase().replace(/\s+/g, '_');
    const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

    const [ins] = await pool.query(
      'INSERT INTO SCT_users (username, name, password, role, team_name, avatar) VALUES (?, ?, ?, ?, ?, ?)',
      [finalUsername, name.trim(), password.trim(), role || 'member', team_name || 'Team 1', initials]
    );
    const newUserId = ins.insertId;

    const [[newUser]] = await pool.query('SELECT id, username, name, role, team_name, avatar FROM SCT_users WHERE id = ?', [newUserId]);
    io.emit('user_created', newUser);
    res.status(201).json(newUser);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A user with this username or display name already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Edit User
app.put('/api/admin/users/:userId', async (req, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    const { requested_by, username, name, password, role, team_name } = req.body;

    const [[admin]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requested_by]);
    if (!admin || admin.role !== 'super_admin' || admin.username !== '002') {
      return res.status(403).json({ error: 'Only the Master Admin can edit user details.' });
    }

    const updates = [];
    const params = [];

    if (username) { updates.push('username = ?'); params.push(username.trim()); }
    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (password) { updates.push('password = ?'); params.push(password.trim()); }
    if (role) { updates.push('role = ?'); params.push(role); }
    if (team_name) { updates.push('team_name = ?'); params.push(team_name); }

    if (updates.length > 0) {
      params.push(targetUserId);
      await pool.query(`UPDATE SCT_users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [[updatedUser]] = await pool.query('SELECT id, username, name, role, team_name, avatar FROM SCT_users WHERE id = ?', [targetUserId]);
    io.emit('user_updated', updatedUser);
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete User
app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    const requestedBy = Number(req.query.requestedBy);

    const [[admin]] = await pool.query('SELECT role, username FROM SCT_users WHERE id = ?', [requestedBy]);
    if (!admin || admin.role !== 'super_admin' || admin.username !== '002') {
      return res.status(403).json({ error: 'Only the Master Admin can delete users.' });
    }

    if (targetUserId === requestedBy) {
      return res.status(400).json({ error: 'Super Admin cannot delete their own account.' });
    }

    await pool.query('DELETE FROM SCT_users WHERE id = ?', [targetUserId]);
    io.emit('user_deleted', { userId: targetUserId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SOCKET.IO REAL-TIME HANDLING
// -------------------------------------------------------------
io.on('connection', (socket) => {
  let currentUserId = null;

  // Immediately send currently online users to the newly connected socket
  socket.emit('online_users', Array.from(onlineUsers.keys()));

  socket.on('get_online_users', () => {
    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('user_connected', (userId) => {
    if (!userId) return;
    currentUserId = Number(userId);
    if (!onlineUsers.has(currentUserId)) {
      onlineUsers.set(currentUserId, new Set());
    }
    onlineUsers.get(currentUserId).add(socket.id);
    socket.join(`user_${currentUserId}`);

    // Instant 0ms broadcast to everyone that this user is online
    io.emit('online_users', Array.from(onlineUsers.keys()));

    // Automatically join all channel rooms this user belongs to in background
    pool.query(
      `SELECT c.id FROM SCT_channels c
       LEFT JOIN SCT_channel_members cm ON c.id = cm.channel_id AND cm.user_id = ?
       WHERE cm.user_id IS NOT NULL OR c.is_direct = 0`,
      [currentUserId]
    ).then(([userChans]) => {
      for (const ch of userChans) {
        socket.join(`channel_${ch.id}`);
      }
    }).catch((err) => {
      console.error('Error joining user channels:', err);
    });
  });

  socket.on('join_channel', (channelId) => {
    socket.join(`channel_${channelId}`);
  });

  socket.on('leave_channel', (channelId) => {
    socket.leave(`channel_${channelId}`);
  });

  socket.on('typing', ({ channelId, userName, isTyping }) => {
    socket.to(`channel_${channelId}`).emit('user_typing', { channelId, userName, isTyping });
  });

  socket.on('disconnect', () => {
    if (currentUserId && onlineUsers.has(currentUserId)) {
      const socketSet = onlineUsers.get(currentUserId);
      socketSet.delete(socket.id);
      if (socketSet.size === 0) {
        onlineUsers.delete(currentUserId);
      }
      io.emit('online_users', Array.from(onlineUsers.keys()));
    }
  });
});

// Serve built frontend in production/preview
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 AVK Workspace server running on port ${PORT}`);
});
