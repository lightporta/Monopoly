# 《仙境海岸·大富翁》联机版改造 — AI Agent 编码任务提示词

> **目标文件**：`index.html`（用户已有的 Vue 3 单文件构建产物，已压缩）
> **改造范围**：在不破坏现有单机逻辑的前提下，新增联机版与同一设备版两条入口，联机版基于 WebSocket + Node.js 服务端实现多人多房间对战
> **联机规模**：支持多个房间并行，每个房间最多 4 名真人玩家跨设备
> **服务端**：独立 Node.js 进程，部署在云端（用户电脑关机后仍可运行）

---

## 一、技术选型与架构总览

### 1.1 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端运行时 | Vue 3（已存在于 index.html） | 不替换框架，仅注入联机模块 |
| 实时通信 | 原生 WebSocket（浏览器内置） | 不引第三方库，避免改造打包流程 |
| 服务端 | Node.js ≥ 18 + `ws` 库 | 单文件 `server.js`，零依赖额外框架 |
| 房间管理 | 内存 Map（非持久化） | 房间状态在服务端内存中维护，进程重启即清空 |
| 玩家身份 | `playerId`（UUID v4，客户端生成存 localStorage）+ `playerName` | 不做账号体系 |
| 部署 | 云服务器（VPS / PaaS） | 见用户任务清单 |

### 1.2 架构图

```
┌──────────────────────────────────────────────────────────────┐
│  云端 VPS（24h 在线）                                          │
│  ┌────────────────────────────┐                              │
│  │  Node.js 进程               │                              │
│  │  ├─ HTTP 静态服务 (index.html) │   ← 同时托管前端页面        │
│  │  └─ WebSocket Server (ws)    │   ← 处理实时房间逻辑         │
│  │     ├─ rooms: Map<roomKey, Room>                         │
│  │     └─ clients: Map<ws, Player>                         │
│  └────────────────────────────┘                              │
└──────────────┬───────────────────────────────────────────────┘
               │ wss://...
       ┌───────┼───────┬───────┐
       ▼       ▼       ▼       ▼
    设备 A   设备 B   设备 C   设备 D
    (房主)  (玩家2)  (玩家3)  (玩家4)
```

### 1.3 通信协议总则

- **传输层**：WebSocket 文本帧，每帧一个 JSON 对象
- **消息结构**：
  ```json
  { "type": "消息类型", "payload": { ... }, "reqId": "可选-用于请求响应配对" }
  ```
- **服务端权威**：所有游戏状态变更必须经服务端广播，客户端只发起动作请求，不直接修改他人可见状态
- **失败反馈**：服务端收到非法请求时回 `{ type: "error", payload: { code, message } }`

---

## 二、入口改造：主菜单分流

### 2.1 现状

当前 index.html 在「与真人玩」入口下直接进入本地多人配置页（共享同一设备）。

### 2.2 改造目标

在点击「与真人玩」后，弹出**二级选择页**，提供两张大卡片：

| 卡片 | 标题 | 副标题 | 图标 |
|---|---|---|---|
| 卡片 A | **联机版** | 不同设备、输入房间 Key 加入 | 🌐 |
| 卡片 B | **同一设备版** | 多人轮流使用本设备 | 📱 |

- 卡片 B 走原有本地多人逻辑，**保持完全不变**
- 卡片 A 进入新的「联机大厅」页面

### 2.3 联机大厅页面（新增）

布局为单列居中卡片，包含：

1. **玩家昵称输入框**（必填，1~8 字符，存 localStorage 下次自动填充）
2. **两个 Tab**：
   - **创建房间**：输入自定义房间 Key（4~10 位字母数字），点击「创建」→ 成为房主 → 进入房间等待页
   - **加入房间**：输入已有房间 Key + 自己昵称，点击「加入」→ 进入房间等待页
3. **返回按钮**：回到主菜单
4. **错误提示区**：显示「房间已存在」「房间不存在」「房间已满（4人）」「该 Key 已被使用」等

### 2.4 房间 Key 规则

