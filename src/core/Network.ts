export interface UserAuth {
  id: string;
  callsign: string;
  avatar: string;
  rank: string;
  shells: number;
}

export interface Friend {
  id: string;
  callsign: string;
  avatar: string;
  rank: string;
}

export interface ExpeditionInfo {
  id: string;
  code: string;
  room_code?: string;
  name: string;
  host_id: string;
  member_count: number;
  role?: string;
}

export type NetworkEventCallback = (data: any) => void;

export class NetworkClient {
  public currentUser: UserAuth | null = null;
  public mode: 'solo' | 'coop' = 'solo';
  public currentExpeditionId: string | null = null;
  public currentExpeditionCode: string | null = null;

  public get token(): string | null {
    return this.currentUser ? this.currentUser.id : null;
  }

  public get activeRoomCode(): string | null {
    return this.currentExpeditionCode;
  }

  public set activeRoomCode(code: string | null) {
    this.currentExpeditionCode = code;
  }

  private ws: WebSocket | null = null;
  private listeners: Map<string, NetworkEventCallback[]> = new Map();
  private lastMoveSendTime: number = 0;

  constructor() {
    this.loadCachedAuth();
  }

  private loadCachedAuth() {
    try {
      const cached = localStorage.getItem('abyss_user_session');
      if (cached) {
        this.currentUser = JSON.parse(cached);
      }
    } catch {
      // Ignore
    }
  }

  public setAuth(user: UserAuth) {
    this.currentUser = user;
    try {
      localStorage.setItem('abyss_user_session', JSON.stringify(user));
    } catch {
      // Ignore
    }
  }

  public logout() {
    this.currentUser = null;
    this.disconnectMultiplayer();
    try {
      localStorage.removeItem('abyss_user_session');
    } catch {
      // Ignore
    }
  }

