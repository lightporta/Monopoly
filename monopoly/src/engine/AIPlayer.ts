// AI 决策模块（V3.4）：三档难度策略，差距拉大保证游戏刺激性
//   easy  （新手导游）——不多想、随机为主、被动发展，真人最容易赢
//   normal（本地商人）——中等性价比决策，中庸水平
//   hard  （仙境霸主）——深度思考：主动追求三条胜利路径（集齐色块/铁三角地标/资产冲刺），
//                         评估交易 ROI，优先把铁三角地标升到3级房屋

import type { AILevel, ColorGroup, GameConfig, Player, Property } from './types'
import { PropertyManager } from './Property'

export interface AIDecisionContext {
  player: Player
  property: Property
  config: GameConfig
}

// 铁三角地标名称（用于 hard 模式优先建房策略）
const IRON_TRIANGLE_NAMES = new Set(['烟台山', '蓬莱阁', '养马岛'])

export class AIPlayer {
  private aiLevel: AILevel
  private propertyManager: PropertyManager

  constructor(aiLevel: AILevel = 'normal', propertyManager: PropertyManager) {
    this.aiLevel = aiLevel
    this.propertyManager = propertyManager
  }

  getLevel(): AILevel {
    return this.aiLevel
  }

  /**
   * 决定是否购买地产。
   * - easy: 现金门槛极高(×2.5)，且 40% 概率直接放弃（随机被动）
   * - normal: 现金 >= price × 1.5，同组已有地产时更愿买
   * - hard: 现金 >= price × 1.3，评估色块集齐价值，铁三角地标必买
   */
  decideBuy(player: Player, property: Property, config?: GameConfig): boolean {
    const ratio = this.aiLevel === 'easy' ? 2.5 : this.aiLevel === 'hard' ? 1.3 : 1.5
    if (player.cash < property.price * ratio) return false

    // easy：高概率随机放弃，不多想
    if (this.aiLevel === 'easy' && Math.random() < 0.4) return false

    if (this.aiLevel === 'hard') {
      // hard：铁三角地标必买（胜利关键）
      if (IRON_TRIANGLE_NAMES.has(property.name)) return true
      // 评估色块集齐价值：同组已有地产则强买，组小易集齐也买
      const group = this.propertyManager.getColorGroup(property.colorGroup)
      if (group) {
        const ownedInGroup = group.propertyIds.filter((id) => player.properties.includes(id)).length
        if (ownedInGroup > 0 || group.propertyIds.length <= 4) return true
      }
      return true
    }

    if (this.aiLevel === 'normal') {
      const group = this.propertyManager.getColorGroup(property.colorGroup)
      if (group) {
        const ownedInGroup = group.propertyIds.filter((id) => player.properties.includes(id)).length
        if (ownedInGroup > 0) return true
      }
    }

    return true
  }

