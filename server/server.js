// 仙境海岸·大富翁 联机版服务端
// WebSocket + HTTP 同进程，房间管理 + 游戏引擎
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameEngine } from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const rooms = new Map();
const clients = new Map();
const reconnectTimers = new Map();

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg'
    };
    // HTML 入口禁止缓存（确保用户每次拿到最新前端，避免旧 WS 配置导致联机失败）；
    // 静态资源允许浏览器缓存（文件名含 hash，内容变更会自动失效）
    const headers = { 'Content-Type': types[ext] || 'application/octet-stream' };
    if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(ws, msg);
    } catch (e) {
      sendError(ws, 'PARSE_ERROR', '消息格式错误');
    }
  });
  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', () => handleDisconnect(ws));
});

function send(ws, type, payload = {}, reqId = null) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, payload, reqId }));
}

function sendError(ws, code, message, reqId = null) {
  send(ws, 'room:error', { code, message }, reqId);
}

function broadcastRoom(roomKey, type, payload = {}) {
  const room = rooms.get(roomKey);
  if (!room) return;
  for (const p of room.players) {
    if (p.ws && p.connected) {
      send(p.ws, type, payload);
    }
  }
}

function getPublicRoomState(room) {
  return {
    roomKey: room.roomKey,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map(p => ({
      playerId: p.playerId,
      playerName: p.playerName,
      seatIndex: p.seatIndex,
      isHost: p.isHost,
      connected: p.connected,
      ready: p.ready || false
    }))
  };
}

function validateRoomKey(key) {
  return /^[A-Za-z0-9]{4,10}$/.test(key);
}

function generatePlayerId() {
  return crypto.randomUUID();
}

function handleMessage(ws, msg) {
  const { type, payload = {}, reqId } = msg;

  switch (type) {
    case 'ping':
      send(ws, 'pong', { t: Date.now() });
      break;
    case 'room:create':
      handleCreate(ws, payload, reqId);
      break;
    case 'room:join':
      handleJoin(ws, payload, reqId);
      break;
    case 'room:leave':
      handleLeave(ws, reqId);
      break;
    case 'room:disband':
      handleDisband(ws, reqId);
      break;
    case 'room:start':
      handleStart(ws, reqId);
      break;
    case 'room:restart':
      handleRestart(ws, reqId);
      break;
    case 'game:action':
      handleGameAction(ws, payload, reqId);
      break;
    default:
      sendError(ws, 'UNKNOWN_TYPE', '未知消息类型');
  }
}

function handleCreate(ws, payload, reqId) {
  const { roomKey, playerName } = payload;
  if (!roomKey || !playerName) {
    return sendError(ws, 'INVALID_PARAMS', '房间号和昵称不能为空', reqId);
  }
  if (!validateRoomKey(roomKey)) {
    return sendError(ws, 'INVALID_KEY', '房间号需4~10位字母数字', reqId);
  }
  if (rooms.has(roomKey)) {
    return sendError(ws, 'ROOM_EXISTS', '该房间已存在', reqId);
  }
  if (playerName.length < 1 || playerName.length > 8) {
    return sendError(ws, 'INVALID_NAME', '昵称1~8字符', reqId);
  }

  const playerId = generatePlayerId();
  const room = {
    roomKey,
    hostId: playerId,
    players: [
      {
        playerId,
        playerName,
        ws,
        isHost: true,
        connected: true,
        seatIndex: 0,
        ready: true,
        joinedAt: Date.now()
      }
    ],
    status: 'waiting',
    gameState: null,
    engine: null,
    createdAt: Date.now(),
    maxPlayers: 4
  };
  rooms.set(roomKey, room);
  clients.set(ws, { playerId, roomKey });

  send(ws, 'room:created', {
    roomKey,
    playerId,
    seatIndex: 0,
    playerName
  }, reqId);
  send(ws, 'room:state', getPublicRoomState(room));
  console.log(`房间创建: ${roomKey}，房主: ${playerName}`);
}

