# 更新日志

## v3.0.0 - 四大海洋板块 + UI 优化（2026-07-13）

### 新增功能 — 四大海洋板块（不破坏原玩法）

#### 🛢️ 海工装备系统
- 4 件装备：海洋钻井平台(海岸线+30%)、深海机器人(仙山+30%)、海洋监测船(免疫台风赤潮)、海上风电塔(每回合+300)
- 4 处装备供应点：芝罘湾广场/渔人码头/天马栈桥/烟台蓬莱国际机场
- 玩家必须拥有供应点地标才能购买；过路费 = 基础 × 色块 × 建筑 × 装备系数

#### 🐚 海产养殖系统
- 4 处养殖地产：长岛(海参)/养马岛(扇贝)/万鸟岛(海带)/月亮湾(鲍鱼)
- 3 级养殖场：育苗场(L1)→养殖场(L2)→深海牧场(L3)
- 每经过起点结算收益；与房屋互斥；受生态减益影响

#### 💼 核电投资系统
- 3 个项目：海阳核电1号/2号机组(高风险高回报)、海上风电场(低风险)
- 左下方固定「💼 投资核电」按钮入口
- 每回合开始分红；D_E4 核事故卡触发付救援费+停发分红

#### 🌿 海洋生态系统
- 全局生态指数(0~100，初始50)，4 档阈值：优良/正常/预警/危机
- 新增 12 张生态卡(6 机会+6 命运)，向现有牌堆追加
- TopBar 生态徽章显示；影响养殖收益与核电分红

#### 🎫 重掷券（决策点）
- 集齐任一色块奖励 1 张重掷券（最多 3 张）
- 自己回合可使用，获得额外掷骰机会

### UI 优化
- 🎨 **棋子悬浮到格子外侧**：新增 TokenLayer 独立图层，棋子不再被格内 overflow:hidden 裁剪
- 🎨 **补全 6 种棋子**：新增 tokens.json，清理重复硬编码（原仅 4 种，补全蓬莱阁🏯/帆船⛵）
- 📜 **日志增强**：四大板块日志带专属图标着色 + 导出 .txt 功能
- 🌿 **生态徽章**：TopBar 实时显示生态指数，点击查看详情

### 规则完善
- 明确胜利条件：破产胜利(优先) + 仙境铁三角胜利(抵押不影响)
- 结算总资产纳入四大板块估值（养殖场+装备+投资成本）

### 新建文件（15 个）
- 数据：`equipment.json`、`nuclear-investments.json`、`ecology-config.json`、`tokens.json`
- 引擎：`Equipment.ts`、`Aquaculture.ts`、`NuclearInvest.ts`、`Ecology.ts`
- 组件：`TokenLayer.vue`、`EquipmentModal.vue`、`AquacultureModal.vue`、`InvestModal.vue`、`EcologyDetailModal.vue`
- 文档：`docs/design/game-design-v3.md`

### 修改文件（16 个）
- 数据：`properties.json`(+aquaculture)、`cards-chance.json`(+6生态卡)、`cards-destiny.json`(+6生态卡)、`game-config.json`(+四板块配置)
- 引擎：`types.ts`、`Game.ts`、`RentCalculator.ts`、`Bankruptcy.ts`、`AIPlayer.ts`
- 状态：`gameStore.ts`
- 视图：`HomeView.vue`、`GameView.vue`
- 组件：`BoardMap.vue`、`BoardCell.vue`、`TopBar.vue`、`ActionButtons.vue`、`GameLog.vue`、`BuildModal.vue`

### 技术特点
- 核心铁律：36 格棋盘结构不变，四板块以"扩展"方式接入
- 过路费公式以乘法叠加装备系数，原色块/建筑逻辑零改动
- 胜利条件(VictoryChecker)完全未改
- 类型检查通过，构建成功

### 已知限制
- 服务端 `server/engine.js` 未同步四板块逻辑（联机模式暂不同步，标注为待办）
- 服务端/前端引擎数据已分叉（propertyRef 命名不一致）

---

## v2.0.0 - 联机版改造

### 新增功能
- 🌐 **联机模式**：支持 2-4 名玩家跨设备联机对战
- 🏠 **房间系统**：创建/加入房间，房间 Key 管理
- ⏳ **房间等待页**：显示玩家列表、房主标识、开始游戏
- 📱 **二级选择**：「与真人玩」分为「联机版」和「同一设备版」
- 💬 **实时同步**：WebSocket 实时同步游戏状态
- 🔄 **断线重连**：30 秒内断线自动重连机制

### 服务端新增
- `server/server.js` - Node.js 服务端主程序（HTTP + WebSocket）
- `server/engine.js` - 服务端游戏引擎（规则权威）
- `server/data.js` - 游戏数据配置
- `server/package.json` - 服务端依赖配置

### 前端新增
- `src/online/onlineSdk.js` - 联机 SDK（WebSocket 通信封装）
- `src/online/onlineSdk.d.ts` - TypeScript 类型声明
- `src/stores/onlineStore.ts` - Pinia 联机状态管理
- `src/views/OnlineLobbyView.vue` - 联机大厅页面
- `src/views/OnlineRoomView.vue` - 房间等待页

### 修改文件
- `src/views/HomeView.vue` - 添加真人模式二级选择页
- `src/stores/gameStore.ts` - 添加联机模式支持
- `src/router/index.ts` - 添加联机路由
- `README.md` - 更新项目说明和部署文档

### 技术特点
- 服务端权威：所有游戏状态变更由服务端广播
- 多房间并行：支持多个房间同时运行
- 内存管理：房间状态在内存中维护，进程重启即清空
- 单文件前端：使用 vite-plugin-singlefile 构建为单 HTML

### 已知限制
- 联机游戏内完整交互逻辑待完善（当前为基础框架）
- 房间状态非持久化，服务器重启后丢失
- 暂不支持账号系统，使用 UUID 标识玩家
- 游戏结束后的「再来一局」待完善

---

## v1.0.0 - 初始版本
- 单机版大富翁游戏
- 真人对战（同一设备）和人机对战模式
- 2-4 名玩家支持
- 完整游戏规则：掷骰、移动、购买、建造、卡牌等
