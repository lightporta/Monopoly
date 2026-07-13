# 仙境海岸·大富翁

> 烟台文旅主题大富翁网页游戏

## 🎮 游戏简介

《仙境海岸·大富翁》是一款以山东烟台文旅为主题的网页版大富翁游戏。玩家在36格环形棋盘上掷骰移动、购买地标地产、建造房屋收取过路费，并融合"八仙过海"传送、烟台美食收集、"仙境铁三角"成就胜利等特色玩法。

### 特色玩法

- 🏝️ **烟台地标**：芝罘湾广场、烟台山、蓬莱阁、养马岛等21处烟台地标
- ⚡ **传送系统**：烟台山灯塔定向传送、八仙渡海口自由传送、海昌鲸鲨馆再玩一次
- 🍱 **美食收集**：烟台焖子、蓬莱小面、海鲜疙瘩汤、鲅鱼水饺四种特色美食
- 🔺 **铁三角胜利**：同时持有烟台山、蓬莱阁、养马岛三处核心地标直接获胜
- 🤖 **AI对手**：三种难度AI对手（新手导游、本地商人、仙境霸主）
- 🌐 **联机对战**：支持2-4人跨设备联机对战，WebSocket 实时同步
- 🌊 **四大海洋板块（V3 新增）**：
  - 🛢️ **海工装备**：4件装备（钻井平台/深海机器人/监测船/风电塔），过路费加成
  - 🐚 **海产养殖**：4处养殖地产，3级被动收入，每经过起点结算
  - 💼 **核电投资**：海阳核电/海上风电场，每回合分红（左下方入口）
  - 🌿 **海洋生态**：全局生态指数，生态卡影响全局经济
  - 🎫 **重掷券**：集齐色块奖励重掷券（决策点增强）

## 🎮 游戏模式

### 模式一：单机版（同一设备）
- 与 AI 对战：1-2 位人类玩家 + 1-3 个 AI 对手
- 真人对战：2-4 位玩家轮流使用同一设备

### 模式二：联机版（不同设备）
- 创建房间 / 加入房间
- 房间 Key 分享
- 最多 4 人同时在线对战
- 实时同步游戏状态

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0

### 本地开发

```bash
# 克隆项目
git clone <repo-url>
cd MillionaireGame

# 进入项目目录
cd monopoly

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### 生产构建

```bash
# 类型检查 + 生产构建
npm run build

# 产物输出至 dist/ 目录
```

### 预览构建结果

```bash
npm run preview
# 访问 http://localhost:4173
```

## 📁 项目结构

```
MillionaireGame/
├── docs/                      # 设计文档
│   └── design/                # 核心设计与规则文档
├── monopoly/                  # 前端项目（Vue 3 + Vite）
│   ├── src/
│   │   ├── data/              # JSON 静态数据
│   │   ├── engine/            # 游戏引擎（TypeScript）
│   │   ├── stores/            # Pinia 状态管理
│   │   ├── online/            # 联机 SDK
│   │   ├── components/        # UI 组件
│   │   ├── views/             # 页面视图
│   │   ├── router/            # 路由配置
│   │   └── assets/            # 静态资源
│   ├── dist/                  # 构建产物（单文件 HTML）
│   ├── package.json
│   └── vite.config.ts
├── server/                    # 服务端（Node.js + WebSocket）
│   ├── server.js              # 主服务程序
│   ├── engine.js              # 服务端游戏引擎
│   ├── data.js                # 游戏数据配置
│   ├── public/                # 静态文件托管
│   │   └── index.html         # 前端构建产物
│   └── package.json
├── README.md
└── CHANGELOG.md
```

## 🎯 游戏规则

### 基本规则

1. 每位玩家初始资金15000元
2. 掷骰移动，经过起点领2000元并抽美食卡
3. 购买地产，建造房屋收取过路费
4. 集齐同色块地产，过路费翻倍
5. 机会卡获收益，命运卡遇风险
6. 连续三次掷出双数，送至休息格跳过下一回合

### 胜利条件

- **破产胜利**：使其他所有玩家破产
- **铁三角胜利**：同时持有烟台山、蓬莱阁、养马岛

### 色块分组

| 色块组 | 颜色 | 数量 | 集齐条件 | 加成 |
|--------|------|------|----------|------|
| 历史街区 | 🔴 | 4 | 全部集齐 | ×2.0 |
| 海岸线 | 🔵 | 8 | 任意4块 | ×1.5 |
| 仙山 | 🟢 | 5 | 全部集齐 | ×2.0 |
| 温泉 | 🟠 | 4 | 全部集齐 | ×2.0 |

## 🌐 部署方式

### 方式一：单机版（静态文件）

只需前端，无需服务端：

```bash
cd monopoly
npm run build
# 将 dist/index.html 上传至任意静态服务器
```

### 方式二：联机版（推荐）

需要 Node.js 服务端，支持跨设备联机：

```bash
# 1. 构建前端
cd monopoly
npm install
npm run build

