import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createGame, applyAction, chooseAIAction } from '../shared/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HASHED_ASSET = /[.-][\w-]{8,}\.(js|css|woff2|png|svg)$/;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const digest = (token) => createHash('sha256').update(token).digest();
function envNumber(key, fallback, minimum, maximum) {
  if (!process.env[key]) return fallback;
  const value = Number(process.env[key]);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`);
  return value;
}

/** A single-process, in-memory authoritative room server. No listening side effect. */
export function createServer(options = {}) {
  const staticDir = path.resolve(options.staticDir ?? path.join(HERE, '../monopoly/dist'));
  const turnTimeoutMs =
    options.turnTimeoutMs ?? envNumber('TURN_TIMEOUT_MS', 60_000, 1000, 600_000);
  const botDelayMs = options.botDelayMs ?? 200;
  const emptyTtlMs = options.emptyTtlMs ?? 30 * 60_000;
  const idleTtlMs = options.idleTtlMs ?? 24 * 60 * 60_000;
  const maxRooms = options.maxRooms ?? 500;
  const maxConnections = options.maxConnections ?? 500;
  const allowedOrigins =
    options.allowedOrigins ??
    (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  const rooms = new Map();
  const connections = new Map();
  let closing = false;

  const server = http.createServer(async (req, res) => {
    const baseHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    };
    const finish = (status, body) => {
      res.writeHead(status, {
        ...baseHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return finish(405, 'Method not allowed');
    }
    let pathname;
    try {
      pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
    } catch {
      return finish(400, 'Invalid path');
    }
    if (pathname === '/healthz') {
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, version: 4 }));
    }
    if (
      !pathname.startsWith('/') ||
      pathname.includes('\\') ||
      pathname.includes('\0') ||
      pathname.split('/').includes('..')
    )
      return finish(403, 'Forbidden');
    const file = path.resolve(staticDir, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(staticDir + path.sep)) return finish(403, 'Forbidden');
    try {
      const info = await stat(file);
      if (!info.isFile()) return finish(404, 'Not found');
      const ext = path.extname(file);
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control':
          ext === '.html'
            ? 'no-store'
            : HASHED_ASSET.test(path.basename(file))
              ? 'public, max-age=31536000, immutable'
              : 'no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      req.on('aborted', () => stream.destroy());
      stream.pipe(res);
    } catch {
      finish(404, 'Build the frontend with npm run build first.');
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 16_384 });
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    let permitted = !origin;
    if (origin) {
      try {
        permitted = allowedOrigins.length
          ? allowedOrigins.includes(origin)
          : new URL(origin).host === req.headers.host;
      } catch {
        permitted = false;
      }
    }
    if (closing || req.url !== '/ws' || !permitted || connections.size >= maxConnections) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });

  function send(ws, value) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1_048_576) return ws.close(1009, 'Slow client');
    ws.send(JSON.stringify(value));
  }
  function snapshot(room) {
    let game = null;
    if (room.game) {
      const { seed, rngState, ...publicState } = room.game;
      game = publicState;
    }
    return {
      room: {
        code: room.code,
        hostId: room.hostId,
        status: room.game?.status ?? 'waiting',
        players: room.players.map((p) => ({
          id: p.id,
          name: p.name,
          connected: Boolean(p.ws?.readyState === WebSocket.OPEN),
          ready: p.ready,
          isAI: p.isAI,
          difficulty: p.difficulty,
        })),
        turnDeadline: room.turnDeadline,
      },
      game,
    };
  }
  function broadcast(room) {
    const payload = snapshot(room);
    for (const p of room.players) if (p.ws) send(p.ws, { type: 'snapshot', payload });
  }
  function migrateHost(room) {
    const host = room.players.find((p) => p.id === room.hostId);
    if (!host?.isAI && host?.ws?.readyState === WebSocket.OPEN) return;
    room.hostId =
      room.players.find((p) => !p.isAI && p.ws?.readyState === WebSocket.OPEN)?.id ??
      room.players.find((p) => !p.isAI)?.id ??
      null;
    const newHost = room.players.find((p) => p.id === room.hostId);
    if (newHost) newHost.ready = true;
  }
  function clearRoomTimer(room) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  function activeMember(ws) {
    const context = connections.get(ws);
    const room = rooms.get(context?.code);
    const player = room?.players.find((p) => p.id === context?.playerId && p.ws === ws);
    if (!room || !player) fail('NOT_IN_ROOM');
    return { room, player };
  }
  function requireHost(room, player) {
    if (room.hostId !== player.id) fail('NOT_HOST');
  }
  function touch(room) {
    room.updatedAt = Date.now();
  }
  function advance(room, playerId, action) {
    // Online dice get fresh, private entropy for every roll. A guessed PRNG state
    // cannot predict the next turn; the shared offline engine remains replayable.
    // An invalid command never commits even this private randomness.
    const input =
      action.type === 'roll' ? { ...room.game, rngState: randomInt(1, 0x100000000) } : room.game;
    room.game = applyAction(input, playerId, action);
  }
  function schedule(room) {
    clearRoomTimer(room);
    if (!room.game || room.game.status !== 'playing') {
      room.turnDeadline = null;
      return;
    }
    const id = room.game.currentPlayerId;
    const player = room.players.find((p) => p.id === id);
    if (!player) return;
    if (room.turnPlayerId !== id || room.turnRound !== room.game.round) {
      room.turnPlayerId = id;
      room.turnRound = room.game.round;
      room.turnDeadline = Date.now() + turnTimeoutMs;
      room.autoTurnId = null;
    }
    const automatic = player.isAI || room.autoTurnId === id;
    const delay = automatic ? botDelayMs : Math.max(0, room.turnDeadline - Date.now());
    room.timer = setTimeout(() => {
      if (closing || !rooms.has(room.code) || room.game?.status !== 'playing') return;
      room.autoTurnId = room.game.currentPlayerId;
      try {
        const next = chooseAIAction(
          room.game,
          room.game.currentPlayerId,
          player.difficulty ?? 'normal',
        );
        advance(room, room.game.currentPlayerId, next);
        touch(room);
        schedule(room);
        broadcast(room);
      } catch (error) {
        clearRoomTimer(room);
        for (const member of room.players)
          if (member.ws) send(member.ws, { type: 'error', payload: { code: 'ENGINE_ERROR' } });
        if (options.onError) options.onError(error);
        else console.error('Automatic turn failed:', error.code ?? error.message);
      }
    }, delay);
    room.timer.unref?.();
  }
  function sessionReply(room, player, token) {
    return { session: { code: room.code, playerId: player.id, token }, snapshot: snapshot(room) };
  }
  function bind(ws, room, player) {
    const previous = player.ws;
    if (previous && previous !== ws) {
      const old = connections.get(previous);
      if (old) {
        old.code = null;
        old.playerId = null;
      }
      player.ws = null;
      previous.close(4001, 'Session resumed elsewhere');
    }
    const context = connections.get(ws);
    context.code = room.code;
    context.playerId = player.id;
    player.ws = ws;
    room.emptySince = null;
    touch(room);
  }
  function ensureDetached(ws) {
    if (connections.get(ws)?.code) fail('ALREADY_IN_ROOM');
  }
  function name(value) {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      [...value.trim()].length > 20 ||
      /[\u0000-\u001f\u007f]/.test(value)
    )
      fail('INVALID_NAME');
    return value.trim();
  }
  function code(value) {
    if (typeof value !== 'string' || !/^[A-Z2-9]{6}$/.test(value.toUpperCase()))
      fail('INVALID_CODE');
    return value.toUpperCase();
  }
  function makePlayer(playerName, isAI = false, difficulty = 'normal') {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      player: {
        id: randomUUID(),
        name: playerName,
        tokenHash: isAI ? null : digest(token),
        isAI,
        difficulty,
        ready: true,
        ws: null,
      },
    };
  }
  function handle(ws, type, payload) {
    if (type === 'ping') return { time: Date.now() };
    if (type === 'create') {
      ensureDetached(ws);
      if (rooms.size >= maxRooms) fail('SERVER_FULL');
      const playerName = name(payload.name);
      let roomCode;
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      do {
        roomCode = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
      } while (rooms.has(roomCode));
      const { player, token } = makePlayer(playerName);
      const room = {
        code: roomCode,
        hostId: player.id,
        players: [player],
        game: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emptySince: null,
        timer: null,
        turnDeadline: null,
        turnPlayerId: null,
        turnRound: null,
        autoTurnId: null,
      };
      rooms.set(roomCode, room);
      bind(ws, room, player);
      broadcast(room);
      return sessionReply(room, player, token);
    }
    if (type === 'join') {
      ensureDetached(ws);
      const room = rooms.get(code(payload.code));
      if (!room) fail('ROOM_NOT_FOUND');
      if (room.game?.status === 'playing') fail('GAME_ACTIVE');
      if (room.players.length >= 4) fail('ROOM_FULL');
      const { player, token } = makePlayer(name(payload.name));
      player.ready = false;
      room.players.push(player);
      bind(ws, room, player);
      migrateHost(room);
      broadcast(room);
      return sessionReply(room, player, token);
    }
    if (type === 'resume') {
      ensureDetached(ws);
      const room = rooms.get(code(payload.code));
      if (!room) fail('ROOM_NOT_FOUND');
      const player = room.players.find((p) => p.id === payload.playerId && !p.isAI);
      if (
        !player?.tokenHash ||
        typeof payload.token !== 'string' ||
        payload.token.length > 128 ||
        !timingSafeEqual(player.tokenHash, digest(payload.token))
      )
        fail('INVALID_SESSION');
      bind(ws, room, player);
      migrateHost(room);
      broadcast(room);
      return sessionReply(room, player, payload.token);
    }
    const { room, player } = activeMember(ws);
    if (type === 'leave') {
      connections.get(ws).code = null;
      connections.get(ws).playerId = null;
      player.ws = null;
      player.tokenHash = null;
      if (room.game?.status === 'playing') {
        player.isAI = true;
        room.game = {
          ...room.game,
          revision: room.game.revision + 1,
          players: room.game.players.map((p) => (p.id === player.id ? { ...p, isAI: true } : p)),
        };
      } else room.players = room.players.filter((p) => p !== player);
      migrateHost(room);
      if (!room.players.some((p) => !p.isAI && p.ws?.readyState === WebSocket.OPEN))
        room.emptySince ??= Date.now();
      touch(room);
      schedule(room);
      broadcast(room);
      return {};
    }
    if (type === 'ready') {
      if (room.game?.status === 'playing') fail('GAME_ACTIVE');
      if (typeof payload.ready !== 'boolean') fail('BAD_MESSAGE');
      player.ready = room.hostId === player.id ? true : payload.ready;
    } else if (type === 'addBot') {
      requireHost(room, player);
      if (room.game?.status === 'playing') fail('GAME_ACTIVE');
      if (room.players.length >= 4) fail('ROOM_FULL');
      if (!['easy', 'normal', 'hard'].includes(payload.difficulty)) fail('BAD_MESSAGE');
      const bot = makePlayer(
        `AI ${room.players.filter((p) => p.isAI).length + 1}`,
        true,
        payload.difficulty,
      ).player;
      room.players.push(bot);
    } else if (type === 'removeBot') {
      requireHost(room, player);
      if (room.game?.status === 'playing') fail('GAME_ACTIVE');
      const bot = room.players.find((p) => p.id === payload.playerId && p.isAI);
      if (!bot) fail('PLAYER_UNKNOWN');
      room.players = room.players.filter((p) => p !== bot);
    } else if (type === 'removePlayer') {
      requireHost(room, player);
      if (room.game?.status === 'playing') fail('GAME_ACTIVE');
      const target = room.players.find(
        (p) => p.id === payload.playerId && !p.isAI && !p.ws && p.id !== player.id,
      );
      if (!target) fail('PLAYER_UNKNOWN');
      target.tokenHash = null;
      room.players = room.players.filter((p) => p !== target);
    } else if (type === 'start') {
      requireHost(room, player);
      if (room.game?.status === 'playing') fail('GAME_ACTIVE');
      if (room.players.length < 2) fail('NOT_ENOUGH_PLAYERS');
      if (room.players.some((p) => !p.isAI && (!p.ready || p.ws?.readyState !== WebSocket.OPEN)))
        fail('NOT_READY');
      const maxRounds = payload.maxRounds ?? 40;
      if (!Number.isInteger(maxRounds) || maxRounds < 10 || maxRounds > 100) fail('BAD_MESSAGE');
      room.game = createGame({
        players: room.players.map((p) => ({
          id: p.id,
          name: p.name,
          isAI: p.isAI,
          difficulty: p.difficulty,
        })),
        seed: randomBytes(16).toString('hex'),
        maxRounds,
      });
      room.turnPlayerId = null;
      room.turnRound = null;
    } else if (type === 'action') {
      if (!room.game || room.game.status !== 'playing') fail('GAME_NOT_ACTIVE');
      if (!Number.isInteger(payload.revision) || payload.revision !== room.game.revision)
        fail('STALE_REVISION');
      if (!payload.action || typeof payload.action !== 'object' || Array.isArray(payload.action))
        fail('INVALID_ACTION');
      if (room.autoTurnId === player.id) fail('TURN_AUTOPLAY');
      advance(room, player.id, payload.action);
    } else fail('UNKNOWN_TYPE');
    touch(room);
    schedule(room);
    broadcast(room);
    return {};
  }

  wss.on('connection', (ws) => {
    const context = {
      code: null,
      playerId: null,
      cache: new Map(),
      tokens: 60,
      refill: Date.now(),
      alive: true,
    };
    connections.set(ws, context);
    ws.on('pong', () => {
      context.alive = true;
    });
    ws.on('message', (raw, binary) => {
      let msg;
      try {
        if (binary) fail('BAD_MESSAGE');
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, { type: 'error', payload: { code: 'BAD_MESSAGE' } });
      }
      const id = msg?.id;
      if (typeof id !== 'string' || !id || id.length > 64)
        return send(ws, { type: 'error', payload: { code: 'BAD_MESSAGE' } });
      const fingerprint = raw.toString();
      const cached = context.cache.get(id);
      if (cached)
        return send(
          ws,
          cached.fingerprint === fingerprint
            ? cached.reply
            : { id, type: 'error', payload: { code: 'REQUEST_ID_REUSED' } },
        );
      const now = Date.now();
      context.tokens = Math.min(60, context.tokens + (now - context.refill) / 100);
      context.refill = now;
      let reply;
      try {
        if (context.tokens < 1) fail('RATE_LIMIT');
        context.tokens -= 1;
        if (
          typeof msg.type !== 'string' ||
          msg.payload === null ||
          (msg.payload !== undefined &&
            (typeof msg.payload !== 'object' || Array.isArray(msg.payload)))
        )
          fail('BAD_MESSAGE');
        reply = { id, type: 'ok', payload: handle(ws, msg.type, msg.payload ?? {}) };
      } catch (error) {
        reply = { id, type: 'error', payload: { code: error.code ?? 'INVALID_ACTION' } };
      }
      context.cache.set(id, { fingerprint, reply });
      if (context.cache.size > 128) context.cache.delete(context.cache.keys().next().value);
      send(ws, reply);
    });
    ws.on('close', () => {
      const room = rooms.get(context.code);
      const player = room?.players.find((p) => p.id === context.playerId && p.ws === ws);
      connections.delete(ws);
      if (!player) return;
      player.ws = null;
      migrateHost(room);
      if (!room.players.some((p) => !p.isAI && p.ws?.readyState === WebSocket.OPEN))
        room.emptySince ??= Date.now();
      broadcast(room);
    });
    ws.on('error', () => {});
  });
  const heartbeat = setInterval(() => {
    for (const [ws, context] of connections) {
      if (!context.alive) {
        ws.terminate();
        continue;
      }
      context.alive = false;
      ws.ping();
    }
    const now = Date.now();
    for (const [id, room] of rooms) {
      if (
        (room.emptySince && now - room.emptySince > emptyTtlMs) ||
        now - room.updatedAt > idleTtlMs
      ) {
        clearRoomTimer(room);
        for (const player of room.players)
          if (player.ws) {
            const context = connections.get(player.ws);
            if (context) {
              context.code = null;
              context.playerId = null;
            }
            send(player.ws, { type: 'error', payload: { code: 'ROOM_EXPIRED' } });
          }
        rooms.delete(id);
      }
    }
  }, options.heartbeatMs ?? 30_000);
  heartbeat.unref?.();

  return {
    server,
    wss,
    rooms,
    listen(port = Number(process.env.PORT ?? 3000), host = process.env.HOST ?? '0.0.0.0') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve(server.address());
        });
      });
    },
    async close() {
      if (closing) return;
      closing = true;
      clearInterval(heartbeat);
      for (const room of rooms.values()) clearRoomTimer(room);
      for (const ws of connections.keys()) ws.terminate();
      await new Promise((resolve) => wss.close(resolve));
      if (server.listening) await new Promise((resolve) => server.close(resolve));
      rooms.clear();
      connections.clear();
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createServer();
  app
    .listen()
    .then((address) => console.log(`Monopoly v4 listening on port ${address.port}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => app.close().then(() => process.exit()));
}
