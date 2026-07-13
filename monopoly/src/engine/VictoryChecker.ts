// 胜利判定模块：破产胜利（优先）/ 仙境铁三角胜利

import type { GameConfig, Player, Property } from './types'

export class VictoryChecker {
  private propertyMap: Map<string, Property>
  private config: GameConfig

  constructor(properties: Property[], config: GameConfig) {
    this.propertyMap = new Map(properties.map((p) => [p.id, p]))
    this.config = config
  }

  /**
   * 检查破产胜利条件：若仅剩 1 名非破产玩家，返回该玩家作为胜利者；否则返回 null。
   * 破产胜利优先于铁三角胜利。
   */
  checkBankruptcy(players: Player[]): Player | null {
    const alive = players.filter((p) => !p.bankrupt)
    if (alive.length === 1) return alive[0]
    return null
  }

  /**
   * 检查仙境铁三角胜利条件，需同时满足：
   *   1. 拥有烟台山 + 蓬莱阁 + 养马岛 三处地标
   *   2.（若 ironTriangleNeedHouses）三处地标均至少建有 1 级房屋
   *   3. 玩家总资产 > ironTriangleMinAssets（默认 30000）
   * assetsFn 由外部注入，统一资产计算口径（含四大板块估值）。
   */
  checkIronTriangle(player: Player, assetsFn?: (p: Player) => number): boolean {
    const requiredNames = this.config.victory.ironTriangle
    const requiredIds = requiredNames
      .map((name) => this.findPropertyIdByName(name))
      .filter((id): id is string => !!id)

    if (requiredIds.length === 0) return false

    // 条件1：拥有三处地标
    const ownsAll = requiredIds.every((id) => player.properties.includes(id))
    if (!ownsAll) return false

    // 条件2：各地标均建有房屋（>=1 级，旅馆算 4 级也满足）
    if (this.config.victory.ironTriangleNeedHouses) {
      const allBuilt = requiredIds.every((id) => (player.buildings[id] ?? 0) >= 1)
      if (!allBuilt) return false
    }

    // 条件3：总资产达标
    const minAssets = this.config.victory.ironTriangleMinAssets ?? 0
    if (minAssets > 0) {
      const total = assetsFn ? assetsFn(player) : player.cash
      if (total <= minAssets) return false
    }

    return true
  }

  /** 根据地产名称查找 propertyId */
  private findPropertyIdByName(name: string): string | undefined {
    for (const [id, prop] of this.propertyMap) {
      if (prop.name === name) return id
    }
    return undefined
  }
}
