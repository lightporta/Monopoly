// AI 决策模块：购买 / 建房 / 抵押 / 传送目标 选择

import type { AILevel, ColorGroup, GameConfig, Player, Property } from './types'
import { PropertyManager } from './Property'

export interface AIDecisionContext {
  player: Player
  property: Property
  config: GameConfig
}

export class AIPlayer {
  private aiLevel: AILevel
  private propertyManager: PropertyManager

  constructor(aiLevel: AILevel = 'normal', propertyManager: PropertyManager) {
    this.aiLevel = aiLevel
    this.propertyManager = propertyManager
  }

  /**
   * 决定是否购买地产：
   * - easy: 现金 >= price × 1.2
   * - normal: 现金 >= price × 1.5
   * - hard: 现金 >= price × 1.5 且考虑颜色组集齐收益
   * 返回 true 表示购买。
   */
  decideBuy(player: Player, property: Property, config?: GameConfig): boolean {
    const ratio = this.aiLevel === 'easy' ? 1.2 : 1.5
    if (player.cash < property.price * ratio) return false

    if (this.aiLevel === 'hard') {
      // hard 模式：若该颜色组中已有玩家拥有的地产，则更愿意购买（集齐加成）
      const group = this.propertyManager.getColorGroup(property.colorGroup)
      if (group) {
        const ownedInGroup = group.propertyIds.filter((id) =>
          player.properties.includes(id)
        ).length
        // 已有同组地产，或该组地产总数较少（更易集齐）时倾向购买
        if (ownedInGroup > 0 || group.propertyIds.length <= 4) {
          return true
        }
      }
    }

    return true
  }

  /**
   * 决定在哪块地上建房：
   * 优先选择能立即集齐颜色组加成的地产；
   * 其次选择等级最低的地产；
   * 返回 propertyId 或 null。
   */
  decideBuild(
    player: Player,
    properties: Property[],
    colorGroups: ColorGroup[]
  ): string | null {
    const candidates = player.properties
      .filter((id) => !this.propertyManager.isMortgaged(id, player))
      .map((id) => this.propertyManager.getPropertyData(id))
      .filter((p): p is Property => !!p)
      .filter((p) => {
        const level = this.propertyManager.getBuildingLevel(p.id, player)
        return level < 3 // 只建房屋，旅馆升级由更高优先级逻辑触发
      })
      .filter((p) => player.cash >= p.buildCost)

    if (candidates.length === 0) return null

    // 优先：在该颜色组中拥有的数量最多（接近集齐）的地产
    const groupCount = (groupId: string): number => {
      const group = colorGroups.find((g) => g.id === groupId)
      if (!group) return 0
      return group.propertyIds.filter((id) => player.properties.includes(id)).length
    }

    const groupSize = (groupId: string): number => {
      const group = colorGroups.find((g) => g.id === groupId)
      return group ? group.propertyIds.length : 0
    }

    candidates.sort((a, b) => {
      const aOwned = groupCount(a.colorGroup)
      const aSize = groupSize(a.colorGroup)
      const bOwned = groupCount(b.colorGroup)
      const bSize = groupSize(b.colorGroup)
      // 拥有比例高者优先
      const aRatio = aSize === 0 ? 0 : aOwned / aSize
      const bRatio = bSize === 0 ? 0 : bOwned / bSize
      if (bRatio !== aRatio) return bRatio - aRatio
      // 比例相同时，选建筑等级较低的优先均匀发展
      const aLevel = this.propertyManager.getBuildingLevel(a.id, player)
      const bLevel = this.propertyManager.getBuildingLevel(b.id, player)
      return aLevel - bLevel
    })

    return candidates[0].id
  }

  /**
   * 决定抵押哪块地产（现金 < 2000 时触发）：
   * 优先抵押无建筑、颜色组中拥有数量最少的地产。
   * 返回 propertyId 或 null。
   */
  decideMortgage(player: Player, properties: Property[]): string | null {
    if (player.cash >= 2000) return null

    const candidates = player.properties
      .filter((id) => !this.propertyManager.isMortgaged(id, player))
      .map((id) => this.propertyManager.getPropertyData(id))
      .filter((p): p is Property => !!p)
      .filter((p) => this.propertyManager.getBuildingLevel(p.id, player) === 0)

    if (candidates.length === 0) return null

    // 抵押价格最低的地产（保留高价地产）
    candidates.sort((a, b) => a.price - b.price)
    return candidates[0].id
  }

  /**
   * 决定传送目标（用于 anyEmpty 传送格）：
   * 从空地中挑选玩家买得起且性价比最高的地产。
   * 返回 propertyId 或 null。
   */
  decideTeleportTarget(emptyProperties: Property[], player: Player): string | null {
    const affordable = emptyProperties.filter((p) => player.cash >= p.price * 1.5)
    if (affordable.length === 0) return null

    // 性价比：baseRent / price 越高越优
    affordable.sort((a, b) => b.baseRent / b.price - a.baseRent / a.price)
    return affordable[0].id
  }
}
