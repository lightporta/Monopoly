# 更新日志

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
