# V4 validation / 验证记录

Verified locally on **2026-10-30**, macOS arm64, Node.js **24.16.0**, npm **11.13.0**. The repository requires Node 22.12+; Node 22 and other operating systems have not been executed locally in this refactor.

本记录区分共享规则测试、真实本地网络测试、浏览器尺寸模拟和线上部署。当前没有真实云服务器，以下结果不代表公网、跨平台或真实手机已经验收。

| Check / 检查 | Result / 结果 | Evidence / 证据 |
| --- | --- | --- |
| Node regressions / 原生回归 | 35 passed | `npm run check`: 21 engine, 6 browser-shaped client lifecycle, 8 real local HTTP/WebSocket tests |
| Production build / 生产构建 | Passed | Vite builds `monopoly/dist/` with Vue and shared rules; no embedded stale bundle |
| Browser workflows / 浏览器流程 | 4 passed | `npm run test:e2e`, Chromium on macOS |
| AI self-play / 自博弈 | 1,200 / 1,200 finished; 290,603 actions | `node scripts/simulate.js --seeds 100`, 40 rounds, `balance-v4` seed prefix; [raw JSON](validation/ai-balance.json) |
| Dependency audit / 依赖检查 | 0 known vulnerabilities at installation/check | npm audit results for the generated root lockfile; this is not a security certification |
| Formatting / 格式 | Prettier applied; diff whitespace checked | `npm run format`, `git diff --check` |

## What the tests exercise / 覆盖内容

- Engine: immutable actions and seeded replay, legal phases, mandatory rent and actual recovered payment, liquidation, bankruptcy, exact redemption amounts for all 21 deeds, capped investments/upgrades, ecology thresholds, portals, skipped turns, group bonuses, final ranking and ties. Two/three/four-player AI games use the same legal-action API.
- Client: private session callbacks and storage, replaced-seat close code 4001 without a reconnect war, room expiration, invalid sessions, pending action rejection, resume without replaying uncertain commands, retrying a failed first connection and leaving.
- Server: independent WebSocket clients, shared state, room membership/readiness, host permissions, request deduplication, revision checks, private tokens, socket replacement, host migration, deadlines and AI completion, explicit leave, TTL, finished-room admission/restart, safe static paths, health/HEAD/cache/Origin handling.
- Browser: Chinese/English local play, purchase decisions, hotseat handoff, autosave/refresh/resume; two separate browser contexts playing the same room and refreshing back into a seat; a full 10-round AI game at a 390×844 viewport without page overflow; a new human joining a finished room, readying and restarting.

浏览器回归使用真实 Chromium 和本地服务端；客户端单元测试使用可控的 FakeWebSocket，服务端测试使用真正的本机 HTTP/WebSocket 连接。390×844 是浏览器视口模拟，不是真实手机设备测试。

The asynchronous browser test waits for the purchase/manage phase after a WebSocket roll; it does not assume the server reply is synchronous. Finished-room readiness and replaced-tab recovery were specifically checked after independent review.

## Interpreting AI results / AI 数据边界

The simulator rotates difficulty policies through each seat for five scenarios. Normal vs hard: hard receives 52.5% of win credit. Mixed three-player: easy 14.33%, normal 38.67%, hard 47%. Equal normal AI: seats receive 31% / 36% / 33%. Ties divide credit equally.

这些结果用于检查固定策略的终局、座位差异和难度区分。困难 AI 不保证必胜，有限样本也不能证明所有座位完全平衡；数据不能当成真人胜率、联网性能或部署成功率。

## Not executed / 尚未实测

- Public server, real DNS/TLS/WSS, Nginx/systemd and Docker builds.
- Remote GitHub Actions after a push; CI configuration is supplied but no push was performed.
- Real iOS/Android devices, Windows/Linux runtime, or multi-network acceptance.
- Load/endurance testing, accounts, durable online recovery, or multi-process coordination.

联机房间只在单个进程内存里，重启即丢失；断线身份按浏览器标签页保存。请部署单副本，并按[部署指南](deploy/deployment-guide.md)完成真实跨设备、公网及 TLS 验收。
