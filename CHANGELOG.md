# 更新日志

## v3.6.0 - 联机回合流转彻底修复 + 移动端退出逻辑（2026-07-14）

### 联机回合三个根因修复
1. **服务端 rollDice 状态错乱**（根因）：落格设 pendingEvent 后非双数时立即 nextTurn() 切换 currentPlayerIndex，导致广播状态 currentPlayerIndex=新玩家 但 pendingEvent=旧玩家。修复：nextTurn 仅在 `!isDouble && !pendingEvent` 时调用，交互事件由 endTurn 触发（与单机一致）
2. **前端按钮卡死**（根因）：canRollDice/canManageAssets/canSkipTurn 用未过滤的 pendingModal，别人的 pendingEvent 锁住自己按钮。修复：改用 `noBlockingModal`（`!pendingModal || isMyPendingEvent`），别人的事件不锁我的按钮
3. **服务端 phase 状态机缺失**：引擎从不设 phase='event'。修复：handleCellLanding 设 pendingEvent 时同步 phase='event'；buy/decline/payRent/teleport/endTurn 清 pendingEvent 时 phase='idle'

### 移动端退出逻辑
- 游戏界面 TopBar：联机+移动端隐藏"退出"按钮（用系统手势划出即可）
- 联机大厅 OnlineRoomView：游戏进行中显示"▶️ 继续游戏"+"🚪 退出房间"两个按钮
- 划出/关闭联机大厅 = 退出房间（onUnmounted 自动发 room:leave，与点"退出房间"逻辑一致）

### 前端弹窗双保险
- BuyPropertyModal/CardModal/TeleportSelectModal/LandedOnOpponentModal 的 visible 改用 interactivePendingModal（与 GameView v-if 过滤一致）

---

## v3.5.1 - 联机回合隔离修复（服务端权威校验）（2026-07-14）

### 核心修复：服务端统一回合校验
- **根因**：`server/engine.js handleGameAction` 计算了 `isMyTurn` 但 switch 里从未使用——只有 rollDice/endTurn 自校验，其他 17 个 action（buy/build/mortgage/teleport/payRent 等）不校验回合，非当前玩家的操作会被执行
- **修复**：在 handleGameAction 的 switch 前统一拦截——游戏进行中时，所有 action 都要求 `playerIndex === currentPlayerIndex`，否则返回 `{ error: '不是你的回合' }`。服务端成为联机回合隔离的权威防线

### 前端加固
- `gameStore.ts rollDice`：联机分支前显式校验 isMyTurn，不满足时恢复 diceAnimating 并 return
- `GameView.vue`：联机模式新增 `room:error` 监听，服务端错误显示为 toast；`room:started` 刷新 myPlayerId 防跨局残留

### 文档升级到 V3.5
- PRD/game-design/TechnicalArchitecture 升级到 v3.5（旧 v3.4 删除）
- PRD 补充联机回合隔离与房间生命周期章节
- README 文档索引更新

---

## v3.5.0 - 联机核心修复：回合隔离 + 统一房间生命周期（2026-07-14）

### Bug 修复：两边同步问题（核心）
- **根因**：服务端 game:state（含 pendingEvent）广播给所有人，前端弹窗不区分操作者，导致两台设备显示相同弹窗、非当前玩家也能操作
- **修复**：新增 `isMyPendingEvent`/`interactivePendingModal` 计算属性，交互弹窗（购买/租房/传送）仅在"我的待处理事件"时显示；非自己回合显示观战提示条"⏳ 等待 XXX 操作..."
- 弹窗按钮加 `isMyPendingEvent` 禁用（双保险）
- 修复座位错位隐患：`myPlayerId` 改存引擎数组下标（playerSeats.findIndex），而非 room.seatIndex

