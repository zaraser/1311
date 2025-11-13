// backend/src/db.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------
// 📌 CORRECT DB PATH (works locally + Docker)
// ---------------------------------------------------------
const dataDir = path.join(path.resolve(), "backend", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "chat.db");
const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------
// 🗄️ TABLES
// ---------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    avatar TEXT DEFAULT '👤',
    online INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId TEXT NOT NULL,
    receiverId TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(receiverId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_pair
ON messages (senderId, receiverId);

CREATE TABLE IF NOT EXISTS blocks (
    blockerId TEXT NOT NULL,
    blockedId TEXT NOT NULL,
    PRIMARY KEY (blockerId, blockedId),
    FOREIGN KEY(blockerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(blockedId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friends (
    userId TEXT NOT NULL,
    friendId TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'accepted')) NOT NULL,
    PRIMARY KEY (userId, friendId),
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(friendId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invites (
    inviterId TEXT NOT NULL,
    inviteeId TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inviterId, inviteeId),
    FOREIGN KEY(inviterId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(inviteeId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1Id TEXT NOT NULL,
    player2Id TEXT NOT NULL,
    winnerId TEXT,
    score TEXT,
    matchType TEXT,
    gameType TEXT,
    duration INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(player1Id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(player2Id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(winnerId) REFERENCES users(id) ON DELETE SET NULL
);
`);

// ---------------------------------------------------------
// 👤 SEED USERS (добавляем если их нет)
// ---------------------------------------------------------

const seedUsers = [
    { id: "u1", username: "Alice", avatar: "👩" },
    { id: "u2", username: "Bob", avatar: "👨" },
    { id: "u3", username: "Charlie", avatar: "🧑" },
    { id: "u4", username: "Diana", avatar: "👩‍🦰" },
    { id: "u5", username: "Eve", avatar: "👱‍♀️" },
  ];
  
  const userExists = db.prepare("SELECT 1 FROM users WHERE id = ?");
  
  for (const u of seedUsers) {
    if (!userExists.get(u.id)) {
      db.prepare(`
        INSERT INTO users (id, username, avatar)
        VALUES (?, ?, ?)
      `).run(u.id, u.username, u.avatar);
    }
  }
  
// ---------------------------------------------------------
// 👤 USER QUERIES
// ---------------------------------------------------------
export const userQueries = {
  getAll: db.prepare("SELECT * FROM users"),
  getByUsername: db.prepare("SELECT * FROM users WHERE username = ?"),
  create: db.prepare(`
    INSERT INTO users (id, username, avatar)
    VALUES (?, ?, ?)
  `),
  updateOnline: db.prepare("UPDATE users SET online = ? WHERE id = ?"),
};


// ---------------------------------------------------------
// 💬 MESSAGE QUERIES
// ---------------------------------------------------------
export const messageQueries = {
  getConversation: db.prepare(`
    SELECT * FROM messages
    WHERE (senderId = ? AND receiverId = ?)
       OR (senderId = ? AND receiverId = ?)
    ORDER BY timestamp ASC
  `),

  insert: db.prepare(`
    INSERT INTO messages (senderId, receiverId, content)
    VALUES (?, ?, ?)
  `),
};


// ---------------------------------------------------------
// 🚫 BLOCK SYSTEM
// ---------------------------------------------------------
export const blockQueries = {
  check: db.prepare(`
    SELECT 1 FROM blocks
    WHERE blockerId = ? AND blockedId = ?
  `),

  add: db.prepare(`
    INSERT OR IGNORE INTO blocks (blockerId, blockedId)
    VALUES (?, ?)
  `),

  remove: db.prepare(`
    DELETE FROM blocks
    WHERE blockerId = ? AND blockedId = ?
  `),

  listByUser: db.prepare(`
    SELECT blockedId FROM blocks WHERE blockerId = ?
  `),

  listBlockedBy: db.prepare(`
    SELECT blockerId FROM blocks WHERE blockedId = ?
  `),
};


// ---------------------------------------------------------
// 🤝 FRIEND SYSTEM
// ---------------------------------------------------------
export const friendQueries = {
  getFriends: db.prepare(`
    SELECT u.id, u.username, u.avatar
    FROM friends f
    JOIN users u ON u.id = f.friendId
    WHERE f.userId = ? AND f.status = 'accepted'
  `),

  getIncoming: db.prepare(`
    SELECT u.id, u.username, u.avatar
    FROM friends f
    JOIN users u ON u.id = f.userId
    WHERE f.friendId = ? AND f.status = 'pending'
  `),

  getOutgoing: db.prepare(`
    SELECT u.id, u.username, u.avatar
    FROM friends f
    JOIN users u ON u.id = f.friendId
    WHERE f.userId = ? AND f.status = 'pending'
  `),

  createRequest: db.prepare(`
    INSERT OR IGNORE INTO friends (userId, friendId, status)
    VALUES (?, ?, 'pending')
  `),

  upsertAccepted: db.prepare(`
    INSERT INTO friends (userId, friendId, status)
    VALUES (?, ?, 'accepted')
    ON CONFLICT(userId, friendId)
    DO UPDATE SET status = 'accepted'
  `),

  deleteRelation: db.prepare(`
    DELETE FROM friends WHERE userId = ? AND friendId = ?
  `),
};


// ---------------------------------------------------------
// 🎮 GAME INVITES
// ---------------------------------------------------------
export const inviteQueries = {
  create: db.prepare(`
    INSERT OR IGNORE INTO invites (inviterId, inviteeId, status)
    VALUES (?, ?, 'pending')
  `),

  cancel: db.prepare(`
    DELETE FROM invites WHERE inviterId = ? AND inviteeId = ?
  `),

  accept: db.prepare(`
    UPDATE invites SET status = 'accepted'
    WHERE inviterId = ? AND inviteeId = ?
  `),

  decline: db.prepare(`
    UPDATE invites SET status = 'declined'
    WHERE inviterId = ? AND inviteeId = ?
  `),

  incoming: db.prepare(`
    SELECT inviterId AS userId
    FROM invites WHERE inviteeId = ? AND status = 'pending'
  `),

  outgoing: db.prepare(`
    SELECT inviteeId AS userId
    FROM invites WHERE inviterId = ? AND status = 'pending'
  `),
};


// ---------------------------------------------------------
// 🏆 MATCH HISTORY
// ---------------------------------------------------------
export const matchQueries = {
  create: db.prepare(`
    INSERT INTO matches (
      player1Id, player2Id, winnerId, score,
      matchType, gameType, duration
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `),

  getByUser: db.prepare(`
    SELECT * FROM matches
    WHERE player1Id = ? OR player2Id = ?
    ORDER BY createdAt DESC
  `),

  getRegular: db.prepare(`
    SELECT * FROM matches
    WHERE (player1Id = ? OR player2Id = ?)
      AND matchType = 'regular'
    ORDER BY createdAt DESC
  `),

  getTournament: db.prepare(`
    SELECT * FROM matches
    WHERE (player1Id = ? OR player2Id = ?)
      AND matchType = 'tournament'
    ORDER BY createdAt DESC
  `),

  getStats: db.prepare(`
    SELECT
      COUNT(*) AS totalMatches,
      SUM(CASE WHEN winnerId = ? THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN winnerId IS NULL THEN 1 ELSE 0 END) AS draws,
      SUM(CASE WHEN winnerId != ? AND winnerId IS NOT NULL THEN 1 ELSE 0 END) AS losses
    FROM matches
    WHERE player1Id = ? OR player2Id = ?
  `),
};

export default db;
