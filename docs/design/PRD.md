# V4 产品范围 / Product scope

[中文说明](../../README.zh-CN.md) · [English overview](../../README.md)

保留烟台海岸主题，为2–4位玩家提供同设备与跨设备的完整地产对局。核心交付为一套共享规则、可解释的AI、服务端权威房间和中英文界面。具体行为以[规则](game-rules.md)和[架构](TechnicalArchitecture.md)为准。

Keep the Yantai coastal setting and support complete 2–4-player property matches locally or across devices. The core deliverable is one rules engine, explainable AI, authoritative rooms and a bilingual interface. See [rules](game-rules.en.md) and [architecture](TechnicalArchitecture.en.md) for the implemented behavior.

## 验收 / Acceptance

- 单机支持AI、真人轮流、自动存档及结算；local supports AI, hotseat humans, autosave and standings.
- 联机支持创建/加入/准备/机器人/开局/同步/重连/超时代行/离开/重开；online supports the full room lifecycle.
- 人类和AI遵守相同的支付、建造、投资和终局规则；human and AI actions use identical rules.
- 中英文覆盖用户流程、地标、动态日志及规则；both languages cover the complete user journey.
- 验证范围按实际记录，不以本地测试代替公网、跨平台或实机验收；validation claims follow actual evidence.

账号、公开匹配、聊天、联机持久化、多进程、玩家交易与拍卖不在V4范围。
Accounts, public matchmaking, chat, durable online rooms, multiple processes, player trades and auctions are outside v4.
