import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';

const dbPath = path.resolve(process.cwd(), 'abyss_garden.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    callsign TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🤿',
    rank TEXT NOT NULL DEFAULT 'Reef Pioneer (Rank 1)',
    shells INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'accepted',
    created_at TEXT NOT NULL,
    UNIQUE(user_id, friend_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(friend_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS expeditions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    host_id TEXT NOT NULL,
    name TEXT NOT NULL,
    shells INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL,
    FOREIGN KEY(host_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS expedition_members (
    id TEXT PRIMARY KEY,
    expedition_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    UNIQUE(expedition_id, user_id),
    FOREIGN KEY(expedition_id) REFERENCES expeditions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS game_saves (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mode TEXT NOT NULL, -- 'solo' or 'coop'
    expedition_id TEXT, -- NULL for solo
    inventory_json TEXT NOT NULL,
    chests_json TEXT NOT NULL,
    farm_json TEXT NOT NULL,
    machines_json TEXT NOT NULL,
    shells INTEGER NOT NULL DEFAULT 50,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, mode, expedition_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Ensure expeditions table has shells column
try {
  db.exec(`ALTER TABLE expeditions ADD COLUMN shells INTEGER NOT NULL DEFAULT 100;`);
} catch {
  // Already exists
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// User Helpers
export function registerUser(callsign: string, pass: string, avatar: string = '🤿') {
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(callsign) = LOWER(?)').get(callsign);
  if (existing) {
    throw new Error('Callsign already taken!');
  }

  const id = 'user_' + crypto.randomUUID();
  const passHash = hashPassword(pass);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, callsign, password_hash, avatar, rank, shells, created_at)
    VALUES (?, ?, ?, ?, 'Reef Pioneer (Rank 1)', 50, ?)
  `).run(id, callsign.trim(), passHash, avatar, now);

  return { id, callsign: callsign.trim(), avatar, rank: 'Reef Pioneer (Rank 1)', shells: 50 };
}

export function loginUser(callsign: string, pass: string) {
  const passHash = hashPassword(pass);
  const user = db.prepare(`
    SELECT id, callsign, avatar, rank, shells
    FROM users
    WHERE LOWER(callsign) = LOWER(?) AND password_hash = ?
  `).get(callsign.trim(), passHash) as { id: string; callsign: string; avatar: string; rank: string; shells: number } | undefined;

  if (!user) {
    throw new Error('Invalid Callsign or Password!');
  }
  return user;
}

export function getUserById(id: string) {
  return db.prepare('SELECT id, callsign, avatar, rank, shells FROM users WHERE id = ?').get(id) as { id: string; callsign: string; avatar: string; rank: string; shells: number } | undefined;
}

// Friends Helpers
export function getFriends(userId: string) {
  const rows = db.prepare(`
    SELECT u.id, u.callsign, u.avatar, u.rank, f.created_at
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
  `).all(userId) as Array<{ id: string; callsign: string; avatar: string; rank: string; created_at: string }>;

  return rows;
}

export function addFriendByCallsign(userId: string, targetCallsign: string) {
  const friend = db.prepare('SELECT id, callsign FROM users WHERE LOWER(callsign) = LOWER(?)').get(targetCallsign.trim()) as { id: string; callsign: string } | undefined;
  if (!friend) {
    throw new Error('No diver found with that callsign!');
  }
  if (friend.id === userId) {
    throw new Error('You cannot add yourself as a friend!');
  }

  const now = new Date().toISOString();
  // Insert mutual friendship
  const id1 = 'fr_' + crypto.randomUUID();
  const id2 = 'fr_' + crypto.randomUUID();

  db.prepare(`
    INSERT OR IGNORE INTO friends (id, user_id, friend_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id1, userId, friend.id, now);

  db.prepare(`
    INSERT OR IGNORE INTO friends (id, user_id, friend_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id2, friend.id, userId, now);

  return friend;
}

// Expedition Helpers (Max 4 players per room)
export function updateExpeditionShells(expeditionId: string, shells: number) {
  try {
    db.prepare('UPDATE expeditions SET shells = ? WHERE id = ?').run(Math.max(0, shells), expeditionId);
  } catch (err) {
    console.warn('Failed to update expedition shells:', err);
  }
}

export function getExpeditionShells(expeditionId: string): number {
  try {
    const row = db.prepare('SELECT shells FROM expeditions WHERE id = ?').get(expeditionId) as { shells: number } | undefined;
    return row && typeof row.shells === 'number' ? row.shells : 100;
  } catch {
    return 100;
  }
}

export function createExpedition(hostId: string, name: string) {
  const id = 'exp_' + crypto.randomUUID();
  const code = 'ABY-' + Math.floor(1000 + Math.random() * 9000);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO expeditions (id, code, host_id, name, shells, created_at)
    VALUES (?, ?, ?, ?, 100, ?)
  `).run(id, code, hostId, name.trim(), now);

  // Host automatically becomes member #1
  const memberId = 'mem_' + crypto.randomUUID();
  db.prepare(`
    INSERT INTO expedition_members (id, expedition_id, user_id, joined_at)
    VALUES (?, ?, ?, ?)
  `).run(memberId, id, hostId, now);

  return { id, code, hostId, name: name.trim(), shells: 100, memberCount: 1 };
}

export function joinExpeditionByCode(userId: string, code: string) {
  const exp = db.prepare('SELECT id, code, host_id, name, shells FROM expeditions WHERE UPPER(code) = UPPER(?)').get(code.trim()) as { id: string; code: string; host_id: string; name: string; shells: number } | undefined;
  if (!exp) {
    throw new Error('Expedition code not found!');
  }

  // Check member count (Max 4 players)
  const members = db.prepare('SELECT user_id FROM expedition_members WHERE expedition_id = ?').all(exp.id) as Array<{ user_id: string }>;
  if (members.length >= 4 && !members.some(m => m.user_id === userId)) {
    throw new Error('Expedition is full! Maximum 4 divers per expedition.');
  }

  // Insert member if not already joined
  if (!members.some(m => m.user_id === userId)) {
    const memberId = 'mem_' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO expedition_members (id, expedition_id, user_id, joined_at)
      VALUES (?, ?, ?, ?)
    `).run(memberId, exp.id, userId, new Date().toISOString());
  }

  return { ...exp, memberCount: Math.min(4, members.length + 1) };
}

export function getMySavedExpeditions(userId: string) {
  const rows = db.prepare(`
    SELECT e.id, e.code, e.name, e.host_id, e.shells, e.created_at,
           (SELECT COUNT(*) FROM expedition_members WHERE expedition_id = e.id) as member_count
    FROM expeditions e
    JOIN expedition_members m ON m.expedition_id = e.id
    WHERE m.user_id = ?
    ORDER BY e.created_at DESC
  `).all(userId) as Array<{ id: string; code: string; name: string; host_id: string; shells: number; created_at: string; member_count: number }>;

  return rows.map(r => ({
    ...r,
    role: r.host_id === userId ? 'Host' : 'Member'
  }));
}

export function getExpeditionDetails(expeditionId: string) {
  const exp = db.prepare('SELECT id, code, host_id, name, shells, created_at FROM expeditions WHERE id = ?').get(expeditionId) as { id: string; code: string; host_id: string; name: string; shells: number; created_at: string } | undefined;
  if (!exp) return null;

  const members = db.prepare(`
    SELECT u.id, u.callsign, u.avatar, u.rank, m.joined_at
    FROM expedition_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.expedition_id = ?
  `).all(expeditionId) as Array<{ id: string; callsign: string; avatar: string; rank: string; joined_at: string }>;

  return { ...exp, members };
}

// Game Save / Load Helpers (Strictly isolated by mode & expeditionId)
export function saveGameData(
  userId: string,
  mode: 'solo' | 'coop',
  expeditionId: string | null,
  inventoryJson: string,
  chestsJson: string,
  farmJson: string,
  machinesJson: string,
  shells: number
) {
  const now = new Date().toISOString();
  const id = 'save_' + crypto.randomUUID();

  db.prepare(`
    INSERT INTO game_saves (id, user_id, mode, expedition_id, inventory_json, chests_json, farm_json, machines_json, shells, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, mode, expedition_id) DO UPDATE SET
      inventory_json = excluded.inventory_json,
      chests_json = excluded.chests_json,
      farm_json = excluded.farm_json,
      machines_json = excluded.machines_json,
      shells = excluded.shells,
      updated_at = excluded.updated_at
  `).run(id, userId, mode, expeditionId, inventoryJson, chestsJson, farmJson, machinesJson, shells, now);

  // If solo, also update lifetime user shells
  if (mode === 'solo') {
    db.prepare('UPDATE users SET shells = ? WHERE id = ?').run(shells, userId);
  } else if (mode === 'coop' && expeditionId) {
    // If coop, update shared expedition treasury
    updateExpeditionShells(expeditionId, shells);
  }
}

export function loadGameData(userId: string, mode: 'solo' | 'coop', expeditionId: string | null) {
  const row = db.prepare(`
    SELECT inventory_json, chests_json, farm_json, machines_json, shells, updated_at
    FROM game_saves
    WHERE user_id = ? AND mode = ? AND (expedition_id = ? OR (expedition_id IS NULL AND ? IS NULL))
  `).get(userId, mode, expeditionId, expeditionId) as {
    inventory_json: string;
    chests_json: string;
    farm_json: string;
    machines_json: string;
    shells: number;
    updated_at: string;
  } | undefined;

  // In coop mode, shared shells always come from the expedition treasury
  if (mode === 'coop' && expeditionId) {
    const sharedShells = getExpeditionShells(expeditionId);
    if (row) {
      row.shells = sharedShells;
      return row;
    } else {
      return {
        inventory_json: '[]',
        chests_json: '[]',
        farm_json: '[]',
        machines_json: '{}',
        shells: sharedShells,
        updated_at: new Date().toISOString()
      };
    }
  }

  return row || null;
}