### 统一房间生命周期（waiting/playing/ended 三阶段同一套逻辑）
- **统一退出函数 `handlePlayerExit`**：handleLeave/handleDisconnect 全部收敛到此，不再有分散 if-else
- **房主退出=解散房间**（三阶段一致）：全员回首页 + 提示"房主已解散该房间"/"你已解散该房间"（1s 自动关闭），房间号可二次复用
- **玩家退出**（三阶段一致）：
  - playing 阶段：引擎 `removePlayer`（地产归银行、资产清零、座位补位），剩余玩家收到 player:left + game:state + "{昵称}已退出房间"弹窗（1s 关闭）
  - waiting/ended 阶段：从 room.players 移除，广播 room:state
  - 退到只剩房主：房主回到房间等待界面（room:returned_to_lobby）
- `server/engine.js` 新增 `removePlayer(playerId)`：移除玩家、地产归银行、修正 currentPlayerIndex
- `server/server.js` handleStart/handleRestart 记录 `_engineIndex` 映射，确保 removePlayer 用对引擎下标

### NoticeModal 1s 自动关闭
- 房间解散/玩家退出提示显示后 1s 自动消失（保留"我已知晓"按钮兜底）

---

## v3.4.1 - 修复联机电脑端连接被拒（浏览器缓存）（2026-07-14）

### 问题
电脑端创建/加入房间报"连接被拒绝"，手机端正常。根因：`server.js` 静态文件未设置 `Cache-Control` 头，电脑浏览器缓存了旧版 index.html（旧 WS 配置），导致联机握手失败；手机端无缓存所以正常。

### 修复
- `server/server.js`：HTML 响应增加 `Cache-Control: no-cache, no-store, must-revalidate`，确保每次拿到最新前端入口；静态资源（.js/.css 等 hash 文件名）保留默认缓存
- 修复后旧客户端硬刷新一次即可，后续不再受缓存困扰

---

## v3.4.0 - 三条件独立胜负 + AI三档深度优化（2026-07-14）

### 胜负规则重构：三条独立条件（任意达成即胜）
- **破产胜利**：仅剩 1 名非破产玩家
- **仙境铁三角胜利**：拥有烟台山+蓬莱阁+养马岛，且每处地标建筑等级 ≥ 3（各建3座房屋，共9座）
- **资产胜利**（新增独立条件）：任一玩家总资产 > 30000，无需集齐铁三角
- VictoryChecker 重构为统一 `checkVictory` 遍历所有存活玩家；新增 `ironTriangleHouseLevel`(3) 配置项
- 资产检查触发点全面补全：过起点、分红、收租、卡牌、美食兑换、购买、建房后均检查（前后端同步）
- 资产估算前后端口径统一（抵押/养殖/装备/投资按变卖折价）

### AI 三档深度优化（差距拉大保证刺激性）
- **easy（新手导游）**：购买门槛×2.5 + 40%随机放弃；50%概率不建房；落对手地产90%只租房；不投核电；抵押随机——真人最容易赢
- **normal（本地商人）**：维持中等性价比决策
- **hard（仙境霸主）**：铁三角地标必买必升3级；色块集齐优先；买地皮前评估ROI；积极投资冲刺资产胜利；智能抵押保留高价值地产

### 文档全面迭代为 V3.4
- 新建 PRD-v3.4.md / game-design-v3.4.md / TechnicalArchitecture-v3.4.md
- 删除旧版 PRD-v3.md / game-design-v3.md
- HomeView 规则弹窗、README 同步三条件胜利规则
- 文档索引更新

---

## v3.3.0 - 玩法平衡 + AI三难度 + 胜负重构 + 胜利弹窗 + UI优化（2026-07-14）

### 玩法：扣钱力度加大（保证游戏可终结）
- 新增配置项 `economy.penaltyMultiplier`（默认 2.0）：租金、卡牌罚款、核事故救援费统一 ×2
- 过起点奖励、投资分红、养殖收益等盈利项不受影响
- 前后端引擎同步（RentCalculator / server.engine.calculateRent / applyCardEffect）

### 玩法：胜负规则重构
- **破产胜利优先**：Game.checkVictory 调整为先检查破产、再检查铁三角
- **仙境铁三角新条件**：①拥有烟台山+蓬莱阁+养马岛 ②各地标均建有房屋（≥1级）③总资产 > 30000
- 新增配置项 `victory.ironTriangleNeedHouses` / `ironTriangleMinAssets`
- VictoryChecker / server.engine.checkIronTriangle 同步；资产口径统一用 estimatePlayerAssets（含四大板块）
- **修复建房后未触发胜利检查**：buildHouse 成功后立即 checkVictory/checkIronTriangle（前端 Game.ts + gameStore，服务端 engine.js），避免铁三角胜利延迟或错乱弹出
- **前后端资产估值口径统一**：抵押地产按 0.5、养殖/装备/投资按变卖回收比折价，反映实际变卖价值