# 2. 复制到服务端 public 目录
cp dist/index.html ../server/public/

# 3. 启动服务端
cd ../server
npm install
npm start
# 访问 http://localhost:3000
```

### 方式三：云服务器部署（Linux）

```bash
# 1. 在云服务器上安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 克隆项目
git clone <repo-url>
cd MillionaireGame

# 3. 构建前端
cd monopoly
npm install
npm run build
cp dist/index.html ../server/public/

# 4. 启动服务端（使用 PM2 后台运行）
cd ../server
npm install
npm install -g pm2
pm2 start server.js --name monopoly
pm2 save
pm2 startup

# 5. 配置 Nginx 反向代理（可选）
sudo apt-get install -y nginx
```

**Nginx 配置示例**：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 方式四：单文件离线运行（单机版）

```bash
cd monopoly
npm run build
# dist/index.html 是独立文件，双击即可运行
```

## 🔌 联机版使用说明

### 创建房间
1. 首页点击「与真人玩」→「联机版」
2. 输入昵称
3. 输入自定义房间 Key（4~10位字母数字）
4. 点击「创建房间」
5. 分享房间 Key 给朋友

### 加入房间
1. 首页点击「与真人玩」→「联机版」
2. 输入昵称
3. 输入朋友分享的房间 Key
4. 点击「加入房间」

### 开始游戏
- 房主在房间等待页点击「开始游戏」
- 至少需要 2 名玩家才能开始

## 🛠️ 技术栈

### 前端
- **框架**：Vue 3 + TypeScript
- **状态管理**：Pinia
- **路由**：Vue Router
- **构建工具**：Vite
- **样式**：CSS3 + CSS Variables
- **输出**：单文件 HTML（vite-plugin-singlefile）

---

## 📚 文档索引

| 文档 | 说明 |
|---|---|
| [📋 PRD V3](./docs/design/PRD-v3.md) | 产品需求文档（含四板块功能/流程/规则） |
| [🏗️ 技术架构 V3](./docs/design/TechnicalArchitecture-v3.md) | 技术架构文档（引擎设计/数据结构/联机协议） |
| [🎮 游戏设计 V3](./docs/design/game-design-v3.md) | 完整游戏规则（四板块/胜利条件/兼容性） |
| [🚀 部署指南](./docs/deployment-guide.md) | 云端部署（含学生优惠/PM2/Nginx/HTTPS） |
| [🛠️ 运维总览](./docs/operations-guide.md) | 服务器管理一站式手册（查看状态/日志/更新） |
| [📝 更新日志](./CHANGELOG.md) | 版本变更记录 |

### 服务端
- **运行时**：Node.js ≥ 18
- **WebSocket**：ws 库
- **HTTP**：原生 http 模块
- **架构**：HTTP + WebSocket 同进程

## 🐛 常见问题

### Q1: 开发服务器启动失败？

```bash
# 检查 Node.js 版本
node -v  # 需 ≥ 18.0.0

# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
```

### Q2: 构建失败？

```bash
# 检查 TypeScript 类型错误
npx vue-tsc --noEmit

# 清理构建缓存
rm -rf dist .vite
npm run build
```

### Q3: 页面空白？

检查浏览器控制台（F12）查看错误信息，常见原因：
- 路由模式问题（需使用 hash 模式）
- 资源路径问题（确保 base 配置正确）

### Q4: 如何修改游戏规则？

规则配置文件位于 `monopoly/src/data/` 目录：
- `game-config.json`：全局游戏参数（初始资金、过路费倍数等）
- `board.json`：棋盘格子定义
- `properties.json`：地产数据
- `cards-chance.json`：机会卡
- `cards-destiny.json`：命运卡
- `cards-food.json`：美食卡

### Q5: 如何添加新功能？

1. 修改 `docs/design/game-rules.md` 更新规则文档
2. 修改 `src/data/*.json` 添加数据配置
3. 修改 `src/engine/*.ts` 实现核心逻辑
4. 修改 `src/stores/gameStore.ts` 添加状态管理
5. 修改 `src/components/*.vue` 添加 UI 组件

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

> **烟台文旅主题大富翁游戏**
> Made with ❤️ for 仙境海岸

