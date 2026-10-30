# v4 deployment guide

[中文](deployment-guide.md) · [Operations](operations-guide.en.md)

One Node.js process serves the frontend and the `/ws` multiplayer endpoint. Offline and online play share the rules in `shared/`. These instructions provide deployment configuration; local verification of this refactor does not establish that a cloud deployment works.

## Development and production builds

Use Node.js **22.12 or newer** and npm. Run commands from the repository root, rather than installing the frontend and backend separately:

```bash
git clone https://github.com/lightporta/Monopoly.git
cd Monopoly
npm ci
npm run dev
```

The development command starts both Node (port `3000`) and Vite (port `5173`). Open the Vite URL printed in the terminal. Vite proxies `/ws` and `/healthz` to Node; the backend must run for multiplayer rooms to work.

For production:

```bash
npm run build
npm start
```

Open `http://localhost:3000`. The server reads `monopoly/dist/` directly. Do not copy an old `server/public/index.html`. Release the frontend, shared engine and server together; v3 protocols and saves are incompatible with v4.

For offline play alone, host the **entire** `monopoly/dist/` directory on a static HTTP(S) host. Static hosting does not provide multiplayer. Do not rely on opening the HTML file directly from disk.

## Configuration

| Environment variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Shared HTTP/WebSocket port |
| `HOST` | `0.0.0.0` | Bind address; use `127.0.0.1` behind a proxy on the same machine |
| `ALLOWED_ORIGINS` | Empty | Empty compares browser Origin with request Host; otherwise a comma-separated list of complete origins, such as `https://game.example.com` |
| `TURN_TIMEOUT_MS` | `60000` | Human turn deadline, integer milliseconds from `1000` to `600000` |

Pass variables to the process. The Node server does not automatically load `.env`. Docker Compose may read the project `.env` and inject configuration according to the compose file.

```bash
HOST=127.0.0.1 PORT=3000 ALLOWED_ORIGINS=https://game.example.com TURN_TIMEOUT_MS=60000 npm start
```

The browser connects to `/ws` using its current host and protocol. HTTPS pages automatically use WSS; no hardcoded server IP needs editing.

## Running continuously on Linux

Use an ordinary service account. Install and build in a directory such as `/opt/Monopoly`. Example systemd service; adjust the username and Node binary path:

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

Save as `/etc/systemd/system/monopoly.service`, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now monopoly
curl --fail http://127.0.0.1:3000/healthz
```

Run **one process and one replica**. Do not use PM2 cluster mode, multiple containers or rolling multi-instance releases. Rooms have no shared backing store; routing clients to separate instances produces separate room tables.

## Nginx and HTTPS

Configure DNS and obtain a valid TLS certificate. The following example assumes Nginx runs on the same machine; replace the domain and certificate paths. Put `map` inside Nginx's `http` context:

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

Run `sudo nginx -t`, then `sudo systemctl reload nginx`. Expose public port `443`, plus `80` if using HTTP redirection. Port `3000` need not be publicly exposed with this same-machine proxy. Configure and verify certificate renewal with your actual certificate tooling.

Docker deployment uses the repository-root `Dockerfile` and `compose.yaml`. The container listens on `0.0.0.0:3000` and runs as `node`. Check the host port binding and origin configuration. When Nginx runs in another container, use the backend service name as its upstream, rather than that container's own `127.0.0.1`.

## Deployment acceptance

1. The public HTTPS homepage and `/healthz` work; health returns `{"ok":true,"version":4}`.
2. Two independent browsers or devices create/join a room, ready up and start; their board, current player and balances agree.
3. The browser network panel shows **101** for `/ws`; keep the connection open and complete turns from both clients.
4. Disconnect and reconnect one client; it recovers its original seat. If its deadline expires, AI finishes that turn and manual control returns on its next turn.
5. Finish or leave a game; verify terminal state, host migration and restart.

Rooms, online games and reconnect identities exist only in process memory. Restarting or upgrading loses them. Recheck timeouts, reconnection and proxy behavior on your target environment. This repository does not claim cloud, TLS or cross-network deployment testing has already been completed.