### AI：修复难度硬编码 bug + 三难度策略差异化
- 修复 `Game.ts` 硬编码 `new AIPlayer('normal')` 导致难度选择失效的 bug
- 改为按 aiLevel 缓存三个 AIPlayer 实例，gameStore 按当前玩家 aiLevel 取用
- easy（新手导游）：保守、随机性强、不主动交易/集齐、建房慢，最容易赢
- normal（本地商人）：中庸，按性价比决策
- hard（仙境霸主）：积极集齐色块、补齐建筑、抄底买地皮、积极投资
- 落对手地产概率按难度分档（easy 85%租房 / normal 70% / hard 50%）

### UI：电脑端棋盘字体放大 1.5~2 倍
- BoardCell.vue 新增桌面端媒体查询（min-width:768px）：格名 8→13px、图标 14→20px 等
- 移动端（<768px）保持原值不变；line-clamp + overflow 兜底防溢出

### 胜利弹窗重构（移动端+电脑端，按模式区分）
- AI 对战：真人赢弹"胜利"、输弹"失败"，按钮"再玩一局"/"退出"
- 同设备对战：弹"玩家昵称 赢"，列出输家，按钮"再玩一局"/"退出"
- 联机对战：房主按钮"再来一局"/"解散房间"，非房主"等待房主开下一局"/"退出房间"
- 联机重开链路打通（restartGame → room:started），解散后全员回首页 + NoticeModal 提示"房主已解散/你已解散该房间"+"我已知晓"
- 删除死代码 ResultView.vue 及 /result 路由（胜利统一用 VictoryModal）

### 日志：无限记录
- 移除 Game.addLog 的 300 条上限，游戏期间持续累积不丢失
- GameLog.vue 流式输出优化（积压>20条时批量刷新，降低延迟）

### 文档
- HomeView 游戏规则弹窗补全（新胜利条件、扣款说明、机会/命运牌、AI难度、色块地产清单）
- PRD-v3 / game-design-v3 / README 同步胜负规则与扣钱倍数，修正失效链接
- operations-guide.md 改为面向部署者的大众教程，去除真实服务器 IP 与私有仓库地址

---

## v3.1.0 - 联机bug修复 + 移动端重构 + 文档清理（2026-07-13）

### 联机 bug 根本性修复
- **服务端 data.js 完全重写**：与前端 board.json/properties.json 完全一致（消除 propertyRef 命名/格子布局/地产数量的历史分叉）
- **服务端 engine.js 完全重写**：移植四大海洋板块（装备/养殖/投资/生态）+ 玩家间交易 + 重掷券 + 破产清算含四板块清零
- **前端联机状态同步**：gameStore 增加 myPlayerId/isMyTurn/applyOnlineState，所有 action 在联机模式自动路由到 sendOnlineAction
- **前端 GameView**：监听 game:state 广播覆盖本地状态，联机按钮可点击
- **联机 SDK connect 修复**：增加 5 秒超时 + onclose reject，连接失败不再永久卡在"连接中"
- **错误提示优化**：连接失败显示具体原因而非通用提示

### 移动端布局重构
- 移除移动端抽屉机制，改为：棋盘 → 骰子 → 按钮一排 → 状态日志（可滚动）
- 掷骰/资产/美食/投资核电并列一排，重掷/放弃第二排
- 棋盘自适应剩余空间

### 美食免租券 bug 修复
- Game.payRentToPlayer：增加免租券消耗分支（与 payRent 自动收租一致）

### 文档清理
- 删除旧版 V1 文档（.trae/documents/、docs/design/game-design.md、game-rules.md）
- 新建运维总览 docs/operations-guide.md（服务器管理一站式手册）
- README 文档索引更新

---

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