- 长度 4~10 字符，仅允许 `[A-Za-z0-9]`
- 服务端校验唯一性，重复创建返回错误
- 房间在房主解散或所有玩家离开后释放，Key 可被重新使用
- Key 大小写敏感（建议提示用户「区分大小写」）

---

## 三、房间状态机与服务端逻辑

### 3.1 房间对象结构（服务端内存）

```js
const Room = {
  roomKey: "ABCD1234",
  hostId: "uuid-玩家1",          // 房主 playerId，创建时锁定
  players: [                     // 顺序数组，下标即座位号 0~3
    {
      playerId: "uuid-xxx",
      playerName: "张三",
      ws: <WebSocket 对象>,
      isHost: true,
      connected: true,
      seatIndex: 0,
      ready: true,               // 房主默认就绪
      joinedAt: 1700000000000
    }
    // ...最多 4 个
  ],
  status: "waiting",             // waiting | playing | ended
  gameState: null,               // 游戏进行中时存放完整游戏快照
  createdAt: 1700000000000,
  maxPlayers: 4
};
```

### 3.2 房间状态机

```
   ┌─────────┐  房主点击开始   ┌─────────┐  游戏结束     ┌─────────┐
   │ waiting │ ──────────────► │ playing │ ────────────► │  ended  │
   └─────────┘                 └─────────┘               └────┬────┘
        ▲                           ▲                         │
        │                           │                         │
        └──── 房主再来一局 ──────────┴─────────────────────────┘
```

### 3.3 WebSocket 消息协议（完整清单）

#### 3.3.1 客户端 → 服务端

| type | payload | 触发场景 |
|---|---|---|
| `room:create` | `{ roomKey, playerName }` | 创建房间 |
| `room:join` | `{ roomKey, playerName }` | 加入房间 |
| `room:leave` | `{}` | 主动离开房间（玩家点「离开房间」） |
| `room:disband` | `{}` | 房主点「解散房间」 |
| `room:ready` | `{ ready: bool }` | 切换准备状态（可选，V1 可省略，房主随时可开始） |
| `room:start` | `{}` | 房主点「开始游戏」 |
| `room:restart` | `{}` | 房主点「再来一局」（ended 状态下） |
| `game:action` | `{ action: "roll" \| "buy" \| "build" \| "mortgage" \| "redeem" \| "trade" \| "endTurn" \| "useCard" \| ..., params: {...} }` | 游戏内所有玩家操作 |
| `ping` | `{ t: Date.now() }` | 心跳，每 15s 一次 |

#### 3.3.2 服务端 → 客户端

| type | payload | 说明 |
|---|---|---|
| `room:created` | `{ roomKey, playerId, seatIndex }` | 创建成功 |
| `room:joined` | `{ roomKey, playerId, seatIndex, players: [...] }` | 加入成功 |
| `room:state` | `{ players: [...], status, hostId }` | 房间状态变更广播（玩家进出、准备状态） |
| `room:error` | `{ code, message }` | 房间相关错误 |
| `room:disbanded` | `{ reason: "host_disband" \| "all_left" }` | 房间被解散，所有玩家收到 |
| `room:started` | `{ gameState }` | 游戏开始，下发初始快照 |
| `game:state` | `{ gameState }` | 游戏中状态广播（每次 action 后） |
| `game:event` | `{ event: "modal" \| "toast" \| "animation", data }` | 服务端触发的 UI 事件（如弹窗） |
| `game:ended` | `{ winner, ranking }` | 游戏结束 |
| `pong` | `{ t }` | 心跳响应 |

### 3.4 关键服务端规则

1. **房主判定**：`room.hostId` 在创建时锁定为创建者 `playerId`，不转移。房主退出则房间解散（不可让位）。
2. **座位号**：按加入顺序 0、1、2、3，离场后**不重排**（保留空位避免错乱），新加入者填补最小空位。
3. **断线处理**：
   - 玩家 WebSocket 断开时标记 `connected: false`，不立即移除
   - 30 秒内重连（同 `playerId`）则恢复，期间游戏暂停（playing 状态）
   - 30 秒未重连则视为离开，广播 `room:state`
