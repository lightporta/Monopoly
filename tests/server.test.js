import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createServer } from '../server/server.js';
import { chooseAIAction } from '../shared/index.js';

async function fixture(t, options = {}) {
  const app = createServer(options);
  const address = await app.listen(0, '127.0.0.1');
  const url = `http://127.0.0.1:${address.port}`;
  const sockets = [];
  t.after(async () => {
    for (const ws of sockets) ws.terminate();
    await app.close();
  });
  async function client(origin) {
    const ws = new WebSocket(`${url.replace('http', 'ws')}/ws`, origin ? { origin } : undefined);
    sockets.push(ws);
    let serial = 0;
    let latest = null;
    const pending = new Map();
    const watchers = new Set();
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'snapshot') {
        latest = msg.payload;
        for (const check of watchers) check();
      }
      if (msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
    });
    await once(ws, 'open');
    function request(type, payload = {}, id = String(++serial)) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout ${type}`));
        }, 2000);
        pending.set(id, (reply) => {
          clearTimeout(timer);
          resolve(reply);
        });
        ws.send(JSON.stringify({ id, type, payload }));
      });
    }
    function wait(predicate, timeout = 3000) {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const check = () => {
          if (latest && predicate(latest)) {
            clearTimeout(timer);
            watchers.delete(check);
            resolve(latest);
          }
        };
        const timer = setTimeout(() => {
          watchers.delete(check);
          reject(new Error('Snapshot timeout'));
        }, timeout);
        watchers.add(check);
      });
    }
    return {
      ws,
      request,
      wait,
      get latest() {
        return latest;
      },
    };
  }
  return { app, url, client };
}
const ok = (result) => {
  assert.equal(result.type, 'ok', JSON.stringify(result));
  return result.payload;
};
const error = (result, expected) => {
  assert.equal(result.type, 'error');
  assert.equal(result.payload.code, expected);
};

async function twoPlayers(f) {
  const a = await f.client();
  const b = await f.client();
  const sa = ok(await a.request('create', { name: '烟台玩家' })).session;
  const sb = ok(await b.request('join', { code: sa.code, name: 'Visitor' })).session;
  ok(await b.request('ready', { ready: true }));
  ok(await a.request('start', { maxRounds: 10 }));
  await b.wait((s) => s.game?.status === 'playing');
  return { a, b, sa, sb };
}

test('two real WebSocket clients share authoritative state and reject invalid/stale commands', async (t) => {
  const f = await fixture(t);
  const { a, b, sa } = await twoPlayers(f);
  assert.deepEqual(a.latest, b.latest);
  assert.equal(a.latest.game.currentPlayerId, sa.playerId);
  assert.equal('seed' in a.latest.game, false);
  assert.equal('rngState' in a.latest.game, false);
  assert.equal(JSON.stringify(a.latest).includes(sa.token), false);
  error(await b.request('action', { revision: 0, action: { type: 'roll' } }), 'NOT_YOUR_TURN');
  error(await a.request('action', { revision: 0, action: { type: 'endTurn' } }), 'ILLEGAL_ACTION');
  error(await b.request('addBot', { difficulty: 'normal' }), 'NOT_HOST');
  const deadline = a.latest.room.turnDeadline;
  const roll = { revision: 0, action: { type: 'roll' } };
  const first = await a.request('action', roll, 'roll-once');
  ok(first);
  await b.wait((s) => s.game?.revision === 1);
  const state = structuredClone(b.latest);
  assert.equal(state.room.turnDeadline, deadline, 'development and roll do not extend the turn');
  assert.deepEqual(await a.request('action', roll, 'roll-once'), first);
  assert.equal(f.app.rooms.get(sa.code).game.revision, 1, 'retried ID is never applied twice');
  error(await a.request('action', { revision: 0, action: { type: 'roll' } }), 'STALE_REVISION');
  error(await a.request('ping', {}, 'roll-once'), 'REQUEST_ID_REUSED');
  assert.deepEqual(a.latest, b.latest);
});

test('room lifecycle enforces readiness, occupancy, host permissions and one membership per socket', async (t) => {
  const f = await fixture(t);
  const a = await f.client();
  const b = await f.client();
  const sa = ok(await a.request('create', { name: 'Host' })).session;
  error(await a.request('create', { name: 'Second room' }), 'ALREADY_IN_ROOM');
  error(await a.request('start'), 'NOT_ENOUGH_PLAYERS');
  const sb = ok(await b.request('join', { code: sa.code, name: 'Other' })).session;
  error(await a.request('start'), 'NOT_READY');
  ok(await a.request('addBot', { difficulty: 'easy' }));
  ok(await a.request('addBot', { difficulty: 'hard' }));
  error(await a.request('addBot', { difficulty: 'normal' }), 'ROOM_FULL');
  const bot = a.latest.room.players.find((p) => p.isAI);
  ok(await a.request('removeBot', { playerId: bot.id }));
  b.ws.close();
  await once(b.ws, 'close');
  await a.wait((s) => s.room.players.find((p) => p.id === sb.playerId)?.connected === false);
  ok(await a.request('removePlayer', { playerId: sb.playerId }));
  assert.equal(a.latest.room.players.length, 2);
  ok(await a.request('start'));
});

test('private reconnect token restores a stable seat, replaces old socket, and preserves migrated host', async (t) => {
  const f = await fixture(t);
  const { a, b, sa, sb } = await twoPlayers(f);
  const intruder = await f.client();
  error(
    await intruder.request('resume', {
      code: sa.code,
      playerId: sa.playerId,
      token: 'wrong-token',
    }),
    'INVALID_SESSION',
  );
  const replacement = await f.client();
  const closed = once(a.ws, 'close');
  const session = ok(await replacement.request('resume', sa)).session;
  assert.deepEqual(session, sa);
  const [closeCode] = await closed;
  assert.equal(closeCode, 4001);
  await b.wait((s) => s.room.players.find((p) => p.id === sa.playerId)?.connected);
  assert.equal(
    b.latest.room.hostId,
    sa.playerId,
    'replacement does not trigger old-socket disconnect migration',
  );
  replacement.ws.close();
  await once(replacement.ws, 'close');
  await b.wait((s) => s.room.hostId === sb.playerId);
  const again = await f.client();
  ok(await again.request('resume', sa));
  assert.equal(
    again.latest.room.hostId,
    sb.playerId,
    'reconnect does not steal the migrated host role',
  );
  assert.equal(again.latest.game.players[0].id, sa.playerId);
  assert.deepEqual(again.latest.game, b.latest.game);
});

test('disconnected turn expires once, AI finishes it, and a returning human resumes next turn', async (t) => {
  const f = await fixture(t, { turnTimeoutMs: 70, botDelayMs: 1 });
  const { a, b, sa, sb } = await twoPlayers(f);
  a.ws.close();
  await once(a.ws, 'close');
  await b.wait((s) => s.game?.currentPlayerId === sb.playerId);
  const recovered = await f.client();
  ok(await recovered.request('resume', sa));
  assert.equal(recovered.latest.room.players.find((p) => p.id === sa.playerId).isAI, false);
  const deadline = recovered.latest.room.turnDeadline;
  while (b.latest.game.currentPlayerId === sb.playerId) {
    const state = f.app.rooms.get(sa.code).game;
    const action = chooseAIAction(state, sb.playerId);
    ok(await b.request('action', { revision: state.revision, action }));
  }
  assert.equal(recovered.latest.game.currentPlayerId, sa.playerId);
  assert.ok(recovered.latest.room.turnDeadline > deadline);
  ok(
    await recovered.request('action', {
      revision: recovered.latest.game.revision,
      action: { type: 'roll' },
    }),
  );
});

test('explicit leave converts only that seat to AI and game runs to a terminal state', async (t) => {
  const f = await fixture(t, { turnTimeoutMs: 6, botDelayMs: 1 });
  const { a, b, sa, sb } = await twoPlayers(f);
  ok(await a.request('leave'));
  await b.wait((s) => s.room.players.find((p) => p.id === sa.playerId)?.isAI);
  assert.equal(b.latest.room.hostId, sb.playerId);
  assert.equal(b.latest.game.players.find((p) => p.id === sa.playerId).isAI, true);
  const stranger = await f.client();
  error(await stranger.request('resume', sa), 'INVALID_SESSION');
  const finished = await b.wait((s) => s.game?.status === 'finished', 5000);
  assert.ok(finished.game.winnerIds.length >= 1);
  assert.equal(finished.room.turnDeadline, null);
  const revision = finished.game.revision;
  error(await b.request('action', { revision, action: { type: 'roll' } }), 'GAME_NOT_ACTIVE');
  ok(await b.request('start', { maxRounds: 10 }));
  assert.equal(b.latest.game.revision, 0);
});

test('empty automated rooms expire even while bots are advancing the game', async (t) => {
  const f = await fixture(t, { botDelayMs: 5, emptyTtlMs: 20, heartbeatMs: 10 });
  const a = await f.client();
  const { session } = ok(await a.request('create', { name: 'Host' }));
  ok(await a.request('addBot', { difficulty: 'normal' }));
  ok(await a.request('start', { maxRounds: 100 }));
  ok(await a.request('leave'));
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(f.app.rooms.has(session.code), false);
});

test('a finished room accepts new human seats and checks readiness before restarting', async (t) => {
  const f = await fixture(t);
  const { a, b, sa, sb } = await twoPlayers(f);
  ok(await a.request('action', { revision: 0, action: { type: 'surrender' } }));
  await b.wait((s) => s.game?.status === 'finished');
  ok(await a.request('leave'));
  await b.wait((s) => s.room.hostId === sb.playerId && s.room.players.length === 1);
  const newcomer = await f.client();
  const session = ok(await newcomer.request('join', { code: sa.code, name: 'New player' })).session;
  assert.notEqual(session.playerId, sa.playerId);
  error(await b.request('start'), 'NOT_READY');
  ok(await newcomer.request('ready', { ready: true }));
  ok(await b.request('start', { maxRounds: 10 }));
  assert.equal(b.latest.game.revision, 0);
  assert.deepEqual(
    b.latest.game.players.map((p) => p.id),
    [sb.playerId, session.playerId],
  );
});

test('HTTP health, cache policy, safe static paths, HEAD and WebSocket origin restriction', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'monopoly-static-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'index.html'), '<h1>Monopoly</h1>');
  const f = await fixture(t, { staticDir: dir });
  const health = await fetch(`${f.url}/healthz`);
  assert.deepEqual(await health.json(), { ok: true, version: 4 });
  const entry = await fetch(`${f.url}/?lang=en`);
  assert.equal(entry.status, 200);
  assert.equal(entry.headers.get('cache-control'), 'no-store');
  assert.match(await entry.text(), /Monopoly/);
  const head = await fetch(f.url, { method: 'HEAD' });
  assert.equal(await head.text(), '');
  assert.equal((await fetch(f.url, { method: 'POST' })).status, 405);
  const location = new URL(f.url);
  const status = await new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: location.hostname, port: location.port, path: '/%2e%2e/server/server.js' },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
  });
  assert.equal(status, 403);
  await f.client(f.url);
  const denied = new WebSocket(`${f.url.replace('http', 'ws')}/ws`, {
    origin: 'https://attacker.example',
  });
  const [err] = await once(denied, 'error');
  assert.match(err.message, /403/);
});
