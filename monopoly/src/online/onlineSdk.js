// 联机版 SDK - WebSocket 通信封装
class OnlineSDK {
  constructor() {
    this.ws = null;
    this.playerId = localStorage.getItem('monopoly_playerId') || this._uuid();
    localStorage.setItem('monopoly_playerId', this.playerId);
    this.roomKey = null;
    this.isHost = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.heartbeatInterval = null;
    this.debug = new URLSearchParams(window.location.search).has('debug');
  }

  _uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  _log(...args) {
    if (this.debug) console.log('[OnlineSDK]', ...args);
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      // 先清理旧连接
      this._stopHeartbeat();
      if (this.ws) {
        try { this.ws.onclose = null; this.ws.close(); } catch (e) {}
        this.ws = null;
      }

      let settled = false;
      try {
        this.ws = new WebSocket(url);

        // 连接超时：5 秒未连上则拒绝
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            this._log('连接超时');
            try { this.ws.close(); } catch (e) {}
            this.ws = null;
            reject(new Error('连接超时，请检查网络或服务器是否运行'));
          }
        }, 5000);

        this.ws.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this._log('连接成功');
          this.reconnectAttempts = 0;
          this._startHeartbeat();
          resolve();
        };
        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this._handleMessage(msg);
          } catch (e) {
            this._log('消息解析失败', e);
          }
        };
        this.ws.onerror = (err) => {
          this._log('连接错误', err);
          // onerror 后通常会触发 onclose，由 onclose 统一 reject
        };
        this.ws.onclose = () => {
          this._log('连接关闭');
          this._stopHeartbeat();
          if (!settled) {
            // 连接还没建立就关闭了 = 连接失败
            settled = true;
            clearTimeout(timeout);
            this.ws = null;
            reject(new Error('连接被拒绝，服务器可能未运行或端口未开放'));
            return;
          }
          // 已建立的连接断开
          this.ws = null;
          this._emit('disconnect', {});
        };
      } catch (e) {
        if (!settled) {
          settled = true;
          reject(e);
        }
      }
    });
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', { t: Date.now() });
      }
    }, 15000);
  }

  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  _handleMessage(msg) {
    const { type, payload } = msg;
    this._log('收到消息', type, payload);

    if (type === 'room:created') {
      this.roomKey = payload.roomKey;
      this.isHost = true;
      // 用服务端分配的 playerId 覆盖本地 UUID（确保与 playerSeats 匹配）
      if (payload.playerId) {
        this.playerId = payload.playerId;
        localStorage.setItem('monopoly_playerId', this.playerId);
      }
    } else if (type === 'room:joined') {
      this.roomKey = payload.roomKey;
      // 用服务端分配的 playerId 覆盖本地 UUID
      if (payload.playerId) {
        this.playerId = payload.playerId;
        localStorage.setItem('monopoly_playerId', this.playerId);
      }
    } else if (type === 'room:disbanded') {
      this.roomKey = null;
      this.isHost = false;
    }

    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(cb => cb(payload));
    }
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => cb(type, payload));
    }
  }

  on(event, cb) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event);
    const idx = list.indexOf(cb);
    if (idx > -1) list.splice(idx, 1);
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  send(type, payload = {}) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this._log('连接未就绪，无法发送', type);
      return false;
    }
    this._log('发送消息', type, payload);
    this.ws.send(JSON.stringify({ type, payload }));
    return true;
  }

  createRoom(roomKey, playerName) {
    return this.send('room:create', { roomKey, playerName });
  }

  joinRoom(roomKey, playerName) {
    return this.send('room:join', { roomKey, playerName, playerId: this.playerId });
  }

  leaveRoom() {
    return this.send('room:leave', {});
  }

  disbandRoom() {
    return this.send('room:disband', {});
  }

  startGame() {
    return this.send('room:start', {});
  }

  restartGame() {
    return this.send('room:restart', {});
  }

  sendGameAction(action, params = {}) {
    return this.send('game:action', { action, params });
  }

  /** 联机交易确认：卖方回应（同意/拒绝） */
  respondTrade(accepted) {
    return this.send('trade:respond', { accepted });
  }

  disconnect() {
    this._stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.roomKey = null;
    this.isHost = false;
  }

  getPlayerName() {
    return localStorage.getItem('monopoly_playerName') || '';
  }

  setPlayerName(name) {
    localStorage.setItem('monopoly_playerName', name);
  }
}

export const onlineSDK = new OnlineSDK();
export default OnlineSDK;