4. **房间过期**：`waiting` 状态下若所有玩家离开，房间立即销毁；`playing` 状态下若仅剩 1 人且未结束，触发「1 人无法玩」弹窗。
5. **Key 释放**：房间销毁后 `roomKey` 立即可被重新创建。

---

## 四、房间等待页 UI（waiting 状态）

### 4.1 布局

```
┌──────────────────────────────────────────────┐
│  房间 Key: ABCD1234   [复制]                  │
│  状态: 等待玩家加入...                         │
├──────────────────────────────────────────────┤
│  座位 1 (房主)  👑 张三    [已就绪]            │
│  座位 2         李四      [已就绪]            │
│  座位 3         (空)      [等待加入]          │
│  座位 4         (空)      [等待加入]          │
├──────────────────────────────────────────────┤
│  [开始游戏](仅房主可点，≥2人才亮)  [离开/解散] │
└──────────────────────────────────────────────┘
```

### 4.2 交互规则

- 房主右下角按钮文案为「解散房间」，普通玩家为「离开房间」
- 「开始游戏」按钮：仅房主可见且可点，需 ≥2 名玩家才启用
- 房主可随时点「开始游戏」，无需所有人准备（V1 简化）
- 顶部「复制」按钮一键复制房间 Key 到剪贴板，方便分享

---

## 五、游戏进行中 UI 与按钮控制（playing 状态）

### 5.1 顶部新增条

游戏内顶部增加一行联机状态条：

```
🏠 房间: ABCD1234  |  👥 在线: 3/4  |  👑 房主: 张三  |  [离开房间] / [解散房间]
```

### 5.2 按钮控制矩阵

| 按钮 | 普通玩家 | 房主 | 备注 |
|---|---|---|---|
| 掷骰 | 仅自己回合可点 | 同左 | 服务端校验回合归属 |
| 购买/建造/抵押 | 仅自己回合 | 同左 | — |
| 重置 | **禁用**（联机版无单机重置） | **禁用** | 联机版重置由「再来一局」承担 |
| 离开房间 | ✅ 可点 | — | 文案为「离开房间」 |
| 解散房间 | — | ✅ 可点 | 文案为「解散房间」 |
| 结束回合 | 仅自己回合 | 同左 | — |

### 5.3 操作防抖

- 每个按钮点击后立即禁用 200ms，等待服务端 `game:state` 回来后再根据新状态决定是否启用
- 防止玩家连点导致重复 action

---

## 六、关键弹窗与流程（按用户需求逐条实现）

### 6.1 弹窗组件规范

所有弹窗使用统一的 `Modal` 组件，特性：

- 模态遮罩，**不可点击背景关闭**
- 至少一个明确按钮（「我已知晓」「确认」「取消」等）
- 居中显示，最大宽度 480px，移动端全宽减 32px

### 6.2 弹窗清单

#### 弹窗 A：玩家主动离开房间（普通玩家点「离开房间」）

- **触发**：普通玩家点击「离开房间」
- **流程**：
  1. 客户端弹确认框「确定离开当前房间？你的本局记录将被清空」
  2. 玩家点「确认」→ 发送 `room:leave` → 服务端移除该玩家 → 广播 `room:state` 给剩余玩家
  3. 离开者客户端：关闭 WebSocket，清空本地游戏状态，**返回主界面**（不弹其他提示）
  4. 剩余玩家：收到 `room:state`，UI 上该座位变为「(空) 等待加入」

#### 弹窗 B：房主解散房间（房主点「解散房间」）

- **触发**：房主点「解散房间」
- **流程**：
  1. 房主客户端弹确认框「你是房主，解散将使所有玩家退出。确定解散？」
  2. 房主点「确认」→ 发送 `room:disband` → 服务端向所有玩家广播 `room:disbanded { reason: "host_disband" }` → 销毁房间
  3. **房主客户端**：弹窗「你已解散该房间」+ [我已知晓] 按钮 → 点击后关闭 WebSocket、清空状态、回主界面
  4. **其他玩家客户端**：弹窗「房主已解散房间」+ [我已知晓] 按钮 → 点击后关闭 WebSocket、清空状态、回主界面

