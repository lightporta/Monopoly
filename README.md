# Fairy Coast · Monopoly

[English](README.md) · [简体中文](README.zh-CN.md)

A bilingual Yantai property board game for 2–4 travelers. Play against AI, pass one device between friends, or share a room across devices.

Version 4 rebuilds the game around one rules engine. Local games and the authoritative WebSocket server use the same actions, economy, AI and victory calculation. The old client/server engines and embedded production HTML have been removed.

## Run

Requires **Node.js 22.12+** and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). This starts Vite and the Node server; `/ws` is proxied to port 3000. For friends on your LAN, use a production build, which listens on all interfaces by default:

```sh
npm run build
npm start
```

Open [localhost:3000](http://localhost:3000), or `http://YOUR_LAN_IP:3000` on another device. Create a room, share the six-character code, have the other players join and ready up, then start. Host can add AI seats. Internet play requires an accessible server and preferably HTTPS; this repository does not supply hosting.

For Docker, `docker compose up --build -d` builds and serves both frontend and backend. Use one process/replica. See the [deployment guide](docs/deploy/deployment-guide.en.md) for HTTPS, reverse proxy and environment configuration. Docker, TLS and a real cloud deployment have not been executed as part of the local verification.

## What changed

- One dependency-free engine in `shared/`; mandatory rent, legal action guards, automatic liquidation, capped upgrades and one valuation formula.
- A new responsive Vue interface with Chinese/English switching, property inspection, local autosave, handoff between human players and final standings. It makes no external font or media requests.
- Authoritative rooms with private resume tokens, stable seat IDs, readiness, host migration, bots, request deduplication and revision checks. Refresh restores the seat; an expired human turn is finished by AI. Leaving explicitly permanently converts that seat to AI.
- Three deterministic AI policies use legal actions, cash reserves and expected returns. Hard AI estimates landing probabilities, including portals and rest turns. No extra cash, altered dice or rent exemptions.
- A root lockfile, regression tests, browser tests, simulation tool, CI configuration and deployment files.

The v4 protocol and save format replace v3; old saves and clients are incompatible. This is a deliberate rules rebuild: player trades, auctions, free-choice teleporting, reroll tickets, hotels and instant wealth victory are removed. Houses/farms, equipment, limited energy investments, food, ecology and the landmark triangle remain under simplified shared rules.

## Rules at a glance

Start with **¥12,000**. Each turn has one roll, followed by a purchase choice if needed, then property management. Rent and fees settle automatically. Natural laps pay **¥1,200**, food and farm income; portals do not grant a lap reward. Four food tokens redeem for **¥1,000**.

Houses and farms are mutually exclusive, capped at three levels. Collecting a group increases rent by 50%; equipment increases it by 20%. Wind/nuclear shares pay **¥55/¥90** per active turn, with global limits. Ecology affects farm and nuclear income. Insufficient funds trigger sales and mortgages, then bankruptcy; creditors receive only actual recovered money.

The last survivor wins; otherwise, after the configured full-round limit (default **40**), compare net worth simultaneously. Exact ties share victory. The developed landmark triangle adds **3,000 score**, without minting money or ending early. See the [complete rules](docs/design/game-rules.en.md), also available in-game.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend for development |
| `npm run build` | Build the frontend into `monopoly/dist/` |
| `npm start` | Serve the production frontend and `/ws` together |
| `npm run check` | Run Node regression tests and production build |
| `npm run simulate -- --seeds 100` | Run reproducible AI matches with rotated seats |
| `npx playwright install chromium` | Install the browser test runtime |
| `npm run test:e2e` | Build and test local/online journeys in Chromium |

The built `monopoly/dist/` folder can also be served by a static host for local-only games. Upload the **whole folder**, including `assets/`. Double-clicking `index.html` over `file://` is not supported. Server restart clears online rooms; local saves remain in the browser. No accounts, durable online saves or multi-process coordination are implemented.

## Project layout

```text
shared/                Bilingual board data, rules, AI and valuation
monopoly/src/          Vue interface, translation and reconnect client
server/                HTTP/WebSocket room service and wire protocol
scripts/               Development runner and AI simulation
tests/                Engine, client, server and browser regressions
docs/design/           Rules and architecture in English and Chinese
docs/deploy/           Deployment and operations in both languages
```

[Architecture](docs/design/TechnicalArchitecture.en.md) · [Wire protocol](server/PROTOCOL.md) · [Operations](docs/deploy/operations-guide.en.md) · [Validation](docs/validation.md) · [Changelog](CHANGELOG.md)

AI simulation reports compare fixed policies under specific seeds. They demonstrate reproducibility and termination, not a guaranteed human win rate. Hosted networking, real mobile devices and non-macOS platforms need their own acceptance checks.
