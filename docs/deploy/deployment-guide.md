# v4 部署指南

[English](deployment-guide.en.md) · [运维指南](operations-guide.md)

本版由同一 Node.js 进程提供前端静态文件和 `/ws` 联机服务。单机与联机共用 `shared/` 规则。本文提供部署配置；本次重构的本机验证不能替代目标服务器上的验收。

## 本地运行与构建

要求 Node.js **22.12 或以上**及 npm。在仓库根目录执行，不再分别安装前后端依赖：

```bash
git clone https://github.com/lightporta/Monopoly.git
cd Monopoly
npm ci
npm run dev
```

开发命令同时启动 Node 服务（默认 `3000`）和 Vite 前端（默认 `5173`）。打开终端显示的 Vite 地址；Vite 将 `/ws` 与 `/healthz` 代理到 Node。先启动整个开发命令，前端页面才能创建联机房间。

生产运行：

```bash
npm run build
npm start
```

访问 `http://localhost:3000`。服务端直接读取 `monopoly/dist/`，不要复制旧版 `server/public/index.html`。前端、共享引擎和服务端必须作为同一个版本发布；v3 协议和存档不兼容 v4。

单机模式可独立托管**完整** `monopoly/dist/` 目录；这种静态部署没有联机服务。通过 HTTP(S) 打开页面，勿依赖双击本地 HTML。

## 配置

| 环境变量 | 默认值 | 用途 |
|---|---|---|
| `PORT` | `3000` | Node HTTP 与 WebSocket 共用端口 |
| `HOST` | `0.0.0.0` | 监听地址；同机反代可设为 `127.0.0.1` |
| `ALLOWED_ORIGINS` | 空 | 空值校验浏览器 Origin 与请求 Host 一致；有值时为逗号分隔的完整来源白名单，例如 `https://game.example.com` |
| `TURN_TIMEOUT_MS` | `60000` | 真人回合时限，整数 `1000`–`600000` 毫秒 |

环境变量由启动进程传入；服务器不会自动读取 `.env` 文件。Docker Compose 可读取项目 `.env` 后注入配置，具体以 compose 文件为准。

```bash
HOST=127.0.0.1 PORT=3000 ALLOWED_ORIGINS=https://game.example.com TURN_TIMEOUT_MS=60000 npm start
```

浏览器使用当前页面的主机和协议连接 `/ws`：HTTPS 页面自动使用 WSS，不需要改源码里的服务器 IP。

## Linux 常驻运行

使用普通服务用户，在例如 `/opt/Monopoly` 的目录执行 `npm ci`、`npm run build`。可配置 systemd，替换下列用户名和 Node 路径：

```ini
[Unit]
Description=Monopoly v4
After=network.target

[Service]
Type=simple
User=monopoly
WorkingDirectory=/opt/Monopoly
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=ALLOWED_ORIGINS=https://game.example.com
Environment=TURN_TIMEOUT_MS=60000
ExecStart=/usr/bin/node /opt/Monopoly/server/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

将配置保存为 `/etc/systemd/system/monopoly.service` 后：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now monopoly
curl --fail http://127.0.0.1:3000/healthz
```

仅运行 **1 个进程、1 个副本**。不使用 PM2 cluster、多个容器副本或滚动多实例；房间未接入共享存储，分流会导致玩家连接到不同房间表。

## Nginx 与 HTTPS

为域名配置 DNS 并准备有效 TLS 证书。以下是同机 Nginx 示例；替换域名和证书路径。`map` 位于 Nginx `http` 上下文内：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
server {
    listen 80;
    server_name game.example.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name game.example.com;
    ssl_certificate /etc/letsencrypt/live/game.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/game.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location = /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
        proxy_buffering off;
    }
}
```

验证配置后重载：`sudo nginx -t`、`sudo systemctl reload nginx`。防火墙开放公网 `443`；需要 HTTP 跳转时开放 `80`。同机反代无需向公网开放 `3000`。证书续期需按实际证书管理工具配置并验证。

Docker 部署使用仓库根目录的 `Dockerfile` 与 `compose.yaml`；容器内监听 `0.0.0.0:3000` 并以 `node` 用户运行。检查 compose 的主机端口绑定和 Origin 配置；Nginx 在另一容器时，上游地址应使用服务名而不是该容器自己的 `127.0.0.1`。

## 上线验收

1. 公网 HTTPS 首页和 `/healthz` 均正常，健康接口返回 `{"ok":true,"version":4}`。
2. 两个独立浏览器或设备创建、加入、准备并开局；两端棋盘、当前玩家、资金一致。
3. 浏览器网络面板中 `/ws` 返回 **101**，保持连接；两端至少轮流完成一次行动。
4. 一端断网后重新连接，恢复原席位；超时后本回合由 AI 完成，下一回合恢复人工操作。
5. 完成或主动离开一局，核对结束状态、房主迁移和重新开局。

房间、联机局面和重连身份只保存在进程内存中，重启或升级会丢失。超时、重连和同源代理必须在目标部署环境复验；本仓库未宣称已经完成云服务器、TLS 或跨网络实测。
