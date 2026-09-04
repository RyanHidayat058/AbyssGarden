import type { WebSocket } from 'ws';

export interface PlayerSession {
  ws: WebSocket;
  userId: string;
  callsign: string;
  avatar: string;
  suitId?: string;
  x: number;
  y: number;
  facingAngle: number;
  isMoving: boolean;
}

export interface ExpeditionRoom {
  expeditionId: string;
  currentWeather?: string;
  players: Map<string, PlayerSession>; // keyed by userId
}

export class RoomManager {
  private rooms: Map<string, ExpeditionRoom> = new Map();

  public getRoom(expeditionId: string): ExpeditionRoom {
    let room = this.rooms.get(expeditionId);
    if (!room) {
      room = {
        expeditionId,
        players: new Map()
      };
      this.rooms.set(expeditionId, room);
    }
    return room;
  }

  public joinRoom(
    expeditionId: string,
    ws: WebSocket,
    userId: string,
    callsign: string,
    avatar: string
  ): { success: boolean; error?: string; currentPlayers?: Array<{ userId: string; callsign: string; avatar: string; x: number; y: number; facingAngle: number }> } {
    const room = this.getRoom(expeditionId);

    // Enforce max 4 players per expedition room
    if (room.players.size >= 4 && !room.players.has(userId)) {
      return { success: false, error: 'Expedition room is full (Maximum 4 divers).' };
    }

    const session: PlayerSession = {
      ws,
      userId,
      callsign,
      avatar,
      x: 18 * 48 + 24,
      y: 14 * 48 + 24,
      facingAngle: 0,
      isMoving: false
    };

    room.players.set(userId, session);

    // Notify other divers in the room
    this.broadcast(expeditionId, {
      type: 'player_joined',
      player: {
        userId,
        callsign,
        avatar,
        x: session.x,
        y: session.y,
        facingAngle: session.facingAngle
      }
    }, ws);

    // Collect list of other current players to return to this new diver
    const currentPlayers: Array<{ userId: string; callsign: string; avatar: string; x: number; y: number; facingAngle: number }> = [];
    for (const [id, p] of room.players.entries()) {
      if (id !== userId) {
        currentPlayers.push({
          userId: p.userId,
          callsign: p.callsign,
          avatar: p.avatar,
          x: p.x,
          y: p.y,
          facingAngle: p.facingAngle
        });
      }
    }

    return { success: true, currentPlayers };
  }

  public updatePlayerMove(expeditionId: string, userId: string, data: { x: number; y: number; facingAngle: number; isMoving: boolean; map?: string; suitId?: string }) {
    const room = this.rooms.get(expeditionId);
    if (!room) return;

    const session = room.players.get(userId);
    if (session) {
      session.x = data.x;
      session.y = data.y;
      session.facingAngle = data.facingAngle;
      session.isMoving = data.isMoving;
      if (data.suitId) session.suitId = data.suitId;

      // Broadcast move to other divers in room
      this.broadcast(expeditionId, {
        type: 'player_moved',
        userId,
        x: data.x,
        y: data.y,
        facingAngle: data.facingAngle,
        isMoving: data.isMoving,
        map: data.map,
        suitId: session.suitId
      }, session.ws);
    }
  }

  public broadcastWeather(expeditionId: string, weather: string, duration?: number) {
    const room = this.rooms.get(expeditionId);
    if (room) room.currentWeather = weather;
    this.broadcast(expeditionId, {
      type: 'weather_synced',
      weather,
      duration
    });
  }

  public broadcastSuitUpdate(expeditionId: string, userId: string, suitId: string) {
    const room = this.rooms.get(expeditionId);
    const session = room?.players.get(userId);
    if (session) session.suitId = suitId;
    this.broadcast(expeditionId, {
      type: 'suit_updated',
      userId,
      suitId
    });
  }

  public broadcastFarmUpdate(expeditionId: string, senderWs: WebSocket, action: { gridX: number; gridY: number; actionType: string; cropId?: string; stage?: number; mutation?: string }) {
    this.broadcast(expeditionId, {
      type: 'farm_update',
      ...action
    }, senderWs);
  }

  public broadcastChat(expeditionId: string, senderCallsign: string, text: string) {
    this.broadcast(expeditionId, {
      type: 'chat_message',
      sender: senderCallsign,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }

  public leaveRoom(expeditionId: string, ws: WebSocket): string | null {
    const room = this.rooms.get(expeditionId);
    if (!room) return null;

    let leavingUserId: string | null = null;
    let leavingCallsign: string = '';

    for (const [id, p] of room.players.entries()) {
      if (p.ws === ws) {
        leavingUserId = id;
        leavingCallsign = p.callsign;
        room.players.delete(id);
        break;
      }
    }

    if (leavingUserId) {
      this.broadcast(expeditionId, {
        type: 'player_left',
        userId: leavingUserId,
        callsign: leavingCallsign
      });

      if (room.players.size === 0) {
        this.rooms.delete(expeditionId);
      }
    }

    return leavingUserId;
  }

  public broadcast(expeditionId: string, message: unknown, excludeWs?: WebSocket) {
    const room = this.rooms.get(expeditionId);
    if (!room) return;

    const payload = JSON.stringify(message);
    for (const session of room.players.values()) {
      if (session.ws !== excludeWs && session.ws.readyState === 1 /* OPEN */) {
        try {
          session.ws.send(payload);
        } catch {
          // Ignore disconnected socket
        }
      }
    }
  }
}

export const roomManager = new RoomManager();
