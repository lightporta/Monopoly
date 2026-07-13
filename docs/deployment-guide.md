# 《仙境海岸·大富翁》云端部署指南

> **目标读者**：清华大学在校学生（或其他高校学生）
> **部署目标**：让游戏 7×24 小时运行在云服务器上，本地电脑关机不影响游戏
> **文档版本**：V1.0 | 2026-07-13

---

## 目录

- [一、云服务器选购（学生优惠）](#一云服务器选购学生优惠)
- [二、服务器环境准备](#二服务器环境准备)
- [三、部署游戏（三种方式）](#三部署游戏三种方式)
- [四、域名与 HTTPS（可选）](#四域名与-https可选)
- [五、日常运维](#五日常运维)
- [六、故障排查](#六故障排查)

---

## 一、云服务器选购（学生优惠）

作为清华大学学生，你可以享受多家云厂商的学生优惠。本游戏是 Node.js WebSocket 联机游戏，**同时在线几十人以内**，2核2G 配置完全够用。

### 1.1 推荐方案对比（2025-2026）

| 厂商 | 计划名 | 推荐配置 | 价格 | 带宽 | 续费政策 | 推荐度 |
|---|---|---|---|---|---|---|
| **腾讯云** | 云+校园 | 轻量 2核2G | **112 元/年** | 4M | 仅 3 次优惠续费 | ⭐⭐⭐⭐⭐ 最便宜 |
| **阿里云** | 云工开物 | ECS 2核2G | **99 元/年**（可用300元券抵扣） | 1M | 每年可续领券 | ⭐⭐⭐⭐ 长期最稳 |
| 华为云 | 云创校园 | 鲲鹏 2核2G | ~100 元/年 | 3M | 最多续费3次 | ⭐⭐⭐ |
| GitHub Pack | Azure | $100 额度 | 免费 | — | — | ⭐⭐ 国内延迟高 |

### 1.2 首选推荐：腾讯云「云+校园」

**为什么推荐**：价格最低（112元/年 ≈ 9.3元/月），4M 带宽 + 300G/月流量对你的场景完全够用。

**申请步骤**：
1. 注册腾讯云账号 → 完成实名认证
2. 访问 **https://cloud.tencent.com/act/campus**
3. 学生认证：
   - **25 岁以下**：免认证，直接享受优惠
   - **25 岁以上**：需学信网学籍认证（用清华学籍）
4. 选择「轻量应用服务器 2核2G」→ 购买 12 个月（112 元）
5. 操作系统选 **Ubuntu 22.04 LTS**

> ⚠️ **续费限制**：只有 3 次以优惠价续费的资格。建议一次买多年，或到期前迁移到阿里云。

### 1.2 备选推荐：阿里云「云工开物」

**为什么推荐**：续费政策更友好（每年可续领 300 元券），适合长期项目。

**申请步骤**：
1. 访问 **https://university.aliyun.com/**
2. 学信网学籍认证（清华学生证/录取通知书，系统自动对接，几分钟通过）
3. 领取 **300 元无门槛代金券**（有效期 1 年）
4. 购买 ECS 2核2G/1M/40G ESSD，年付 99 元 → 用券抵扣 → **首年免费**
5. 操作系统选 **Ubuntu 22.04 LTS**

> 💡 **省钱组合拳**：两家都注册认证。腾讯云作主力（便宜），阿里云作备用/测试环境。

### 1.3 清华学生专属提示

- 阿里云/腾讯云的学生优惠**全国通用**，清华学生身份本身不带来额外专属优惠
- 关注**清华信息化技术中心（ITC）**和各院系通知，偶尔有校企合作专属码
- 若用于**科研/课程项目**，可通过导师申请企业级科研云资源（额度远大于个人优惠）
- **GitHub Student Developer Pack**（https://education.github.com/pack ）：用清华 `.edu.cn` 邮箱申请，含 $100 Azure 额度，可作备用/测试环境（国内访问延迟高，不建议作主服务器）

### 1.4 配置需求估算

| 指标 | 需求 | 说明 |
|---|---|---|
| CPU | 2 核 | Node.js 单进程，2 核足够 |
| 内存 | 2 GB | 几十人 WebSocket 连接约占 50-200MB |
| 带宽 | 3-4 Mbps | 游戏状态同步数据量很小 |
| 磁盘 | 40 GB | 系统+代码+日志绰绰有余 |
| 并发 | 几十人 | 2核2G 可支撑数百 WebSocket 连接 |

**结论**：2核2G 是绰绰有余的配置，瓶颈完全不会到。

---

## 二、服务器环境准备

购买服务器后，你会获得：**公网 IP**（如 `123.45.67.89`）+ ** root 密码**。

### 2.1 连接服务器

```bash
# 在本地终端执行（macOS/Linux 自带 ssh，Windows 用 PowerShell 或 WSL）
ssh root@你的服务器IP
# 输入购买时设置的密码
```

### 2.2 安装 Node.js（LTS 版）

```bash
# 添加 NodeSource 源（Node.js 20 LTS）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 安装 Node.js
sudo apt-get install -y nodejs

# 验证（应显示 v20.x.x）
node -v
npm -v
```

### 2.3 安装 Git

```bash
sudo apt-get install -y git
git --version
```

### 2.4 开放防火墙端口

**腾讯云/阿里云控制台操作**：
1. 进入服务器实例 → **安全组** / **防火墙**
2. 添加入站规则：
   - 端口 **3000**（TCP）→ 游戏服务端口
   - 端口 **80**（TCP）→ HTTP（Nginx 用）
   - 端口 **443**（TCP）→ HTTPS（可选）

```bash
# 服务器内 Ubuntu 防火墙（如果启用了 ufw）
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 三、部署游戏（三种方式）

### 方式 A：从 GitHub 克隆（推荐）

最干净的方式，代码始终与 GitHub 同步。

```bash
# 1. 克隆仓库到服务器
cd /opt
git clone https://github.com/lightporta/Monopoly.git
cd Monopoly/server

# 2. 安装服务端依赖
npm install

# 3. 启动测试（前台运行，Ctrl+C 停止）
npm start
# 看到 "服务器运行在端口 3000" 即成功

# 4. 浏览器访问 http://你的服务器IP:3000 验证
```

✅ 验证成功后，按 `Ctrl+C` 停止，继续下面的 PM2 后台运行。

### 方式 B：上传本地文件（无 GitHub 时）

如果你的仓库是私有的或网络不通：

```bash
# 在本地终端打包（排除 node_modules）
cd /Users/anowell/Documents/MillionaireGame
tar --exclude='node_modules' --exclude='.git' -czf monopoly.tar.gz .

# 上传到服务器
scp monopoly.tar.gz root@你的服务器IP:/opt/

# SSH 到服务器解压
ssh root@你的服务器IP
cd /opt && mkdir -p Monopoly && tar -xzf monopoly.tar.gz -C Monopoly
cd Monopoly/server && npm install
```

### 方式 C：PM2 后台守护运行（生产环境必备）

PM2 会让游戏在后台持续运行，即使服务器重启也会自动恢复。

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动游戏（在 /opt/Monopoly/server 目录下）
cd /opt/Monopoly/server
pm2 start server.js --name "monopoly"

# 查看运行状态
pm2 status
pm2 logs monopoly    # 查看日志（Ctrl+C 退出查看，不会停止游戏）

# 设置开机自启
pm2 save
pm2 startup          # 按提示复制粘贴执行的命令
```

**PM2 常用命令**：

| 命令 | 作用 |
|---|---|
| `pm2 status` | 查看所有进程状态 |
| `pm2 logs monopoly` | 查看实时日志 |
| `pm2 restart monopoly` | 重启游戏 |
| `pm2 stop monopoly` | 停止游戏 |
| `pm2 delete monopoly` | 删除进程 |
| `pm2 monit` | 实时监控 CPU/内存 |

---

## 四、域名与 HTTPS（可选）

如果你不想让用户输入 IP 地址，可以绑定域名。

### 4.1 购买域名

- 阿里云/腾讯云购买 `.com` / `.cn` 域名（学生认证后约 35-55 元/年）
- 域名需 **ICP 备案**（国内服务器必须，约 7-20 个工作日）

> 💡 如果不想备案，可以用免费域名服务（如 freenom）+ 海外服务器，但延迟较高。

### 4.2 Nginx 反向代理

安装 Nginx，将 80 端口转发到 3000：

```bash
# 安装 Nginx
sudo apt-get install -y nginx

# 创建配置文件
sudo nano /etc/nginx/conf.d/monopoly.conf
```

写入以下内容（把 `your-domain.com` 换成你的域名或 IP）：

```nginx
server {
    listen 80;
    server_name your-domain.com;   # 或直接写服务器 IP

    # 前端页面
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 支持（关键！）
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;   # WebSocket 长连接超时设为 24 小时
    }
}
```

```bash
# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
sudo systemctl enable nginx   # 开机自启
```

现在可以用 `http://your-domain.com`（无端口号）访问了。

### 4.3 HTTPS（免费证书）

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 自动申请并配置 Let's Encrypt 免费证书
sudo certbot --nginx -d your-domain.com

# 按提示操作，证书自动续期
```

---

## 五、日常运维

### 5.1 更新游戏代码

当你本地修改代码并 push 到 GitHub 后，在服务器上拉取更新：

```bash
# 如果只改了前端（需重新构建）
cd /opt/Monopoly
git pull origin main
cd monopoly && npm run build
cp dist/index.html ../server/public/
pm2 restart monopoly

# 如果只改了前端数据（无需重新构建，单文件模式会重新打包）
cd /opt/Monopoly && git pull origin main
cd monopoly && npm run build && cp dist/index.html ../server/public/
pm2 restart monopoly

# 如果改了服务端代码
cd /opt/Monopoly && git pull origin main
cd server && npm install   # 如有新依赖
pm2 restart monopoly
```

### 5.2 备份

游戏数据目前在内存中（重启清空），如需持久化日志：

```bash
# 导出游戏日志（PM2 日志默认路径）
pm2 logs monopoly --lines 1000 > /tmp/game-logs.txt
```

### 5.3 监控资源

```bash
# 实时查看 CPU/内存
htop

# 查看磁盘空间
df -h

# PM2 监控面板
pm2 monit
```

---

## 六、故障排查

### 6.1 访问不了游戏

| 症状 | 排查 |
|---|---|
| 浏览器超时 | 检查安全组是否放行 3000 端口；检查 ufw 防火墙 |
| 连接被拒绝 | `pm2 status` 确认游戏在运行；`pm2 logs monopoly` 查报错 |
| 能访问但联机不工作 | Nginx 的 `/ws` WebSocket 代理配置是否正确 |
| 白屏 | `server/public/index.html` 是否存在且为最新版 |

### 6.2 联机 WebSocket 连接失败

```bash
# 检查 WebSocket 端口是否通
curl -i http://你的服务器IP:3000/ws

# 查看前端连接地址（在 server/public/index.html 中搜索）
grep -o "ws[s]*://[^\"]*" server/public/index.html | head
```

> ⚠️ 如果前端代码里的 WebSocket 地址是硬编码的 `localhost` 或旧 IP，需要重新 build 并更新连接地址。

### 6.3 内存不足

```bash
# 查看内存使用
free -h

# 如果 SWAP 为 0，添加 2G 交换空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 6.4 查看详细日志

```bash
# PM2 日志（最近 200 行）
pm2 logs monopoly --lines 200

# 实时日志
pm2 logs monopoly

# Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

---

## 附录：完整部署一键脚本

> 将以下内容保存为 `deploy.sh`，在服务器上 `bash deploy.sh` 一键执行。

```bash
#!/bin/bash
set -e

echo "=== 1. 安装 Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

echo "=== 2. 安装 PM2 ==="
sudo npm install -g pm2

echo "=== 3. 克隆项目 ==="
cd /opt
if [ -d "Monopoly" ]; then
  echo "目录已存在，拉取更新..."
  cd Monopoly && git pull origin main
else
  git clone https://github.com/lightporta/Monopoly.git
  cd Monopoly
fi

echo "=== 4. 安装服务端依赖 ==="
cd server
npm install

echo "=== 5. 启动 PM2 ==="
pm2 delete monopoly 2>/dev/null || true
pm2 start server.js --name monopoly
pm2 save
pm2 startup systemd -u root --hp /root

echo "=== 6. 开放端口 ==="
sudo ufw allow 3000/tcp 2>/dev/null || true
sudo ufw allow 80/tcp 2>/dev/null || true

echo ""
echo "========================================"
echo "✅ 部署完成！"
echo "========================================"
echo "访问地址：http://$(curl -s ifconfig.me):3000"
echo "状态查看：pm2 status"
echo "日志查看：pm2 logs monopoly"
echo "========================================"
```

---

## 快速决策树

```
你是清华学生，想部署联机游戏？
│
├─ 预算 < 120 元/年？
│   └─ ✅ 腾讯云 2核2G 轻量（112元/年，4M带宽）
│       → https://cloud.tencent.com/act/campus
│
├─ 想长期稳定（2年以上）？
│   └─ ✅ 阿里云 ECS 2核2G（99元/年，300元券抵扣）
│       → https://university.aliyun.com/
│
├─ 不想花钱，能接受国内延迟？
│   └─ GitHub Pack + Azure $100 额度
│       → https://education.github.com/pack
│
└─ 已有服务器？
    └─ 跳到「二、服务器环境准备」
```

---

> **文档结束** | 有问题先查「六、故障排查」，仍无法解决可提 GitHub Issue。