  /**
   * 决定在哪块地上建房。
   * - easy: 50% 概率跳过建房，建房时随机选地（发展极慢）
   * - normal: 按色组拥有比例 + 等级最低优先
   * - hard: 深度优先——①铁三角地标优先升到3级(胜利条件) ②接近集齐的色组 ③均匀发展；可升旅馆
   */
  decideBuild(
    player: Player,
    properties: Property[],
    colorGroups: ColorGroup[]
  ): string | null {
    // easy：50% 概率本轮不建房
    if (this.aiLevel === 'easy' && Math.random() < 0.5) return null

    const maxLevel = this.aiLevel === 'hard' ? 4 : 3
    const candidates = player.properties
      .filter((id) => !this.propertyManager.isMortgaged(id, player))
      .map((id) => this.propertyManager.getPropertyData(id))
      .filter((p): p is Property => !!p)
      .filter((p) => {
        const level = this.propertyManager.getBuildingLevel(p.id, player)
        return level < maxLevel
      })
      .filter((p) => player.cash >= p.buildCost)

    if (candidates.length === 0) return null

    const groupCount = (groupId: string): number => {
      const group = colorGroups.find((g) => g.id === groupId)
      if (!group) return 0
      return group.propertyIds.filter((id) => player.properties.includes(id)).length
    }
    const groupSize = (groupId: string): number => {
      const group = colorGroups.find((g) => g.id === groupId)
      return group ? group.propertyIds.length : 0
    }

    if (this.aiLevel === 'easy') {
      // easy：随机挑一块可建的，不讲究策略
      return candidates[Math.floor(Math.random() * candidates.length)].id
    }

    if (this.aiLevel === 'hard') {
      // hard 第一优先：铁三角地标（未达3级则优先升级，这是胜利条件）
      const ironTarget = candidates
        .filter((p) => IRON_TRIANGLE_NAMES.has(p.name))
        .sort((a, b) => {
          const la = this.propertyManager.getBuildingLevel(a.id, player)
          const lb = this.propertyManager.getBuildingLevel(b.id, player)
          return la - lb // 等级最低的最先补
        })[0]
      if (ironTarget) return ironTarget.id

      // hard 第二优先：接近集齐的色组，均匀发展
      candidates.sort((a, b) => {
        const aRatio = groupSize(a.colorGroup) === 0 ? 0 : groupCount(a.colorGroup) / groupSize(a.colorGroup)
        const bRatio = groupSize(b.colorGroup) === 0 ? 0 : groupCount(b.colorGroup) / groupSize(b.colorGroup)
        if (bRatio !== aRatio) return bRatio - aRatio
        const aLevel = this.propertyManager.getBuildingLevel(a.id, player)
        const bLevel = this.propertyManager.getBuildingLevel(b.id, player)
        return aLevel - bLevel
      })
      return candidates[0].id
    }

    // normal：色组比例 + 等级最低
    candidates.sort((a, b) => {
      const aRatio = groupSize(a.colorGroup) === 0 ? 0 : groupCount(a.colorGroup) / groupSize(a.colorGroup)
      const bRatio = groupSize(b.colorGroup) === 0 ? 0 : groupCount(b.colorGroup) / groupSize(b.colorGroup)
      if (bRatio !== aRatio) return bRatio - aRatio
      const aLevel = this.propertyManager.getBuildingLevel(a.id, player)
      const bLevel = this.propertyManager.getBuildingLevel(b.id, player)
      return aLevel - bLevel
    })
    return candidates[0].id
  }

  /**
   * 决定抵押哪块地产。
   * - easy: 现金<3000 才抵押，随机挑（可能抵押重要地产）
   * - normal/hard: 现金<2000 触发，保留高价地产与接近集齐的色组
   */
  decideMortgage(player: Player, properties: Property[]): string | null {
    const threshold = this.aiLevel === 'easy' ? 3000 : 2000
    if (player.cash >= threshold) return null

    const candidates = player.properties
      .filter((id) => !this.propertyManager.isMortgaged(id, player))
      .map((id) => this.propertyManager.getPropertyData(id))
      .filter((p): p is Property => !!p)
      .filter((p) => this.propertyManager.getBuildingLevel(p.id, player) === 0)

    if (candidates.length === 0) return null

    if (this.aiLevel === 'easy') {
      return candidates[Math.floor(Math.random() * candidates.length)].id
    }
    // normal/hard：保留铁三角地标与高价地产，抵押最便宜的
    candidates.sort((a, b) => {
      // 铁三角地标绝不抵押
      const aIron = IRON_TRIANGLE_NAMES.has(a.name) ? 1 : 0
      const bIron = IRON_TRIANGLE_NAMES.has(b.name) ? 1 : 0
      if (aIron !== bIron) return aIron - bIron // 非铁三角排前面（优先抵押）
      return a.price - b.price
    })
    return candidates[0].id
  }

  /**
   * 决定传送目标。
   * - easy: 随机挑一块买得起的
   * - normal/hard: 按 baseRent/price 性价比，hard 额外优先铁三角地标
   */
  decideTeleportTarget(emptyProperties: Property[], player: Player): string | null {
    const ratio = this.aiLevel === 'easy' ? 2.0 : 1.5
    const affordable = emptyProperties.filter((p) => player.cash >= p.price * ratio)
    if (affordable.length === 0) return null

    if (this.aiLevel === 'easy') {
      return affordable[Math.floor(Math.random() * affordable.length)].id
    }
    if (this.aiLevel === 'hard') {
      // hard：优先铁三角地标
      const iron = affordable.find((p) => IRON_TRIANGLE_NAMES.has(p.name))
      if (iron) return iron.id
    }
    affordable.sort((a, b) => b.baseRent / b.price - a.baseRent / a.price)
    return affordable[0].id
  }

  // ---------- 落对手地产的交易决策（供 gameStore 调用） ----------

  /**
   * 返回 [买地皮概率, 租房概率, 不操作概率]，按难度分档。
   * easy 几乎只租房；hard 会评估 ROI 积极抄底。
   */
  getLandOpponentWeights(): { buyLand: number; rent: number; skip: number } {
    if (this.aiLevel === 'easy') return { buyLand: 0.05, rent: 0.9, skip: 0.05 }
    if (this.aiLevel === 'hard') return { buyLand: 0.45, rent: 0.45, skip: 0.1 }
    return { buyLand: 0.2, rent: 0.7, skip: 0.1 } // normal
  }