#### 弹窗 C：仅剩房主一人（玩家陆续离开后）

- **触发**：服务端检测到 `room.players.filter(p => p.connected).length === 1 && room.status === "waiting"` 或 `playing`
- **流程**：
  1. 服务端向房主发送 `game:event { event: "modal", data: { modalId: "alone_in_room" } }`
  2. 房主客户端弹窗：「1 人无法游戏，请选择」+ 两个按钮：
     - **「解散该房间」**：同弹窗 B 流程，弹「你已解散该房间」→ 回主界面
     - **「等待他人进入」**：弹窗关闭，**所有游戏内按钮置灰不可点**（仅「解散房间」按钮可点），游戏状态保留但暂停
  3. 等待期间若有新玩家加入：
     - 服务端广播 `room:state`，房主客户端收到后所有按钮重新启用
     - 游戏继续（waiting 状态下房主可重新点「开始游戏」；playing 状态下从断点继续）
  4. 等待期间房主点「解散房间」：同弹窗 B 流程，**且游戏状态重置**（再来一局逻辑）

#### 弹窗 D：游戏结束

- **触发**：服务端判定胜利条件达成 → 广播 `game:ended`
- **流程**：所有玩家屏幕显示结算页（胜者头像、资产排名）
- **按钮区**：
  - 房主：「再来一局」「解散房间」
  - 普通玩家：「等待再来一局」「退出房间」
- **按钮行为**：
  - 房主点「再来一局」：发送 `room:restart` → 服务端重置 `gameState`，广播 `room:started`，所有未退出的玩家进入新局
  - 房主点「解散房间」：**强制执行**，同弹窗 B
  - 普通玩家点「退出房间」：同弹窗 A（仅自己退出，弹「房主已解散」？**否**，玩家主动退出不弹该提示，直接回主界面）
  - 普通玩家点「等待再来一局」：按钮变灰显示「等待房主开始...」，不发送任何消息，等房主操作
- **并发处理**：
  - 多个普通玩家点「退出房间」互不影响，每个独立退出
  - 房主点「解散房间」时若有玩家正在点「退出房间」，房主解散优先，所有玩家强制退出并弹「房主已解散」

#### 弹窗 E：断线重连提示

- **触发**：WebSocket `onclose` 或 `onerror`
- **流程**：弹窗「连接中断，正在尝试重连... (剩余 30s)」+ 进度条
- 30 秒内重连成功：弹窗关闭，发送 `room:join`（带原 `playerId`）恢复
- 30 秒超时：弹窗变「重连失败，请重新进入」+ [回主界面] 按钮

#### 弹窗 F：被踢出/房间不存在

- **触发**：服务端返回 `room:error { code: "ROOM_NOT_FOUND" | "ROOM_FULL" | "KICKED" }`
- **流程**：弹窗显示对应错误信息 + [回主界面] 按钮

### 6.3 弹窗优先级

```
系统级（解散/断线） > 业务级（购买/建造） > 提示级（Toast）
```

同一时刻只显示一个系统级弹窗，业务级弹窗在系统级弹窗关闭后再显示。

---

## 七、服务端实现规格（`server.js`）

### 7.1 文件结构

```
server/
├── server.js          # 主入口，HTTP + WebSocket 同进程
├── package.json
├── public/
│   └── index.html     # 用户提供的游戏文件（联机版注入后）
└── README.md
```

### 7.2 `package.json`

```json
{
  "name": "monopoly-yantai-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "ws": "^8.16.0"
  }
}
```

### 7.3 `server.js` 核心结构（伪代码）

