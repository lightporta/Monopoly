const sessionKey = 'monopoly-online-v4';
const error = (code) => Object.assign(new Error(code), { code });

/** One connection owns one seat. Commands are never replayed after reconnect. */
export class OnlineClient {
  constructor({ onSnapshot, onStatus, onError, onSession, storage = sessionStorage, url } = {}) {
    this.onSnapshot = onSnapshot ?? (() => {});
    this.onStatus = onStatus ?? (() => {});
    this.onError = onError ?? (() => {});
    this.onSession = onSession ?? (() => {});
    this.storage = storage;
    this.url = url ?? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
    this.pending = new Map();
    this.sequence = 0;
    this.retry = 0;
    try {
      this.session = JSON.parse(storage.getItem(sessionKey));
    } catch {
      this.session = null;
    }
  }
  save(session) {
    this.session = session;
    this.onSession(session);
    try {
      session
        ? this.storage.setItem(sessionKey, JSON.stringify(session))
        : this.storage.removeItem(sessionKey);
    } catch {
      /* Storage is optional. */
    }
  }
  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.opening) return this.opening;
    this.stopped = false;
    this.onStatus(this.session ? 'reconnecting' : 'connecting');
    const socket = (this.socket = new WebSocket(this.url));
    this.opening = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(error('TIMEOUT'));
      }, 8000);
      socket.onopen = () => {
        clearTimeout(timer);
        this.retry = 0;
        this.onStatus('connected');
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(error('CONNECTION_LOST'));
      };
      socket.onclose = (event) => {
        clearTimeout(timer);
        reject(error('CONNECTION_LOST'));
        if (this.socket !== socket) return;
        this.opening = null;
        this.onStatus('offline');
        for (const request of this.pending.values()) {
          clearTimeout(request.timer);
          request.reject(error('CONNECTION_LOST'));
        }
        this.pending.clear();
        if (event.code === 4001) {
          this.stopped = true;
          this.save(null);
          this.onSnapshot(null);
          this.onError(error('SESSION_REPLACED'));
          return;
        }
        if (!this.stopped && this.session) this.scheduleReconnect();
      };
      socket.onmessage = ({ data }) => {
        if (this.socket !== socket) return;
        let message;
        try {
          message = JSON.parse(data);
        } catch {
          return;
        }
        if (message.type === 'snapshot') this.onSnapshot(message.payload);
        if (message.type === 'error' && !message.id) {
          this.onError(error(message.payload.code));
          if (message.payload.code === 'ROOM_EXPIRED') {
            this.save(null);
            this.close();
            this.onSnapshot(null);
          }
          return;
        }
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        clearTimeout(request.timer);
        message.type === 'error'
          ? request.reject(error(message.payload.code))
          : request.resolve(message.payload);
      };
    });
    this.opening.catch(() => {});
    return this.opening;
  }
  request(type, payload = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(error('CONNECTION_LOST'));
    const id = `${Date.now()}-${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(error('TIMEOUT'));
      }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, type, payload }));
    });
  }
  async enter(type, payload) {
    await this.connect();
    const result = await this.request(type, payload);
    this.save(result.session);
    this.onSnapshot(result.snapshot);
    return result;
  }
  async restore() {
    if (!this.session) return;
    try {
      await this.enter('resume', this.session);
    } catch (cause) {
      if (['INVALID_SESSION', 'ROOM_NOT_FOUND'].includes(cause.code)) {
        this.save(null);
        this.close();
        this.onSnapshot(null);
      }
      this.onError(cause);
      throw cause;
    }
  }
  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    this.onStatus('reconnecting');
    this.reconnectTimer = setTimeout(
      () => this.restore().catch(() => {}),
      Math.min(10000, 600 * 2 ** this.retry++),
    );
  }
  async leave() {
    if (this.socket?.readyState === WebSocket.OPEN) await this.request('leave');
    else throw error('CONNECTION_LOST');
    this.save(null);
    this.close();
    this.onSnapshot(null);
  }
  close() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }
}
