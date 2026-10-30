# v4 operations guide

[中文](operations-guide.md) · [Deployment](deployment-guide.en.md)

A single Node process serves `monopoly/dist/` and `/ws`. Rooms live in memory. Restarting, crashing or upgrading loses ongoing multiplayer games. Browser offline saves are separate from server rooms.

## Routine checks

```bash
curl --fail http://127.0.0.1:3000/healthz
sudo systemctl status monopoly
sudo journalctl -u monopoly -n 100 --no-pager
```

`{"ok":true,"version":4}` means the HTTP process responds. It does not verify external DNS, TLS, WebSocket proxying, playable sessions or room counts. Also check creating, joining, readying and completing turns in two independent browsers.

For Docker Compose, use `docker compose ps` and `docker compose logs --tail=100`. Use the supervisor selected for your deployment. Do not run a systemd service and a second container competing for the same port.

The server does not normally log player names, reconnect tokens or every game action. A game's snapshot retains its latest 200 events. There is no public room-administration or player-history API. TCP connection counts are not player counts.

## Releasing and rolling back

Install and build from the repository root using the lockfile. Inspect the working tree and decide how to handle local changes; do not discard server-side modifications with overwrite commands:

```bash
cd /opt/Monopoly
git status --short
git fetch origin
git pull --ff-only origin main
npm ci
npm test
npm run build
```

Schedule a maintenance window. Installing dependencies changes the environment used by an existing process. Prefer completing these steps in a separate release directory, then switching releases and starting one process. A release must include matching `shared/`, `server/`, `monopoly/dist/` and dependencies. Mixing frontend and engine versions can break sessions.

```bash
sudo systemctl restart monopoly
curl --fail http://127.0.0.1:3000/healthz
```

Repeat [deployment acceptance](deployment-guide.en.md#deployment-acceptance) over the public URL. Environment changes also require restarting. Roll back to a retained complete release and restart; rollback cannot recover lost rooms. Container releases likewise require preparing and validating the new image while retaining one replica.

## Connection and timeout behavior

- Heartbeats check connections every 30 seconds; unresponsive connections are closed.
- Human turns default to 60 seconds. `TURN_TIMEOUT_MS` accepts integer milliseconds from `1000` to `600000`. Rolling or managing assets does not extend the deadline.
- Once a deadline expires, the shared AI completes that seat's current turn. Manual control returns on the next turn, avoiding simultaneous human/AI submissions.
- Disconnection preserves the seat and private reconnect identity. Resuming replaces an old socket for that seat. Explicitly leaving permanently converts the seat to AI and revokes its reconnect identity.
- The host role migrates after leaving or disconnecting. In the lobby, the host may remove disconnected human seats before starting.
- Rooms without connected humans expire after approximately 30 minutes, checked every 30 seconds. Other rooms expire after 24 hours without activity. The process caps rooms and connections at 500 each. These protective limits are not measured capacity guarantees.

Reconnect tokens are private credentials. Do not include them in screenshots, URLs, logs or support requests. After a process restart, old tokens cannot recover rooms; create a new room.

## Troubleshooting

| Symptom | Check or action |
|---|---|
| `/healthz` refuses connection | Check the process, `HOST`, `PORT`, port conflicts and startup logs |
| Health works, homepage returns 404 | Run root `npm run build`; verify `monopoly/dist/index.html` and all assets exist |
| Homepage works, `/ws` never returns 101 | Check Upgrade/Connection headers, exact `/ws` path, Nginx upstream and allowed origins |
| Multiplayer fails on HTTPS | Check same-host WSS, certificate and Nginx configuration; do not switch to insecure WS |
| Upgrade returns 403 | Origins must be complete and have no trailing `/`; preserve Host including a non-default port; check the connection cap |
| `STALE_REVISION` | Wait for the latest snapshot and choose an action again; do not replay old actions automatically across reconnection |
| `TURN_AUTOPLAY` | AI is finishing the expired turn; wait for your next turn |
| `NOT_READY` | Every human must be connected and ready; remove disconnected lobby seats or wait for them to return |
| `ROOM_NOT_FOUND` / `INVALID_SESSION` | Check expiration, restart, explicit leave, incorrect token, and accidentally running multiple replicas |
| `ENGINE_ERROR` | Inspect the server's `Automatic turn failed` error and retain version/reproduction details; restarting loses rooms |
| Frequent disconnections | Check proxy timeout against heartbeat interval, network, load and process restarts |

A plain `curl /ws` is an HTTP request, not a WebSocket upgrade. A 404 from that request does not establish that multiplayer is broken. Inspect an actual browser Upgrade request and both clients' snapshots after actions.

## Backup and monitoring limits

Retain complete releases, lockfiles, proxy/process configuration and certificate renewal configuration. There is currently no room persistence, recovery tool or room database to back up. Copying process logs cannot recover games. Monitor exits, proxy errors, health, memory and CPU, and use measurements on your deployment to size resources. Old cloud discounts and unmeasured concurrency claims have been removed.

Verification for this refactor covers local rules tests, simulations, builds and local multiplayer workflows. Cloud hosts, public cross-device networks, TLS, Nginx and containers require evidence from those environments before being reported as verified.
