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
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
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
        };
        this.ws.onclose = () => {
          this._log('连接关闭');
          this._stopHeartbeat();
          this._emit('disconnect', {});
        };
      } catch (e) {
        reject(e);
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
    } else if (type === 'room:joined') {
      this.roomKey = payload.roomKey;
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
