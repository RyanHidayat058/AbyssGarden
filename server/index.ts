import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import * as db from './db';
import { roomManager } from './rooms';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 1. Authentication Routes
app.post('/api/auth/register', (req, res) => {
  try {
    const { callsign, password, avatar } = req.body;
    if (!callsign || !password) {
      return res.status(400).json({ error: 'Callsign and Password required!' });
    }
    const user = db.registerUser(callsign, password, avatar || '🤿');
    res.json({ user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { callsign, password } = req.body;
    if (!callsign || !password) {
      return res.status(400).json({ error: 'Callsign and Password required!' });
    }
    const user = db.loginUser(callsign, password);
    res.json({ user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    res.status(401).json({ error: msg });
  }
});

// 2. Friends Routes
app.get('/api/friends', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const friends = db.getFriends(userId);
    res.json({ friends });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch friends';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/friends/add', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { callsign } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!callsign) return res.status(400).json({ error: 'Target callsign required' });

    const friend = db.addFriendByCallsign(userId, callsign);
    res.json({ success: true, friend });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add friend';
    res.status(400).json({ error: msg });
  }
});

// 3. Expeditions Routes (Max 4 players)
app.post('/api/expeditions/create', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { name } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!name) return res.status(400).json({ error: 'Expedition name required' });

    const exp = db.createExpedition(userId, name);
    res.json({ expedition: exp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create expedition';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/expeditions/join', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { code } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!code) return res.status(400).json({ error: 'Expedition code required' });

    const exp = db.joinExpeditionByCode(userId, code);
    res.json({ expedition: exp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to join expedition';
    res.status(400).json({ error: msg });
  }
});

app.get('/api/expeditions/my', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const expeditions = db.getMySavedExpeditions(userId);
    res.json({ expeditions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch saved expeditions';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/expeditions/:id', (req, res) => {
  try {
    const exp = db.getExpeditionDetails(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Expedition not found' });
    res.json({ expedition: exp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch expedition';
    res.status(500).json({ error: msg });
  }
});

// 4. Isolated Save / Load Routes
app.post('/api/data/save', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { mode, expeditionId, inventory, chests, farm, machines, shells } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!mode || (mode !== 'solo' && mode !== 'coop')) {
      return res.status(400).json({ error: 'Invalid mode (must be solo or coop)' });
    }

    db.saveGameData(
      userId,
      mode,
      mode === 'coop' ? (expeditionId || null) : null,
      JSON.stringify(inventory || []),
      JSON.stringify(chests || []),
      JSON.stringify(farm || {}),
      JSON.stringify(machines || []),
      Number(shells) || 0
    );

    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Save failed';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/data/load', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const mode = (req.query.mode as string) || 'solo';
    const expeditionId = (req.query.expeditionId as string) || null;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const data = db.loadGameData(userId, mode as 'solo' | 'coop', expeditionId);
    if (!data) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      inventory: JSON.parse(data.inventory_json),
      chests: JSON.parse(data.chests_json),
      farm: JSON.parse(data.farm_json),
      machines: JSON.parse(data.machines_json),
      shells: data.shells,
      updatedAt: data.updated_at
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Load failed';
    res.status(500).json({ error: msg });
  }
});

// Create HTTP server & WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/multiplayer' });

interface ClientMetadata {
  userId?: string;
  expeditionId?: string;
  callsign?: string;
  avatar?: string;
}

const clientMeta = new WeakMap<WebSocket, ClientMetadata>();

wss.on('connection', (ws) => {
  clientMeta.set(ws, {});

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const meta = clientMeta.get(ws) || {};

      switch (msg.type) {
        case 'join_expedition': {
          const { expeditionId, userId, callsign, avatar } = msg;
          meta.expeditionId = expeditionId;
          meta.userId = userId;
          meta.callsign = callsign;
          meta.avatar = avatar;

          const result = roomManager.joinRoom(expeditionId, ws, userId, callsign, avatar);
          if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.error }));
            ws.close();
            return;
          }

          ws.send(JSON.stringify({
            type: 'joined_success',
            expeditionId,
            currentPlayers: result.currentPlayers
          }));
          break;
        }

        case 'move': {
          if (meta.expeditionId && meta.userId) {
            roomManager.updatePlayerMove(meta.expeditionId, meta.userId, {
              x: msg.x,
              y: msg.y,
              facingAngle: msg.facingAngle,
              isMoving: msg.isMoving,
              map: msg.map,
              suitId: msg.suitId
            });
          }
          break;
        }

        case 'suit_change': {
          if (meta.expeditionId && meta.userId && msg.suitId) {
            roomManager.broadcastSuitUpdate(meta.expeditionId, meta.userId, msg.suitId);
          }
          break;
        }

        case 'weather_change': {
          if (meta.expeditionId && msg.weather) {
            roomManager.broadcastWeather(meta.expeditionId, msg.weather, msg.duration);
          }
          break;
        }

        case 'farm_action': {
          if (meta.expeditionId) {
            roomManager.broadcastFarmUpdate(meta.expeditionId, ws, {
              gridX: msg.gridX,
              gridY: msg.gridY,
              actionType: msg.actionType,
              cropId: msg.cropId,
              stage: msg.stage,
              mutation: msg.mutation
            });
          }
          break;
        }

        case 'chat': {
          if (meta.expeditionId && meta.callsign) {
            roomManager.broadcastChat(meta.expeditionId, meta.callsign, msg.text);
          }
          break;
        }
      }
    } catch {
      // Ignore invalid JSON
    }
  });

  ws.on('close', () => {
    const meta = clientMeta.get(ws);
    if (meta?.expeditionId) {
      roomManager.leaveRoom(meta.expeditionId, ws);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Abyss Garden Backend] Server listening on http://localhost:${PORT}`);
  console.log(`[Abyss Garden Backend] WebSocket endpoint at ws://localhost:${PORT}/ws/multiplayer`);
});
