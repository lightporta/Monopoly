# 🛠️ 运维总览（服务器管理一站式手册）

> **最后更新**：2026-07-13 V3.1
> **服务器**：腾讯云轻量 Ubuntu（公网 IP `140.143.242.241`）
> **用途**：不用翻聊天记录，所有服务器操作命令都在这里

---

## 目录

- [一、快速操作速查表](#一快速操作速查表)
- [二、更新游戏代码（最常用）](#二更新游戏代码最常用)
- [三、查看玩家状态与房间状态](#三查看玩家状态与房间状态)
- [四、实时监听游戏日志](#四实时监听游戏日志)
- [五、PM2 进程管理](#五pm2-进程管理)
- [六、首次部署（从零开始）](#六首次部署从零开始)
- [七、故障排查](#七故障排查)
- [八、保证游戏 7×24 运行](#八保证游戏-724-运行)

---

## 一、快速操作速查表

| 我想… | 命令 |
|---|---|
| 查看游戏是否在运行 | `pm2 status` |
| 实时看游戏日志 | `pm2 logs monopoly` |
| 看最近 50 条日志 | `pm2 logs monopoly --lines 50 --nostream` |
| 更新游戏代码 | 见[第二节](#二更新游戏代码最常用) |
| 重启游戏 | `pm2 restart monopoly` |
| 停止游戏 | `pm2 stop monopoly` |
| 查看在线连接数 | `ss -tn state established \| grep :80 \| wc -l` |
| 查看 80 端口占用 | `ss -tlnp \| grep :80` |
| 查看服务器资源 | `pm2 monit` |

---

## 二、更新游戏代码（最常用）

当你本地改了代码并 push 到 GitHub 后，在服务器 TAT 终端执行：

```bash
cd /opt/Monopoly
git pull origin main
cd server && npm install
pm2 restart monopoly
```

> ⚠️ 重启会清空所有正在进行的房间（房间数据在内存中）。如果有人正在玩，建议通知后再重启。

### 如果 git pull 报冲突

```bash
cd /opt/Monopoly
git stash
git pull origin main
cd server && npm install
pm2 restart monopoly
```

### 验证更新成功

```bash
pm2 logs monopoly --lines 5 --nostream
```
看到服务重启日志即可。浏览器访问 `http://140.143.242.241` 测试。

---

## 三、查看玩家状态与房间状态

### 3.1 查看当前在线设备数

```bash
ss -tn state established | grep :80 | wc -l
```
> 这个数字 ≈ 当前连接的设备数（每个打开游戏页面的浏览器算 1 个连接）。

### 3.2 查看当前有多少活跃房间

房间的状态在游戏日志中。查看最近的房间创建/销毁：

```bash
pm2 logs monopoly --lines 200 --nostream | grep "房间"
```

会看到类似：
```
房间创建: ABCD1234，房主: 张三
玩家加入: ABCD1234，李四
游戏开始: ABCD1234
房间销毁: ABCD1234（无人）
```

### 3.3 查看特定玩家的操作历史

```bash
pm2 logs monopoly --lines 500 --nostream | grep "张三"
```

### 3.4 查看所有游戏事件（掷骰/购买/投资等）

```bash
pm2 logs monopoly --lines 100 --nostream
```

日志格式示例：
```
房间创建: TEST1234，房主: Alice
玩家加入: TEST1234，Bob
游戏开始: TEST1234
游戏开始！2 位玩家，生态指数初始 50
Alice 到达 芝罘湾广场
Alice 购买了 芝罘湾广场，花费 ¥1200
💼 Alice 投资 海上风电场，花费 ¥3000
🐚 Bob 在 长岛 建造养殖场至 育苗场，花费 ¥1500
```

---

## 四、实时监听游戏日志

### 4.1 实时监听（会持续滚动，Ctrl+C 退出但不停止游戏）

```bash
pm2 logs monopoly
```

### 4.2 只看错误日志

```bash
pm2 logs monopoly --err
```

### 4.3 持久化日志文件位置

PM2 日志默认存在 `/root/.pm2/logs/`：

```bash
ls -la /root/.pm2/logs/
# monopoly-out.log   → 标准输出（游戏事件）
# monopoly-error.log → 错误日志
```

### 4.4 下载日志到本地查看（可选）

在本地终端执行：
```bash
scp root@140.143.242.241:/root/.pm2/logs/monopoly-out.log ./game-logs.txt
```

---

## 五、PM2 进程管理

| 命令 | 作用 |
|---|---|
| `pm2 status` | 查看所有进程状态 |
| `pm2 logs monopoly` | 实时日志 |
| `pm2 logs monopoly --lines N --nostream` | 最近 N 条日志 |
| `pm2 restart monopoly` | 重启游戏 |
| `pm2 stop monopoly` | 停止游戏 |
| `pm2 delete monopoly` | 删除进程（需重新 start） |
| `pm2 monit` | 实时监控 CPU/内存面板 |
| `pm2 flush` | 清空日志文件 |

### 用 80 端口启动（生产环境标准）

```bash
pm2 delete monopoly 2>/dev/null
PORT=80 pm2 start /opt/Monopoly/server/server.js --name "monopoly" --cwd /opt/Monopoly/server
pm2 save
```

---

## 六、首次部署（从零开始）

> 仅在服务器重装系统后需要执行。正常情况跳过此节。

```bash
# 1. 安装环境
apt update -y && apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# 2. 克隆项目
cd /opt
git clone https://github.com/lightporta/Monopoly.git
cd Monopoly/server
npm install

# 3. 用 80 端口启动
PORT=80 pm2 start server.js --name "monopoly"
pm2 save
pm2 startup   # 按提示复制粘贴执行的命令

# 4. 开放端口（腾讯云控制台 → 防火墙）
#    添加规则：TCP 80 允许
```

访问 `http://140.143.242.241` 验证。

---

## 七、故障排查

### 7.1 访问不了游戏

```bash
# 1. 游戏是否在运行？
pm2 status
# 状态应为 online

# 2. 80 端口是否在监听？
ss -tlnp | grep :80
# 应显示 0.0.0.0:80 ... LISTEN

# 3. 如果上面都正常但外部访问不了 → 腾讯云防火墙
# 控制台 → 轻量服务器 → 防火墙 → 确认 TCP 80 允许
```

### 7.2 联机连接不上（一直"连接中"）

```bash
# 1. 检查 WebSocket 服务是否正常
wscat -c ws://localhost:80/ws
# 应显示 connected

# 2. 检查服务端是否崩溃
pm2 logs monopoly --err --lines 20

# 3. 如果崩溃了，重启
pm2 restart monopoly
```

### 7.3 服务崩溃后自动恢复

PM2 会自动重启崩溃的进程。查看重启次数：
```bash
pm2 status
# 看 ↺ 列（重启次数）
```

### 7.4 端口被占用

```bash
ss -tlnp | grep :80
# 如果是 nginx 占了：
systemctl stop nginx
pm2 restart monopoly
```

### 7.5 内存不足

```bash
free -h
# 如果可用内存 < 200MB，添加交换空间：
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 八、保证游戏 7×24 运行

### 8.1 已自动保证的事项

| 场景 | 游戏是否继续 |
|---|---|
| 关闭 TAT 浏览器窗口 | ✅ 继续 |
| 你电脑关机 | ✅ 继续 |
| 服务器重启 | ✅ 自动恢复（pm2 startup） |
| 游戏进程崩溃 | ✅ PM2 自动重启 |

### 8.2 确认开机自启

```bash
pm2 save
pm2 startup
# 如果提示已配置，会显示 "Systemd startup script already exists"
```

### 8.3 定期检查（建议每周一次）

```bash
pm2 status                          # 确认 online
pm2 logs monopoly --err --lines 10  # 确认无错误
df -h                               # 确认磁盘未满
```

---

## 附录：架构速览

```
用户浏览器
    │ http://140.143.242.241
    ▼
┌─────────────────────┐
│  Node.js (PM2 守护)  │  80 端口
│  server/server.js    │  ├─ HTTP 静态服务（public/index.html）
│  server/engine.js    │  └─ WebSocket（/ws 路径，联机房间）
│  server/data.js      │
└─────────────────────┘
    │ git pull origin main
    ▼
GitHub: lightporta/Monopoly
```

> **文档结束** | 有问题先查第七节故障排查，仍无法解决提 GitHub Issue。
