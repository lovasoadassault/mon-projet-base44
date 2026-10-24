import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { requireAuth, tokenCookie, verifyToken, COOKIE_NAME } from './auth.js';

const PORT = Number(process.env.PORT || 4000);
const now = () => new Date().toISOString();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(cookieParser());

// userId -> connected socket count
const online = new Map();

const publicUser = (id) =>
  db.prepare('SELECT id, username, avatar, address, age FROM users WHERE id = ?').get(id);

const friendshipBetween = (a, b) =>
  db.prepare(
    `SELECT * FROM friendships
     WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
  ).get(a, b, b, a);

const friendIdsOf = (me) =>
  db.prepare(
    `SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS fid
     FROM friendships
     WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'`
  )
    .all(me, me, me)
    .map((r) => r.fid);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- Auth ----------
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !/^[a-zA-Z0-9._]{3,20}$/.test(username)) {
    return res.status(400).json({
      error: "Anarana tsy mety (3 ka hatramin'ny 20 litera: litera, isa, . na _)",
    });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Ilaina ny tenimiafina (farafahakeliny 6 litera)' });
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Efa nampiasaina io anarana io' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, hash);
  tokenCookie(res, info.lastInsertRowid);
  res.status(201).json({ user: publicUser(info.lastInsertRowid) });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Misy diso ny anarana na ny tenimiafina' });
  }
  tokenCookie(res, user.id);
  res.json({ user: publicUser(user.id) });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.userId) });
});

// ---------- Profil ----------
const notifyFriends = (me, event) => {
  for (const fid of friendIdsOf(me)) io.to(`user:${fid}`).emit(event);
};

app.post('/api/profile', requireAuth, (req, res) => {
  const me = req.userId;
  const { username, address, age } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(me);
  const updates = {};

  if (username !== undefined && username !== user.username) {
    if (!/^[a-zA-Z0-9._]{3,20}$/.test(username)) {
      return res.status(400).json({
        error: "Anarana tsy mety (3 ka hatramin'ny 20 litera: litera, isa, . na _)",
      });
    }
    if (
      db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, me)
    ) {
      return res.status(409).json({ error: 'Efa nampiasaina io anarana io' });
    }
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const changes = db
      .prepare(
        'SELECT COUNT(*) AS c FROM username_changes WHERE user_id = ? AND changed_at > ?'
      )
      .get(me, monthAgo).c;
    if (changes >= 2) {
      return res.status(429).json({
        error: 'Voafetra ny fanovana anarana: indroa isam-bolana fara-fahakeliny',
      });
    }
    updates.username = username;
  }

  if (address !== undefined) {
    updates.address = String(address).trim().slice(0, 60) || null;
  }

  if (age !== undefined) {
    if (age === null || age === '') {
      updates.age = null;
    } else {
      const a = Number(age);
      if (!Number.isInteger(a) || a < 1 || a > 120) {
        return res.status(400).json({ error: "Taona tsy mety (isa 1–120)" });
      }
      updates.age = a;
    }
  }

  if (Object.keys(updates).length > 0) {
    const set = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ');
    db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(
      ...Object.values(updates),
      me
    );
    if (updates.username) {
      db.prepare(
        `INSERT INTO username_changes (user_id, old_username, new_username, changed_at)
         VALUES (?, ?, ?, ?)`
      ).run(me, user.username, updates.username, now());
    }
    notifyFriends(me, 'friend-updated');
  }
  res.json({ user: publicUser(me) });
});

app.post('/api/avatar', requireAuth, (req, res) => {
  const avatar = String(req.body?.avatar || '');
  if (avatar && !avatar.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Tsy sary mety io fidirana io' });
  }
  if (avatar.length > 1_500_000) {
    return res.status(400).json({ error: "Be loatra ny sary (1 Mo fara-fahakeliny)" });
  }
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar || null, req.userId);
  notifyFriends(req.userId, 'friend-updated');
  res.json({ user: publicUser(req.userId) });
});

// ---------- Friends ----------
app.get('/api/friends', requireAuth, (req, res) => {
  const me = req.userId;
  const stmtLast = db.prepare(
    `SELECT body, created_at FROM messages
     WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
     ORDER BY id DESC LIMIT 1`
  );
  const stmtUnread = db.prepare(
    `SELECT COUNT(*) AS c FROM messages
     WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`
  );
  const friends = friendIdsOf(me)
    .map((id) => {
      const u = publicUser(id);
      const last = stmtLast.get(me, id, id, me);
      return {
        id,
        username: u.username,
        avatar: u.avatar,
        address: u.address,
        age: u.age,
        online: (online.get(id) || 0) > 0,
        unread: stmtUnread.get(id, me).c,
        last_message: last ? last.body : null,
        last_at: last ? last.created_at : null,
      };
    })
    .sort((a, b) => String(b.last_at || '').localeCompare(String(a.last_at || '')));
  res.json({ friends });
});

app.get('/api/requests', requireAuth, (req, res) => {
  const requests = db
    .prepare(
      `SELECT f.id, f.requester_id, u.username, u.avatar, u.address, u.age
       FROM friendships f JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = ? AND f.status = 'pending'`
    )
    .all(req.userId);
  res.json({ requests });
});

