import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTick } from 'node:timers/promises';
import { OnlineClient } from '../monopoly/src/online/client.js';

// Browser-shaped socket with explicit delivery. Tests control when a reply or
// disconnect arrives, including the gap between a committed command and its ACK.
class FakeWebSocket {
  static OPEN = 1;
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  send(raw) {
    assert.equal(this.readyState, 1);
    const message = JSON.parse(raw);
    this.sent.push(message);
    this.respond?.(message);
  }
  receive(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  close(code = 1000) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    queueMicrotask(() => this.onclose?.({ code }));
  }
  fail() {
    this.onerror?.({});
    this.close(1006);
  }
}
const originalWebSocket = globalThis.WebSocket;
globalThis.WebSocket = FakeWebSocket;
after(() => {
  globalThis.WebSocket = originalWebSocket;
});

const key = 'monopoly-online-v4';
const seat = { code: 'ABCDEF', playerId: 'stable-player', token: 'private-token' };
function storage(initial = null) {
  const values = new Map(initial ? [[key, JSON.stringify(initial)]] : []);
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
}
function fixture(t, initial = null) {
  const snapshots = [],
    statuses = [],
    errors = [],
    sessions = [],
    calls = [];
  const saved = storage(initial);
  const client = new OnlineClient({
    url: 'ws://test.invalid/ws',
    storage: saved,
    onSnapshot: (value) => {
      snapshots.push(value);
      calls.push(['snapshot', value]);
    },
    onStatus: (value) => statuses.push(value),
    onError: (cause) => errors.push(cause.code),
    onSession: (value) => {
      sessions.push(value);
      calls.push(['session', value]);
    },
  });
  t.after(() => client.close());
  return { client, saved, snapshots, statuses, errors, sessions, calls };
}
async function connect(client) {
  const opening = client.connect();
  client.socket.open();
  await opening;
  return client.socket;
}
function reply(socket, request, payload, type = 'ok') {
  queueMicrotask(() => socket.receive({ id: request.id, type, payload }));
}

test('enter publishes the session before the acknowledged snapshot and persists a private per-tab seat', async (t) => {
  const f = fixture(t);
  const entering = f.client.enter('create', { name: 'Traveler' });
  const socket = f.client.socket;
  const snapshot = { room: { code: seat.code }, game: null };
  socket.respond = (request) => reply(socket, request, { session: seat, snapshot });
  socket.open();
  const result = await entering;
  assert.deepEqual(result.session, seat);
  assert.deepEqual(f.sessions, [seat]);
  assert.deepEqual(f.snapshots, [snapshot]);
  assert.deepEqual(f.calls, [
    ['session', seat],
    ['snapshot', snapshot],
  ]);
  assert.deepEqual(JSON.parse(f.saved.getItem(key)), seat);
  assert.deepEqual(socket.sent[0].payload, { name: 'Traveler' });
  assert.deepEqual(f.statuses, ['connecting', 'connected']);
});

test('session replacement (4001) clears the old seat and never schedules a reclaim loop', async (t) => {
  const f = fixture(t, seat);
  const socket = await connect(f.client);
  socket.close(4001);
  await nextTick();
  assert.equal(f.client.session, null);
  assert.equal(f.saved.getItem(key), null);
  assert.equal(f.client.stopped, true);
  assert.equal(f.client.reconnectTimer, undefined);
  assert.deepEqual(f.errors, ['SESSION_REPLACED']);
  assert.deepEqual(f.snapshots, [null]);
  assert.deepEqual(f.sessions, [null]);
});

test('invalid or deleted-room sessions terminate restore and clear all stale UI identity', async (t) => {
  for (const code of ['INVALID_SESSION', 'ROOM_NOT_FOUND']) {
    const f = fixture(t, seat);
    const restoring = f.client.restore();
    const socket = f.client.socket;
    socket.respond = (request) => reply(socket, request, { code }, 'error');
    socket.open();
    await assert.rejects(restoring, (cause) => cause.code === code);
    await nextTick();
    assert.equal(socket.sent[0].type, 'resume');
    assert.deepEqual(socket.sent[0].payload, seat);
    assert.equal(f.client.session, null);
    assert.equal(f.saved.getItem(key), null);
    assert.deepEqual(f.snapshots, [null]);
    assert.deepEqual(f.errors, [code]);
    assert.equal(f.client.stopped, true);
  }
});

test('a disconnect rejects pending actions and reconnection sends only resume, never an uncertain command', async (t) => {
  const f = fixture(t, seat);
  const first = await connect(f.client);
  const action = f.client.request('action', { revision: 4, action: { type: 'roll' } });
  const rejected = assert.rejects(action, (cause) => cause.code === 'CONNECTION_LOST');
  first.close(1006);
  await rejected;
  assert.equal(f.client.pending.size, 0);
  assert.ok(f.statuses.includes('reconnecting'));
  clearTimeout(f.client.reconnectTimer); // Drive the scheduled attempt immediately.
  const restoring = f.client.restore();
  const second = f.client.socket;
  const snapshot = { room: { code: seat.code }, game: { revision: 5 } };
  second.respond = (request) => reply(second, request, { session: seat, snapshot });
  second.open();
  await restoring;
  assert.equal(first.sent.filter((message) => message.type === 'action').length, 1);
  assert.deepEqual(
    second.sent.map((message) => message.type),
    ['resume'],
  );
  assert.deepEqual(f.snapshots.at(-1), snapshot);
});

test('unsolicited room expiration reports the reason, clears the seat and leaves the old snapshot', async (t) => {
  const f = fixture(t, seat);
  const socket = await connect(f.client);
  socket.receive({ type: 'snapshot', payload: { room: { code: seat.code }, game: null } });
  socket.receive({ type: 'error', payload: { code: 'ROOM_EXPIRED' } });
  await nextTick();
  assert.deepEqual(f.errors, ['ROOM_EXPIRED']);
  assert.equal(f.client.session, null);
  assert.equal(f.saved.getItem(key), null);
  assert.equal(f.snapshots.at(-1), null);
  assert.equal(f.client.stopped, true);
});

test('failed first connection can be retried and a successful leave clears the stored seat', async (t) => {
  const f = fixture(t);
  const failed = f.client.connect();
  const rejected = assert.rejects(failed, (cause) => cause.code === 'CONNECTION_LOST');
  f.client.socket.fail();
  await rejected;
  await nextTick();
  const socket = await connect(f.client);
  f.client.save(seat);
  socket.respond = (request) => reply(socket, request, {});
  await f.client.leave();
  await nextTick();
  assert.equal(socket.sent.at(-1).type, 'leave');
  assert.equal(f.client.session, null);
  assert.equal(f.saved.getItem(key), null);
  assert.equal(f.snapshots.at(-1), null);
  assert.equal(f.client.stopped, true);
});