function handleJoin(ws, payload, reqId) {
  const { roomKey, playerName, playerId: oldPlayerId } = payload;
  if (!roomKey || !playerName) {
    return sendError(ws, 'INVALID_PARAMS', '房间号和昵称不能为空', reqId);
  }
  const room = rooms.get(roomKey);
  if (!room) {
    return sendError(ws, 'ROOM_NOT_FOUND', '房间不存在', reqId);
  }
  if (room.status !== 'waiting') {
    return sendError(ws, 'ROOM_PLAYING', '游戏已开始，无法加入', reqId);
  }

  let seatIndex = -1;
  for (let i = 0; i < room.maxPlayers; i++) {
    const p = room.players.find(p => p.seatIndex === i);
    if (!p || !p.connected) {
      seatIndex = i;
      break;
    }
  }
  if (seatIndex === -1) {
    return sendError(ws, 'ROOM_FULL', '房间已满', reqId);
  }

  let playerId = oldPlayerId;
  let existingPlayer = null;
  if (playerId) {
    existingPlayer = room.players.find(p => p.playerId === playerId);
  }

  if (existingPlayer && !existingPlayer.connected) {
    existingPlayer.ws = ws;
    existingPlayer.connected = true;
    existingPlayer.playerName = playerName || existingPlayer.playerName;
    seatIndex = existingPlayer.seatIndex;
    if (reconnectTimers.has(`${roomKey}:${playerId}`)) {
      clearTimeout(reconnectTimers.get(`${roomKey}:${playerId}`));
      reconnectTimers.delete(`${roomKey}:${playerId}`);
    }
  } else {
    playerId = generatePlayerId();
    const newPlayer = {
      playerId,
      playerName,
      ws,
      isHost: false,
      connected: true,
      seatIndex,
      ready: false,
      joinedAt: Date.now()
    };
    room.players.push(newPlayer);
  }

  clients.set(ws, { playerId, roomKey });

  send(ws, 'room:joined', {
    roomKey,
    playerId,
    seatIndex,
    players: getPublicRoomState(room).players
  }, reqId);
  broadcastRoom(roomKey, 'room:state', getPublicRoomState(room));
  console.log(`玩家加入: ${roomKey}，${playerName}`);
}

function handleLeave(ws, reqId) {
  const info = clients.get(ws);
  if (!info) return;
  const { playerId, roomKey } = info;
  const room = rooms.get(roomKey);
  if (!room) return;

  const player = room.players.find(p => p.playerId === playerId);
  if (!player) return;

  if (player.isHost) {
    disbandRoom(room, 'host_disband');
    return;
  }

  player.connected = false;
  player.ws = null;
  clients.delete(ws);

  const connectedPlayers = room.players.filter(p => p.connected);
  if (connectedPlayers.length === 0) {
    rooms.delete(roomKey);
    console.log(`房间销毁: ${roomKey}（无人）`);
  } else if (connectedPlayers.length === 1 && room.status === 'waiting') {
    const host = room.players.find(p => p.isHost && p.connected);
    if (host) {
      send(host.ws, 'game:event', {
        event: 'modal',
        data: { modalId: 'alone_in_room' }
      });
    }
    broadcastRoom(roomKey, 'room:state', getPublicRoomState(room));
  } else {
    broadcastRoom(roomKey, 'room:state', getPublicRoomState(room));
  }

  if (room.status === 'playing' && connectedPlayers.length === 1) {
    const last = connectedPlayers[0];
    if (last) {
      send(last.ws, 'game:event', {
        event: 'modal',
        data: { modalId: 'alone_in_room' }
      });
    }
  }

  console.log(`玩家离开: ${roomKey}，${player.playerName}`);
}

function handleDisband(ws, reqId) {
  const info = clients.get(ws);
  if (!info) return;
  const { playerId, roomKey } = info;
  const room = rooms.get(roomKey);
  if (!room) return;
  if (room.hostId !== playerId) {
    return sendError(ws, 'NOT_HOST', '仅房主可解散房间', reqId);
  }
  disbandRoom(room, 'host_disband');
}

function disbandRoom(room, reason) {
  broadcastRoom(room.roomKey, 'room:disbanded', { reason });
  for (const p of room.players) {
    if (p.ws) clients.delete(p.ws);
    const timerKey = `${room.roomKey}:${p.playerId}`;
    if (reconnectTimers.has(timerKey)) {
      clearTimeout(reconnectTimers.get(timerKey));
      reconnectTimers.delete(timerKey);
    }
  }
  rooms.delete(room.roomKey);
  console.log(`房间销毁: ${room.roomKey}，原因: ${reason}`);
}

function handleStart(ws, reqId) {
  const info = clients.get(ws);
  if (!info) return;
  const { playerId, roomKey } = info;
  const room = rooms.get(roomKey);
  if (!room) return;
  if (room.hostId !== playerId) {
    return sendError(ws, 'NOT_HOST', '仅房主可开始游戏', reqId);
  }
  if (room.status !== 'waiting') {
    return sendError(ws, 'ALREADY_PLAYING', '游戏已开始', reqId);
  }
  const connectedCount = room.players.filter(p => p.connected).length;
  if (connectedCount < 2) {
    return sendError(ws, 'NOT_ENOUGH_PLAYERS', '至少需要2名玩家', reqId);
  }

  const engine = new GameEngine();
  const playerConfigs = room.players
    .filter(p => p.connected)
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map(p => ({ name: p.playerName, seatIndex: p.seatIndex }));

  const gameState = engine.initGame(playerConfigs);
  room.engine = engine;
  room.gameState = gameState;
  room.status = 'playing';

  broadcastRoom(roomKey, 'room:started', {
    gameState,
    playerSeats: room.players
      .filter(p => p.connected)
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map(p => ({ playerId: p.playerId, seatIndex: p.seatIndex, playerName: p.playerName }))
  });
  broadcastRoom(roomKey, 'game:state', gameState);
  console.log(`游戏开始: ${roomKey}`);
}