```js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const rooms = new Map();       // roomKey -> Room
const clients = new Map();     // ws -> { playerId, roomKey }

// HTTP 静态服务
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const html = fs.readFileSync(path.join('public', 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end();
  }
});

// WebSocket 服务
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    handleMessage(ws, msg);
  });
  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', () => handleDisconnect(ws));
});

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'room:create': return handleCreate(ws, msg.payload);
    case 'room:join':   return handleJoin(ws, msg.payload);
    case 'room:leave':  return handleLeave(ws);
    case 'room:disband':return handleDisband(ws);
    case 'room:start':  return handleStart(ws);
    case 'room:restart':return handleRestart(ws);
    case 'game:action': return handleGameAction(ws, msg.payload);
    case 'ping':        return ws.send(JSON.stringify({ type: 'pong', payload: { t: Date.now() } }));
  }
}

// 关键函数实现要点：
// - handleCreate: 校验 roomKey 唯一性 + 格式；创建 Room，hostId = 生成新 playerId
// - handleJoin: 校验房间存在 + 未满 + status === waiting；分配 seatIndex
// - handleLeave: 从 players 数组移除；广播 room:state；若移除后只剩 0 人则销毁；若只剩 1 人且为房主则触发弹窗 C
// - handleDisband: 仅 hostId 可调用；广播 room:disbanded；销毁房间
// - handleStart: 仅 hostId 可调用；调用游戏引擎初始化 gameState；广播 room:started
// - handleGameAction: 校验当前回合玩家 === 发起者；调用引擎执行；广播 game:state
// - handleDisconnect: 标记 connected=false；30s 后移除；广播 room:state
```

### 7.4 游戏引擎位置

**关键决策**：游戏引擎逻辑必须**同时存在**于前端和服务端，但服务端为权威：

- **前端引擎**：保留 index.html 中现有的 Vue 游戏逻辑，负责本地动画、UI 渲染、玩家输入收集
- **服务端引擎**：将游戏核心规则（掷骰、移动、过路费、卡牌、胜负判定）抽取为纯 JS 函数，放在 `server/engine.js`
- **同步策略**：
  - 玩家点「掷骰」→ 前端发 `game:action { action: "roll" }`
  - 服务端执行 `engine.roll()` → 得到点数 + 新状态
  - 服务端广播 `game:state { gameState }`
  - 所有客户端收到后用 `gameState` 覆盖本地状态 → 触发 Vue 重渲染 + 动画

### 7.5 安全与限流

- 每个连接每秒最多发送 10 条消息，超限断开
- `roomKey` 必须服务端二次校验（不信任客户端）
- `playerId` 由服务端在 `room:create` / `room:join` 时生成并返回，客户端不可伪造他人 ID
- 游戏动作校验当前回合玩家身份，越权操作返回 `error`

---

## 八、前端改造实施步骤（agent 执行）

### 8.1 总体策略

由于 `index.html` 是 Vite 构建产物（压缩 + 模块化），**不建议反编译重构**。采用**包装层注入**策略：

1. 保留原 index.html 完整内容不动
2. 在 `</body>` 前注入一个新的 `<script type="module">`，挂载联机模块
3. 联机模块通过 DOM 操作劫持「与真人玩」按钮，插入二级选择页
4. 联机模式下的游戏界面复用原游戏的 DOM 结构与 Vue 实例，通过 postMessage / 自定义事件驱动

### 8.2 详细步骤

#### 步骤 1：注入联机 SDK

创建 `online-sdk.js`（约 800~1200 行），结构：

```js
// online-sdk.js
class OnlineSDK {
  constructor() {
    this.ws = null;
    this.playerId = localStorage.getItem('playerId') || crypto.randomUUID();
    localStorage.setItem('playerId', this.playerId);
    this.roomKey = null;
    this.isHost = false;
    this.listeners = new Map();
  }

  connect(url) { /* 建立 WebSocket */ }
  on(event, cb) { /* 订阅事件 */ }
  emit(type, payload) { /* 发送消息 */ }

  createRoom(roomKey, playerName) { ... }
  joinRoom(roomKey, playerName) { ... }
  leaveRoom() { ... }
  disbandRoom() { ... }
  startGame() { ... }
  restartGame() { ... }
  sendGameAction(action, params) { ... }

  disconnect() { ... }
}
```

#### 步骤 2：注入联机 UI 层

在原页面之上叠加一个 Vue 3 应用（独立于原游戏的 Vue 实例），负责：

