// 租金计算模块：根据地产等级、颜色组加成、抵押状态计算应付租金

import type { ColorGroup, GameConfig, Player, Property } from './types'
import { PropertyManager } from './Property'

export class RentCalculator {
  private propertyMap: Map<string, Property>
  private colorGroupMap: Map<string, ColorGroup>
  private config: GameConfig
  private propertyManager: PropertyManager

  constructor(
    properties: Property[],
    colorGroups: ColorGroup[],
    config: GameConfig,
    propertyManager: PropertyManager
  ) {
    this.propertyMap = new Map(properties.map((p) => [p.id, p]))
    this.colorGroupMap = new Map(colorGroups.map((g) => [g.id, g]))
    this.config = config
    this.propertyManager = propertyManager
  }

  /**
   * 计算访客在 ownerPlayer 的 propertyId 上应支付的租金。
   * 规则：
   * 1. 若该地产已被抵押，租金 = 0。
   * 2. 否则取 rentByLevel[level] 作为基础租金（已含建筑倍率）。
   * 3. 若 ownerPlayer 在该颜色组满足 bonusRule（拥有足够数量），
   *    则额外乘以 rentMultiplier（仅对空地等级生效，避免与建筑倍率叠加膨胀）。
   * 4. 若访客拥有免租券（freeRentTickets > 0），租金 = 0（由调用方消耗券）。
   *
   * 返回 0 表示无需支付（抵押 / 访客免租券等情况）。
   */
  calculate(propertyId: string, ownerPlayer: Player, visitorPlayer: Player): number {
    const data = this.propertyMap.get(propertyId)
    if (!data) return 0

    // 抵押地产不收租
    if (this.propertyManager.isMortgaged(propertyId, ownerPlayer)) return 0

    // 访客有免租券 → 返回 0（券的消耗由 Game 层负责）
    if (visitorPlayer.freeRentTickets > 0) return 0

    const level = this.propertyManager.getBuildingLevel(propertyId, ownerPlayer)
    const baseRent = this.rentByLevel(data, level)

    // 颜色组加成：仅在空地时叠加（避免双重倍率膨胀）
    let multiplier = 1
    if (level === 0) {
      multiplier = this.getColorGroupBonus(data.colorGroup, ownerPlayer)
    }

    return Math.floor(baseRent * multiplier)
  }

  /** 根据建筑等级取 rentByLevel 中对应的值 */
  private rentByLevel(data: Property, level: number): number {
    switch (level) {
      case 0:
        return data.rentByLevel.empty
      case 1:
        return data.rentByLevel.house1
      case 2:
        return data.rentByLevel.house2
      case 3:
        return data.rentByLevel.house3
      case 4:
        return data.rentByLevel.hotel
      default:
        return data.rentByLevel.empty
    }
  }

  /**
   * 颜色组加成倍率：
   * - type 'all': 需拥有该组全部 propertyIds 才生效（requiredCount 应等于组内数量）
   * - type 'count': 拥有数量 >= requiredCount 即生效
   * 满足条件返回 rentMultiplier，否则返回 1。
   */
  private getColorGroupBonus(groupId: string, owner: Player): number {
    const group = this.colorGroupMap.get(groupId)
    if (!group) return 1

    const ownedCount = group.propertyIds.filter((id) => owner.properties.includes(id)).length

    if (group.bonusRule.type === 'all') {
      // 必须拥有该组所有地产
      if (ownedCount === group.propertyIds.length) {
        return group.bonusRule.rentMultiplier
      }
      return 1
    } else {
      // count 类型：达到 requiredCount 即可
      if (ownedCount >= group.bonusRule.requiredCount) {
        return group.bonusRule.rentMultiplier
      }
      return 1
    }
  }

  /** 暴露给外部：判断某玩家在某颜色组上是否满足加成条件 */
  hasColorGroupBonus(groupId: string, owner: Player): boolean {
    return this.getColorGroupBonus(groupId, owner) > 1
  }
}
