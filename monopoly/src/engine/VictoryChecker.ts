// 胜利判定模块：最后一人存活 / 铁三角胜利

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
   */
  checkBankruptcy(players: Player[]): Player | null {
    const alive = players.filter((p) => !p.bankrupt)
    if (alive.length === 1) return alive[0]
    return null
  }

  /**
   * 检查铁三角胜利条件：玩家同时拥有
   *   烟台山(prop_06) + 蓬莱阁(prop_24) + 养马岛(prop_17)
   * 三处地标对应地产。
   * 通过 game-config.victory.ironTriangle 中的名称匹配 property.id。
   */
  checkIronTriangle(player: Player): boolean {
    const requiredNames = this.config.victory.ironTriangle
    // 将名称解析为 propertyId
    const requiredIds = requiredNames
      .map((name) => this.findPropertyIdByName(name))
      .filter((id): id is string => !!id)

    if (requiredIds.length === 0) return false
    return requiredIds.every((id) => player.properties.includes(id))
  }

  /** 根据地产名称查找 propertyId */
  private findPropertyIdByName(name: string): string | undefined {
    for (const [id, prop] of this.propertyMap) {
      if (prop.name === name) return id
    }
    return undefined
  }
}