- 二级选择页（联机版 / 同一设备版）
- 联机大厅页（创建/加入房间）
- 房间等待页
- 联机状态条（游戏中顶部）
- 所有弹窗（A~F）

UI 层通过 Shadow DOM 或独立 `#online-root` 挂载，避免样式污染原游戏。

#### 步骤 3：桥接原游戏

通过 `MutationObserver` 监听原游戏 DOM：

- 检测「与真人玩」按钮被点击 → 拦截 → 显示二级选择页
- 检测游戏进入主界面 → 隐藏联机状态条
- 检测游戏结束 → 显示弹窗 D

通过 `CustomEvent` 与原游戏通信：

```js
// 监听原游戏的掷骰事件
window.addEventListener('game:roll', (e) => {
  sdk.sendGameAction('roll', e.detail);
});

// 服务端状态回来后驱动原游戏
sdk.on('game:state', (state) => {
  window.dispatchEvent(new CustomEvent('game:applyState', { detail: state }));
});
```

> **注意**：原游戏若未暴露事件接口，需要在不修改原文件的前提下，通过劫持 `XMLHttpRequest` / `fetch` / 全局变量等方式注入钩子。这一步需 agent 实际分析 index.html 后决定具体注入点。

#### 步骤 4：禁用联机模式下的本地操作

联机模式下，原游戏的「掷骰」「购买」等按钮需根据服务端下发的「当前回合玩家 ID」决定是否可点：

```js
sdk.on('game:state', (state) => {
  const isMyTurn = state.currentPlayerId === sdk.playerId;
  toggleGameButtons(isMyTurn);
});
```

非自己回合时，所有操作按钮 `disabled = true`，`pointer-events: none`。

#### 步骤 5：注入产物

最终交付为一个新的 `index.html`，结构：

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 原 head 内容保留 -->
</head>
<body>
  <!-- 原 body 内容（原 index.html 全部）保留 -->

  <!-- 联机模块挂载点 -->
  <div id="online-root"></div>

  <!-- 联机 SDK -->
  <script type="module" src="./online-sdk.js"></script>
  <!-- 联机 UI（内联或外链） -->
  <script type="module" src="./online-ui.js"></script>