function handleRestart(ws, reqId) {
  const info = clients.get(ws);
  if (!info) return;
  const { playerId, roomKey } = info;
  const room = rooms.get(roomKey);
  if (!room) return;
  if (room.hostId !== playerId) {
    return sendError(ws, 'NOT_HOST', '仅房主可重新开始', reqId);
  }
  if (room.status !== 'ended') {
    return sendError(ws, 'NOT_ENDED', '游戏未结束', reqId);
  }

  const engine = new GameEngine();
  const playerConfigs = room.players
    .filter(p => p.connected)
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map(p => ({ name: p.playerName, seatIndex: p.seatIndex }));

  const gameState = engine.initGame(playerConfigs);
  room.engine = engine;
  room.gameState = gameState;
  room.status = 'playing';

  broadcastRoom(roomKey, 'room:started', {
    gameState,
    playerSeats: room.players
      .filter(p => p.connected)
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map(p => ({ playerId: p.playerId, seatIndex: p.seatIndex, playerName: p.playerName }))
  });
  broadcastRoom(roomKey, 'game:state', gameState);
  console.log(`游戏重开: ${roomKey}`);
}

function handleGameAction(ws, payload, reqId) {
  const info = clients.get(ws);
  if (!info) return;
  const { playerId, roomKey } = info;
  const room = rooms.get(roomKey);
  if (!room || room.status !== 'playing' || !room.engine) {
    return sendError(ws, 'GAME_NOT_ACTIVE', '游戏未进行中', reqId);
  }

  const player = room.players.find(p => p.playerId === playerId);
  if (!player || !player.connected) {
    return sendError(ws, 'PLAYER_NOT_FOUND', '玩家不存在', reqId);
  }

  const sortedPlayers = room.players
    .filter(p => p.connected)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const playerIndex = sortedPlayers.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    return sendError(ws, 'PLAYER_NOT_FOUND', '玩家不在游戏中', reqId);
  }

  const { action, params } = payload;
  const result = room.engine.handleGameAction(playerIndex, action, params || {});

  if (result.error) {
    return sendError(ws, 'ACTION_FAILED', result.error, reqId);
  }

  const newState = result.state || room.engine.getState();
  room.gameState = newState;

  broadcastRoom(roomKey, 'game:state', newState);

  if (newState.phase === 'ended' && newState.winner) {
    room.status = 'ended';
    broadcastRoom(roomKey, 'game:ended', {
      winner: newState.winner.name,
      winnerId: newState.winner.id,
      winReason: newState.winReason,
      ranking: newState.players
        .map(p => ({ name: p.name, cash: p.cash, bankrupt: p.bankrupt }))
        .sort((a, b) => b.cash - a.cash)
    });
  }
}

function handleDisconnect(ws) {
  const info = clients.get(ws);
  if (!info) return;
  const { playerId, roomKey } = info;
  const room = rooms.get(roomKey);
  if (!room) return;

  const player = room.players.find(p => p.playerId === playerId);
  if (!player) return;

  player.connected = false;
  player.ws = null;
  clients.delete(ws);

  const timerKey = `${roomKey}:${playerId}`;
  const timeout = setTimeout(() => {
    const r = rooms.get(roomKey);
    if (!r) return;
    const p = r.players.find(pp => pp.playerId === playerId);
    if (p && !p.connected) {
      r.players = r.players.filter(pp => pp.playerId !== playerId);
      const connectedCount = r.players.filter(pp => pp.connected).length;
      if (connectedCount === 0) {
        rooms.delete(roomKey);
        console.log(`房间销毁: ${roomKey}（超时无人）`);
      } else if (p.isHost) {
        disbandRoom(r, 'host_disconnect');
      } else {
        broadcastRoom(roomKey, 'room:state', getPublicRoomState(r));
        if (r.status === 'playing' && connectedCount === 1) {
          const last = r.players.find(pp => pp.connected);
          if (last) {
            send(last.ws, 'game:event', {
              event: 'modal',
              data: { modalId: 'alone_in_room' }
            });
          }
        }
      }
      reconnectTimers.delete(timerKey);
      console.log(`玩家超时移除: ${roomKey}，${p.playerName}`);
    }
  }, 30000);
  reconnectTimers.set(timerKey, timeout);

  const connectedCount = room.players.filter(p => p.connected).length;
  if (connectedCount > 0) {
    broadcastRoom(roomKey, 'room:state', getPublicRoomState(room));
  }
  console.log(`连接断开: ${roomKey}，${player.playerName}`);
}

server.listen(PORT, () => {
  console.log(`🚀 仙境海岸·大富翁 联机服务器启动`);
  console.log(`📍 HTTP: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`📁 静态文件目录: ${PUBLIC_DIR}`);
});
