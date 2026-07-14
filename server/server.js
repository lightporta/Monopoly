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
  const room = rooms.get(info.roomKey);
  if (!room) return;
  // 主动离开：清理 ws 映射后走统一退出逻辑
  handlePlayerExit(room, info.playerId, 'leave');
}

/**
 * 统一玩家退出/解散处理（waiting/playing/ended 三阶段同一套逻辑）。
 * - 房主退出 = 解散房间（全员回首页 + 提示）
 * - 普通玩家退出：
 *   - playing 阶段：引擎移除玩家（地产归银行+补位），广播 player:left + game:state
 *   - waiting/ended 阶段：从 room.players 移除，广播 room:state
 *   - 剩余<=1人（仅房主）：房主回等待界面
 *   - 剩余0人：房间销毁
 */
function handlePlayerExit(room, playerId, reason) {
  const player = room.players.find(p => p.playerId === playerId);
  if (!player) return;
  const roomKey = room.roomKey;
  const playerName = player.playerName;

  // 清理该玩家的 ws 映射与重连定时器
  if (player.ws) clients.delete(player.ws);
  const timerKey = `${roomKey}:${playerId}`;
  if (reconnectTimers.has(timerKey)) {
    clearTimeout(reconnectTimers.get(timerKey));
    reconnectTimers.delete(timerKey);
  }

  // 房主退出/解散 = 解散整个房间（三阶段一致）
  if (player.isHost) {
    disbandRoom(room, reason === 'leave' ? 'host_disband' : reason);
    return;
  }

  // 普通玩家退出：从 room.players 移除
  room.players = room.players.filter(p => p.playerId !== playerId);

  // playing 阶段：引擎同步移除该玩家
  if (room.status === 'playing' && room.engine) {
    const sortedConnected = room.players
      .filter(p => p.connected)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    // 找到退出者在引擎中对应的 playerIndex（基于原排序快照）
    // 引擎内 playerIndex = 开局时 connected 排序后的下标；退出后需重算
    // 直接通知剩余玩家：广播 player:left + 新状态（引擎 removePlayer 已处理）
    // 注意：需用退出前的引擎 playerIndex 调 removePlayer
    const engineResult = room.engine.removePlayer(player._engineIndex ?? -1);
    room.gameState = engineResult.state || room.engine.getState();
    // 通知剩余玩家
    broadcastRoom(roomKey, 'player:left', { playerName, reason });
    broadcastRoom(roomKey, 'game:state', room.gameState);

    const connectedCount = room.players.filter(p => p.connected).length;
    if (connectedCount <= 1) {
      // 仅剩房主或无人：游戏结束，房主回等待界面
      const survivor = room.players.find(p => p.connected);
      if (survivor && survivor.isHost) {
        room.status = 'waiting';
        room.engine = null;
        room.gameState = null;
        broadcastRoom(roomKey, 'room:returned_to_lobby', getPublicRoomState(room));
      } else {
        rooms.delete(roomKey);
        console.log(`房间销毁: ${roomKey}（退出后无人）`);
      }
    }
    console.log(`玩家退出(游戏中): ${roomKey}，${playerName}`);
    return;
  }

  // waiting/ended 阶段：广播 room:state
  const connectedCount = room.players.filter(p => p.connected).length;
  if (connectedCount === 0) {
    rooms.delete(roomKey);
    console.log(`房间销毁: ${roomKey}（无人）`);
  } else {
    broadcastRoom(roomKey, 'player:left', { playerName, reason });
    broadcastRoom(roomKey, 'room:state', getPublicRoomState(room));
  }
  console.log(`玩家离开: ${roomKey}，${playerName}`);
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
  // 参与游戏的玩家按座位排序，引擎用数组下标作为 playerIndex
  const sortedConnected = room.players
    .filter(p => p.connected)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  // 记录每个玩家在引擎中的 playerIndex（removePlayer 时需要）
  sortedConnected.forEach((p, i) => { p._engineIndex = i; });
  const playerConfigs = sortedConnected.map(p => ({ name: p.playerName, seatIndex: p.seatIndex }));

  const gameState = engine.initGame(playerConfigs);
  room.engine = engine;
  room.gameState = gameState;
  room.status = 'playing';

  broadcastRoom(roomKey, 'room:started', {
    gameState,
    playerSeats: sortedConnected.map(p => ({ playerId: p.playerId, seatIndex: p.seatIndex, playerName: p.playerName }))
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
  const sortedConnected = room.players
    .filter(p => p.connected)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  sortedConnected.forEach((p, i) => { p._engineIndex = i; });
  const playerConfigs = sortedConnected.map(p => ({ name: p.playerName, seatIndex: p.seatIndex }));

  const gameState = engine.initGame(playerConfigs);
  room.engine = engine;
  room.gameState = gameState;
  room.status = 'playing';

  broadcastRoom(roomKey, 'room:started', {
    gameState,
    playerSeats: sortedConnected.map(p => ({ playerId: p.playerId, seatIndex: p.seatIndex, playerName: p.playerName }))
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
    // 30s 未重连：统一走 handlePlayerExit（移除玩家/解散房间）
    if (p && !p.connected) {
      reconnectTimers.delete(timerKey);
      handlePlayerExit(r, playerId, 'disconnect_timeout');
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