</body>
</html>
```

### 8.3 兼容性保证

- 「同一设备版」入口完全不动原游戏逻辑
- 「联机版」入口的所有改动通过包装层实现，**不修改原 index.html 已有代码**
- 若 WebSocket 连接失败，弹窗提示并提供「切换到同一设备版」选项

---

## 九、按钮与文案清单（严格按用户需求）

### 9.1 主菜单 → 与真人玩 → 二级选择

| 按钮 | 文案 | 行为 |
|---|---|---|
| 卡片 A | 联机版 | 进入联机大厅 |
| 卡片 B | 同一设备版 | 进入原本地多人配置 |
| 返回 | ← 返回 | 回主菜单 |

### 9.2 联机大厅

| 按钮 | 文案 | 行为 |
|---|---|---|
| Tab 1 | 创建房间 | 切换到创建表单 |
| Tab 2 | 加入房间 | 切换到加入表单 |
| 创建 | 创建房间 | 调用 `createRoom` |
| 加入 | 加入房间 | 调用 `joinRoom` |
| 返回 | ← 返回主菜单 | 回主菜单 |

### 9.3 房间等待页

| 按钮 | 文案（房主） | 文案（普通玩家） | 行为 |
|---|---|---|---|
| 开始 | 开始游戏 | （不显示） | 房主发起 `room:start` |
| 退出 | 解散房间 | 离开房间 | 房主→弹窗 B；玩家→弹窗 A |
| 复制 Key | 复制房间 Key | 复制房间 Key | 写入剪贴板 |

### 9.4 游戏中

| 按钮 | 文案（房主） | 文案（普通玩家） | 行为 |
|---|---|---|---|
| 顶部退出 | 解散房间 | 离开房间 | 同上 |
| 重置 | （隐藏） | （隐藏） | 联机版无单机重置 |

### 9.5 游戏结束

| 按钮 | 文案（房主） | 文案（普通玩家） |
|---|---|---|
| 重开 | 再来一局 | 等待再来一局 |
| 退出 | 解散房间 | 退出房间 |

### 9.6 弹窗按钮

| 弹窗 | 按钮 |
|---|---|
| A 玩家离开确认 | 取消 / 确认离开 |
| B 房主解散确认 | 取消 / 确认解散 |
| B 解散后（房主） | 我已知晓 |
| B 解散后（玩家） | 我已知晓 |
| C 仅剩房主 | 解散该房间 / 等待他人进入 |
| D 游戏结束 | （见 9.5） |
| E 断线重连 | （自动） / 回主界面 |
| F 错误 | 回主界面 |

---

## 十、测试用例清单（agent 自测）

agent 完成编码后需自测以下场景：

1. **创建加入**：A 创建房间 KEY123 → B/C/D 通过 KEY123 加入 → 房间显示 4 人
2. **房主开始**：房主点开始游戏 → 4 人同时进入游戏界面
3. **回合同步**：A 掷骰得 5 → B/C/D 屏幕 A 的棋子移动 5 格
4. **越权拦截**：B 在 A 回合点掷骰 → 按钮禁用 / 服务端拒绝
5. **玩家离开**：B 点「离开房间」→ B 回主界面，A/C/D 看到 B 座位变空，游戏继续
6. **房主解散**：A 点「解散房间」→ 所有玩家弹「房主已解散」，A 弹「你已解散该房间」
7. **仅剩房主**：B/C/D 全部离开 → A 弹「1 人无法玩」→ 点「等待他人进入」→ A 的按钮全灰，仅「解散房间」可点 → E 加入 → A 按钮恢复
8. **再来一局**：游戏结束 → 房主点「再来一局」→ 所有人进入新局；同时另一玩家点「退出房间」→ 该玩家回主界面，其余人正常新局
9. **房主强解**：游戏结束 → 房主点「解散房间」→ 所有玩家强制退出，即使有人正点「退出房间」
10. **断线重连**：A 拔网线 20s → 弹「重连中」→ 恢复网络 → 重连成功，游戏继续
11. **多房间并行**：A+B 在房间 X，C+D 在房间 Y → 互不影响
12. **Key 复用**：A 解散房间 KEY123 → E 立即创建 KEY123 → 成功

---

## 十一、交付物清单

agent 需交付以下文件（打包为 zip 或目录）：

```
monopoly-online/
├── index.html                 # 改造后的游戏文件（原文件 + 联机注入）
├── online-sdk.js              # 联机 SDK
├── online-ui.js               # 联机 UI（Vue 3 应用）
├── online-styles.css          # 联机 UI 样式（避免污染原游戏）
├── server/
│   ├── server.js              # Node.js 服务端
│   ├── engine.js              # 服务端游戏引擎（规则权威）
│   ├── package.json
│   └── public/
│       └── index.html         # 同上（服务端托管用）
├── README.md                  # 部署与运行说明
└── CHANGELOG.md               # 改动记录
```

`README.md` 需包含：
- 本地开发启动方式（`node server/server.js` + 浏览器访问 `localhost:3000`）
- 云端部署方式（见用户任务清单）
- 联机流程演示（两个浏览器窗口测试）
- 已知限制（如断线 30s 超时、不支持存档恢复等）

---

## 十二、约束与禁止

1. **禁止**修改原 index.html 中已有的 Vue 应用代码（避免破坏单机功能）
2. **禁止**引入 jQuery / React / 其他大型库（保持轻量）
3. **禁止**使用 localStorage 存储游戏进度（联机模式状态在服务端）
4. **必须**支持移动端 H5（响应式布局，触控友好）
5. **必须**在所有弹窗按钮上添加 `aria-label`
6. **必须**对 WebSocket 消息做 try-catch，避免服务端异常导致客户端崩溃
7. **必须**在 `console.log` 中输出联机调试信息（可通过 `?debug=1` URL 参数开启）

---

> **任务结束**
> agent 完成后请在 `CHANGELOG.md` 中记录改动点，并在 `README.md` 顶部声明已通过第十条的所有自测用例。

---
*AI生成*