  // REST API Helpers
  private async request(url: string, method: string = 'GET', body?: unknown) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.currentUser?.id) {
      headers['x-user-id'] = this.currentUser.id;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server request failed');
    }
    return data;
  }

  public async register(callsign: string, pass: string, avatar: string = '🤿'): Promise<UserAuth> {
    const data = await this.request('/api/auth/register', 'POST', { callsign, password: pass, avatar });
    this.setAuth(data.user);
    return data.user;
  }

  public async login(callsign: string, pass: string): Promise<UserAuth> {
    const data = await this.request('/api/auth/login', 'POST', { callsign, password: pass });
    this.setAuth(data.user);
    return data.user;
  }

  public async getFriends(): Promise<Friend[]> {
    const data = await this.request('/api/friends');
    return data.friends || [];
  }

  public async addFriend(callsign: string): Promise<Friend> {
    const data = await this.request('/api/friends/add', 'POST', { callsign });
    return data.friend;
  }

  public async createExpedition(name: string): Promise<ExpeditionInfo> {
    const data = await this.request('/api/expeditions/create', 'POST', { name });
    const exp = data.expedition;
    if (exp) {
      this.currentExpeditionId = exp.id;
      this.currentExpeditionCode = exp.code || exp.room_code;
    }
    return exp;
  }

  public async joinExpeditionByCode(code: string): Promise<ExpeditionInfo> {
    const data = await this.request('/api/expeditions/join', 'POST', { code });
    const exp = data.expedition;
    if (exp) {
      this.currentExpeditionId = exp.id;
      this.currentExpeditionCode = exp.code || exp.room_code;
    }
    return exp;
  }

  public async joinExpedition(code: string): Promise<ExpeditionInfo> {
    return this.joinExpeditionByCode(code);
  }

  public async getMyExpeditions(): Promise<ExpeditionInfo[]> {
    const data = await this.request('/api/expeditions/my');
    return data.expeditions || [];
  }

  public async saveGameData(dataToSave: {
    mode?: 'solo' | 'coop';
    expedition_id?: string | null;
    expeditionId?: string | null;
    shells: number;
    inventory?: unknown;
    inventory_slots?: unknown;
    farm?: unknown;
    farm_plots?: unknown;
    chests?: unknown;
    machines?: unknown;
    refinery_state?: unknown;
  }) {
    if (!this.currentUser) return;
    const mode = dataToSave.mode || this.mode;
    const expId = dataToSave.expedition_id !== undefined ? dataToSave.expedition_id : (dataToSave.expeditionId || this.currentExpeditionId);

    await this.request('/api/data/save', 'POST', {
      mode,
      expeditionId: expId,
      inventory: dataToSave.inventory || dataToSave.inventory_slots || [],
      chests: dataToSave.chests || [],
      farm: dataToSave.farm || dataToSave.farm_plots || [],
      machines: dataToSave.machines || dataToSave.refinery_state || {},
      shells: dataToSave.shells || 0
    });
  }

  public async loadGameData(modeParam?: 'solo' | 'coop', expeditionIdParam?: string): Promise<{
    found: boolean;
    save?: {
      shells: number;
      inventory_slots: any[];
      farm_plots: any[];
      chests: any[];
      refinery_state: any;
    };
    inventory?: unknown[];
    chests?: unknown[];
    farm?: any;
    machines?: any;
    shells?: number;
  }> {
    if (!this.currentUser) return { found: false };
    const mode = modeParam || this.mode;
    const expId = expeditionIdParam !== undefined ? expeditionIdParam : this.currentExpeditionId;
    const params = new URLSearchParams({ mode });
    if (expId) {
      params.append('expeditionId', expId);
    }
    const res = await this.request(`/api/data/load?${params.toString()}`);
    if (res && res.found) {
      res.save = {
        shells: res.shells ?? 0,
        inventory_slots: res.inventory || [],
        farm_plots: res.farm || [],
        chests: res.chests || [],
        refinery_state: res.machines || null
      };
    }
    return res;
  }

  // WebSocket Multiplayer Client
  public connectMultiplayer(expeditionId: string, onConnected?: () => void) {
    if (!this.currentUser) return;

    this.disconnectMultiplayer();
    this.mode = 'coop';
    this.currentExpeditionId = expeditionId;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/multiplayer`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({
        type: 'join_expedition',
        expeditionId,
        userId: this.currentUser?.id,
        callsign: this.currentUser?.callsign,
        avatar: this.currentUser?.avatar
      }));
      if (onConnected) onConnected();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.emit(msg.type, msg);
      } catch {
        // Ignore
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
    };
  }

  public connectWebSocket(_token: string, expeditionId: string) {
    this.connectMultiplayer(expeditionId);
  }

  public disconnectMultiplayer() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.mode = 'solo';
    this.currentExpeditionId = null;
    this.currentExpeditionCode = null;
  }

  public leaveExpedition() {
    this.disconnectMultiplayer();
  }

  public sendMove(
    x: number,
    y: number,
    vxOrAngle: number,
    vyOrMoving?: number | boolean,
    facingAngle?: number,
    isMoving?: boolean,
    map?: string,
    suitId?: string
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = performance.now();
    // Throttle to ~25 updates per second
    if (now - this.lastMoveSendTime > 40) {
      this.lastMoveSendTime = now;

      let sendAngle = typeof vxOrAngle === 'number' ? vxOrAngle : 0;
      let sendMoving = typeof vyOrMoving === 'boolean' ? vyOrMoving : false;
      let sendVx = 0;
      let sendVy = 0;
      let sendMap = map || 'seabed';

      if (facingAngle !== undefined) {
        sendVx = vxOrAngle;
        sendVy = typeof vyOrMoving === 'number' ? vyOrMoving : 0;
        sendAngle = facingAngle;
        sendMoving = !!isMoving;
      }

      this.ws.send(JSON.stringify({
        type: 'move',
        x,
        y,
        vx: sendVx,
        vy: sendVy,
        facingAngle: sendAngle,
        isMoving: sendMoving,
        map: sendMap,
        suitId
      }));
    }
  }

  public sendSuitChange(suitId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'suit_change',
      suitId
    }));
  }

  public sendWeatherChange(weather: string, duration?: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'weather_change',
      weather,
      duration
    }));
  }

  public sendFarmAction(
    actionOrGridX: string | number,
    xOrGridY: number,
    yOrActionType: number | string,
    cropId?: string,
    stage?: number,
    mutation?: string
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    let actionType: string;
    let gridX: number;
    let gridY: number;

    if (typeof actionOrGridX === 'string') {
      actionType = actionOrGridX;
      gridX = xOrGridY;
      gridY = typeof yOrActionType === 'number' ? yOrActionType : 0;
    } else {
      gridX = actionOrGridX;
      gridY = xOrGridY;
      actionType = String(yOrActionType);
    }

    this.ws.send(JSON.stringify({
      type: 'farm_action',
      gridX,
      gridY,
      action: actionType,
      actionType,
      cropId,
      stage,
      mutation
    }));
  }

  public syncExpeditionShells(shells: number, delta: number = 0) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'sync_shells',
      shells,
      delta
    }));
  }

  public on(event: string, cb: NetworkEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(cb);
  }

  public off(event: string, cb: NetworkEventCallback) {
    const arr = this.listeners.get(event);
    if (arr) {
      this.listeners.set(event, arr.filter(fn => fn !== cb));
    }
  }

  private emit(event: string, data: unknown) {
    const arr = this.listeners.get(event);
    if (arr) {
      for (const fn of arr) {
        fn(data);
      }
    }
  }
}

export { NetworkClient as NetworkManager };