  /**
   * hard 模式评估买地皮是否值得（ROI）。
   * 简单 ROI 模型：该地产未来租金收益（baseRent × 预计收租次数）相对购买价的回报率。
   * 返回 true 表示这笔交易划算。
   * 仅 hard 调用；easy/normal 由概率决定。
   */
  evaluateLandPurchase(property: Property, buyPrice: number, player: Player): boolean {
    // 铁三角地标值得抄底（胜利关键），即使 ROI 一般也买
    if (IRON_TRIANGLE_NAMES.has(property.name)) return player.cash >= buyPrice + 3000
    // ROI 粗估：baseRent × 8（预计收8次租回本）> 购买价的 60% 视为划算
    const expectedReturn = property.baseRent * 8
    const worth = expectedReturn > buyPrice * 0.6
    return worth && player.cash >= buyPrice + 2000
  }

  // ---------- 四大海洋板块 AI 决策 ----------

  /** 决定是否购买装备。easy 少买，hard 积极扩大过路费加成。 */
  decideBuyEquipment(
    player: Player,
    availableEquipment: { equipId: string; soldAtPropertyId: string; price: number; effectColorGroup?: string }[]
  ): { equipId: string; soldAtPropertyId: string; boundPropertyId: string | null } | null {
    const ratio = this.aiLevel === 'easy' ? 2.0 : this.aiLevel === 'hard' ? 1.2 : 1.5
    // easy：30% 概率本轮不买装备
    if (this.aiLevel === 'easy' && Math.random() < 0.3) return null
    for (const eq of availableEquipment) {
      if (player.cash < eq.price * ratio) continue
      if (!player.properties.includes(eq.soldAtPropertyId)) continue
      if (!eq.effectColorGroup) {
        return { equipId: eq.equipId, soldAtPropertyId: eq.soldAtPropertyId, boundPropertyId: null }
      }
      const target = player.properties.find((id) => {
        const prop = this.propertyManager.getPropertyData(id)
        return prop?.colorGroup === eq.effectColorGroup
      })
      if (target) {
        return { equipId: eq.equipId, soldAtPropertyId: eq.soldAtPropertyId, boundPropertyId: target }
      }
    }
    return null
  }

  /** 决定是否建造养殖场。easy 阈值高少建，hard 积极建以增加资产冲刺胜利。 */
  decideBuildAquaculture(
    player: Player,
    aquaProperties: { propertyId: string; cost: number }[]
  ): string | null {
    const ratio = this.aiLevel === 'easy' ? 2.0 : this.aiLevel === 'hard' ? 1.2 : 1.5
    for (const aq of aquaProperties) {
      if (player.cash < aq.cost * ratio) continue
      if (!player.properties.includes(aq.propertyId)) continue
      if ((player.buildings[aq.propertyId] ?? 0) > 0) continue
      const cur = player.aquaculture[aq.propertyId]?.level ?? 0
      if (cur >= 3) continue
      return aq.propertyId
    }
    return null
  }

  /**
   * 决定是否投资核电/风电。
   * - easy: 资金充裕(≥7000)才投风电，回避核电风险
   * - normal: 风电优先，资金充裕才碰核电
   * - hard: 积极投资（资产胜利需要积累资产），风电核电都考虑
   */
  decideInvest(
    player: Player,
    availableProjects: { projectId: string; cost: number; riskLevel: 'low' | 'high' }[]
  ): string | null {
    const minCash = this.aiLevel === 'easy' ? 7000 : this.aiLevel === 'hard' ? 4000 : 5000
    if (player.cash < minCash) return null

    const windRatio = this.aiLevel === 'easy' ? 1.6 : this.aiLevel === 'hard' ? 1.1 : 1.3
    const wind = availableProjects.find((p) => p.riskLevel === 'low' && player.cash >= p.cost * windRatio)
    if (wind) return wind.projectId

    // easy 不投资核电（风险厌恶）
    if (this.aiLevel === 'easy') return null

    const nuclearCashThreshold = this.aiLevel === 'hard' ? 6000 : 8000
    const nuclearRatio = this.aiLevel === 'hard' ? 1.1 : 1.3
    if (player.cash >= nuclearCashThreshold) {
      const nuclear = availableProjects.find((p) => p.riskLevel === 'high' && player.cash >= p.cost * nuclearRatio)
      if (nuclear) return nuclear.projectId
    }
    return null
  }
}
