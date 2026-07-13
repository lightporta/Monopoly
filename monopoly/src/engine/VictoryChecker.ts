// 胜利判定模块（V3.4）：三条独立胜利条件，任意达成即胜
//   1. 破产胜利：仅剩 1 名非破产玩家
//   2. 仙境铁三角胜利：拥有烟台山+蓬莱阁+养马岛，且每处地标建筑等级 >= ironTriangleHouseLevel(3)
//   3. 资产胜利：任一玩家总资产 > ironTriangleMinAssets(30000)

import type { GameConfig, Player, Property } from './types'

export type WinReason = 'bankruptcy' | 'ironTriangle' | 'assets'

export interface VictoryResult {
  winner: Player
  reason: WinReason
  message: string
}

export class VictoryChecker {
  private propertyMap: Map<string, Property>
  private config: GameConfig
  // 缓存铁三角 propertyId，避免重复查找
  private ironTriangleIds: string[] = []

  constructor(properties: Property[], config: GameConfig) {
    this.propertyMap = new Map(properties.map((p) => [p.id, p]))
    this.config = config
    this.ironTriangleIds = config.victory.ironTriangle
      .map((name) => this.findPropertyIdByName(name))
      .filter((id): id is string => !!id)
  }

  /**
   * 统一胜利检查入口：遍历所有存活玩家，按三条独立条件判定。
   * 优先级：破产 > 铁三角 > 资产（同帧多条件时按此序取第一个）。
   * assetsFn 由外部注入统一资产计算口径（含四大板块估值）。
   */
  checkVictory(players: Player[], assetsFn: (p: Player) => number): VictoryResult | null {
    // 1. 破产胜利
    const bankruptcyWinner = this.checkBankruptcy(players)
    if (bankruptcyWinner) {
      return {
        winner: bankruptcyWinner,
        reason: 'bankruptcy',
        message: `${bankruptcyWinner.name} 成为最后存活的玩家，获得胜利！`
      }
    }

    const alive = players.filter((p) => !p.bankrupt)

    // 2. 铁三角胜利（遍历所有存活玩家）
    for (const p of alive) {
      if (this.checkIronTriangle(p)) {
        return {
          winner: p,
          reason: 'ironTriangle',
          message: `${p.name} 集齐仙境铁三角（三地标各建3座房屋），获得胜利！`
        }
      }
    }

    // 3. 资产胜利（遍历所有存活玩家）
    const minAssets = this.config.victory.ironTriangleMinAssets ?? 0
    if (minAssets > 0) {
      for (const p of alive) {
        if (assetsFn(p) > minAssets) {
          return {
            winner: p,
            reason: 'assets',
            message: `${p.name} 总资产突破 ${minAssets}，获得胜利！`
          }
        }
      }
    }

    return null
  }

  /**
   * 破产胜利：仅剩 1 名非破产玩家时返回该玩家。
   */
  checkBankruptcy(players: Player[]): Player | null {
    const alive = players.filter((p) => !p.bankrupt)
    if (alive.length === 1) return alive[0]
    return null
  }

  /**
   * 仙境铁三角胜利条件：
   *   1. 拥有烟台山 + 蓬莱阁 + 养马岛
   *   2. 各地标建筑等级 >= ironTriangleHouseLevel(默认 3，即每处3座房屋)
   */
  checkIronTriangle(player: Player): boolean {
    if (this.ironTriangleIds.length === 0) return false

    // 条件1：拥有三处地标
    const ownsAll = this.ironTriangleIds.every((id) => player.properties.includes(id))
    if (!ownsAll) return false

    // 条件2：各地标建筑等级达标
    const requiredLevel = this.config.victory.ironTriangleNeedHouses
      ? (this.config.victory.ironTriangleHouseLevel ?? 1)
      : 0
    if (requiredLevel > 0) {
      const allBuilt = this.ironTriangleIds.every(
        (id) => (player.buildings[id] ?? 0) >= requiredLevel
      )
      if (!allBuilt) return false
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