app.get('/api/users/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  const rows = db
    .prepare(
      `SELECT id, username, avatar, address, age FROM users WHERE username LIKE ? AND id != ?
       ORDER BY username LIMIT 20`
    )
    .all(`%${q}%`, req.userId);
  const results = rows.map((u) => {
    const f = friendshipBetween(req.userId, u.id);
    let status = 'none';
    if (f) {
      if (f.status === 'accepted') status = 'friends';
      else status = f.requester_id === req.userId ? 'pending_out' : 'pending_in';
    }
    return { id: u.id, username: u.username, avatar: u.avatar, address: u.address, age: u.age, status };
  });
  res.json({ results });
});

app.post('/api/friends/request', requireAuth, (req, res) => {
  const target = Number(req.body?.userId);
  if (!target || target === req.userId) {
    return res.status(400).json({ error: 'Mpampiasa tsy mety' });
  }
  if (!publicUser(target)) return res.status(404).json({ error: 'Tsy hita ilay mpampiasa' });
  const existing = friendshipBetween(req.userId, target);
  if (existing) {
    return res.status(409).json({
      error:
        existing.status === 'accepted'
          ? 'Efa namana ianareo'
          : 'Efa misy fangatahana mandeha',
    });
  }
  db.prepare(
    `INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`
  ).run(req.userId, target);
  io.to(`user:${target}`).emit('friend-request', {
    from: publicUser(req.userId),
  });
  res.status(201).json({ ok: true });
});

app.post('/api/friends/respond', requireAuth, (req, res) => {
  const { requestId, action } = req.body || {};
  const f = db
    .prepare(
      `SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'`
    )
    .get(requestId, req.userId);
  if (!f) return res.status(404).json({ error: 'Tsy hita ilay fangatahana' });
  if (action === 'accept') {
    db.prepare(`UPDATE friendships SET status = 'accepted' WHERE id = ?`).run(f.id);
    io.to(`user:${f.requester_id}`).emit('friend-updated');
    io.to(`user:${req.userId}`).emit('friend-updated');
  } else {
    db.prepare(`DELETE FROM friendships WHERE id = ?`).run(f.id);
  }
  res.json({ ok: true });
});

// ---------- Messages ----------
app.get('/api/messages/:friendId', requireAuth, (req, res) => {
  const other = Number(req.params.friendId);
  const f = friendshipBetween(req.userId, other);
  if (!f || f.status !== 'accepted') {
    return res.status(403).json({ error: 'Tsy namana amin\'ilay mpampiasa ianao' });
  }
  db.prepare(
    `UPDATE messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`
  ).run(now(), other, req.userId);
  const messages = db
    .prepare(
      `SELECT * FROM (
        SELECT * FROM messages
        WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
        ORDER BY id DESC LIMIT 200
      ) ORDER BY id ASC`
    )
    .all(req.userId, other, other, req.userId);
  res.json({ messages, friend: publicUser(other) });
});

app.post('/api/messages/read', requireAuth, (req, res) => {
  const other = Number(req.body?.userId);
  if (other) {
    db.prepare(
      `UPDATE messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`
    ).run(now(), other, req.userId);
  }
  res.json({ ok: true });
});

app.post('/api/messages', requireAuth, (req, res) => {
  const recipientId = Number(req.body?.recipientId);
  const body = String(req.body?.body || '').trim().slice(0, 2000);
  if (!recipientId || !body) return res.status(400).json({ error: 'Hafatra foana' });
  const f = friendshipBetween(req.userId, recipientId);
  if (!f || f.status !== 'accepted') {
    return res.status(403).json({ error: 'Tsy afaka manoratra afa-tsy amin\'ny namana ianao' });
  }
  const info = db
    .prepare(
      `INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES (?, ?, ?, ?)`
    )
    .run(req.userId, recipientId, body, now());
  const message = {
    id: Number(info.lastInsertRowid),
    sender_id: req.userId,
    recipient_id: recipientId,
    body,
    created_at: now(),
  };
  io.to(`user:${req.userId}`).to(`user:${recipientId}`).emit('message:new', message);
  res.status(201).json({ message });
});

// ---------- Realtime ----------
io.use((socket, next) => {
  const raw = socket.handshake.headers.cookie || '';
  let token = null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === COOKIE_NAME) {
      try {
        token = decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        token = part.slice(idx + 1).trim();
      }
    }
  }
  const userId = token ? verifyToken(token) : null;
  if (!userId) return next(new Error('unauthorized'));
  socket.userId = userId;
  next();
});

function broadcastPresence(userId, isOnline) {
  const payload = { userId, online: isOnline };
  for (const fid of friendIdsOf(userId)) {
    io.to(`user:${fid}`).emit('presence', payload);
  }
}

io.on('connection', (socket) => {
  const me = socket.userId;
  socket.join(`user:${me}`);
  const prev = online.get(me) || 0;
  online.set(me, prev + 1);
  if (prev === 0) broadcastPresence(me, true);

  socket.on('disconnect', () => {
    const cur = online.get(me) || 1;
    if (cur <= 1) {
      online.delete(me);
      broadcastPresence(me, false);
    } else {
      online.set(me, cur - 1);
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`aiza izy — API + realtime listening on :${PORT}`);
});
