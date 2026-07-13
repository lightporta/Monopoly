// AI 决策模块：购买 / 建房 / 抵押 / 传送目标 / 四大海洋板块
// 三档难度策略梯度：
//   easy  （新手导游）——保守、随机性强、不主动交易/集齐、建房慢，真人最容易赢
//   normal（本地商人）——中庸，按基础性价比决策
//   hard  （仙境霸主）——积极集齐色块、建房补齐集齐组、评估交易 ROI、积极投资

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

  getLevel(): AILevel {
    return this.aiLevel
  }

  /**
   * 决定是否购买地产（难度越高越积极、越注重集齐色块）。
   * - easy: 现金 >= price × 2.0，且有 30% 概率直接放弃（随机性强）
   * - normal: 现金 >= price × 1.5
   * - hard: 现金 >= price × 1.3，且优先购买能集齐色块的地标
   */
  decideBuy(player: Player, property: Property, config?: GameConfig): boolean {
    const ratio = this.aiLevel === 'easy' ? 2.0 : this.aiLevel === 'hard' ? 1.3 : 1.5
    if (player.cash < property.price * ratio) return false

    // easy：有概率放弃购买，决策更具随机性
    if (this.aiLevel === 'easy' && Math.random() < 0.3) return false

    if (this.aiLevel === 'hard') {
      // hard：若该颜色组已有自己地产或组小易集齐，强烈倾向购买
      const group = this.propertyManager.getColorGroup(property.colorGroup)
      if (group) {
        const ownedInGroup = group.propertyIds.filter((id) => player.properties.includes(id)).length
        if (ownedInGroup > 0 || group.propertyIds.length <= 4) return true
      }
      return true
    }

    if (this.aiLevel === 'normal') {
      // normal：同组已有地产时更愿意买
      const group = this.propertyManager.getColorGroup(property.colorGroup)
      if (group) {
        const ownedInGroup = group.propertyIds.filter((id) => player.properties.includes(id)).length
        if (ownedInGroup > 0) return true
      }
    }

    return true
  }

  /**
   * 决定在哪块地上建房。难度越高越注重"集齐色块"和"均匀发展"。
   * - easy: 倾向随机建房，偶尔跳过
   * - normal: 按色组拥有比例 + 等级最低优先
   * - hard: 严格优先补齐接近集齐的色组，并积极建房升旅馆
   */
  decideBuild(
    player: Player,
    properties: Property[],
    colorGroups: ColorGroup[]
  ): string | null {
    // easy：40% 概率本轮不建房（发展缓慢）
    if (this.aiLevel === 'easy' && Math.random() < 0.4) return null

    const maxLevel = this.aiLevel === 'hard' ? 4 : 3 // hard 会考虑升旅馆
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

    candidates.sort((a, b) => {
      const aOwned = groupCount(a.colorGroup)
      const aSize = groupSize(a.colorGroup)
      const bOwned = groupCount(b.colorGroup)
      const bSize = groupSize(b.colorGroup)
      const aRatio = aSize === 0 ? 0 : aOwned / aSize
      const bRatio = bSize === 0 ? 0 : bOwned / bSize
      if (bRatio !== aRatio) return bRatio - aRatio
      const aLevel = this.propertyManager.getBuildingLevel(a.id, player)
      const bLevel = this.propertyManager.getBuildingLevel(b.id, player)
      return aLevel - bLevel
    })

    return candidates[0].id
  }

  /**
   * 决定抵押哪块地产。
   * - easy: 现金 < 3000 才抵押，且随便挑一块无建筑的
   * - normal/hard: 现金 < 2000 触发，保留高价值/接近集齐的地产
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
      // easy：随机抵押，可能抵押掉重要地产
      return candidates[Math.floor(Math.random() * candidates.length)].id
    }
    // normal/hard：抵押价格最低的地产（保留高价地产与接近集齐的色组）
    candidates.sort((a, b) => a.price - b.price)
    return candidates[0].id
  }

  /**
   * 决定传送目标：从空地中挑选买得起且性价比最高的地产。
   * - easy: 随机挑一块买得起的
   * - normal/hard: 按 baseRent/price 性价比排序
   */
  decideTeleportTarget(emptyProperties: Property[], player: Player): string | null {
    const ratio = this.aiLevel === 'easy' ? 2.0 : 1.5
    const affordable = emptyProperties.filter((p) => player.cash >= p.price * ratio)
    if (affordable.length === 0) return null

    if (this.aiLevel === 'easy') {
      return affordable[Math.floor(Math.random() * affordable.length)].id
    }
    affordable.sort((a, b) => b.baseRent / b.price - a.baseRent / a.price)
    return affordable[0].id
  }

  // ---------- 落对手地产的交易决策（供 gameStore 调用） ----------

  /**
   * 返回 [买地皮概率, 租房概率, 不操作概率]，按难度分档。
   * easy 基本只租房；hard 更倾向抄底买地皮。
   */
  getLandOpponentWeights(): { buyLand: number; rent: number; skip: number } {
    if (this.aiLevel === 'easy') return { buyLand: 0.05, rent: 0.85, skip: 0.1 }
    if (this.aiLevel === 'hard') return { buyLand: 0.4, rent: 0.5, skip: 0.1 }
    return { buyLand: 0.2, rent: 0.7, skip: 0.1 } // normal
  }

  // ---------- 四大海洋板块 AI 决策 ----------

  /**
   * 决定是否购买装备。
   * - easy: 资金阈值高(×2.0)，少买
   * - normal: ×1.5
   * - hard: ×1.2，积极购买以扩大过路费加成
   */
  decideBuyEquipment(
    player: Player,
    availableEquipment: { equipId: string; soldAtPropertyId: string; price: number; effectColorGroup?: string }[]
  ): { equipId: string; soldAtPropertyId: string; boundPropertyId: string | null } | null {
    const ratio = this.aiLevel === 'easy' ? 2.0 : this.aiLevel === 'hard' ? 1.2 : 1.5
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

  /**
   * 决定是否建造养殖场。
   * - easy: 资金阈值高(×2.0)
   * - normal: ×1.5
   * - hard: ×1.2
   */
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
   * - easy: 只投风电且资金阈值高，回避核电高风险
   * - normal: 风电优先，资金充裕才碰核电
   * - hard: 积极投资，风电核电都考虑
   */
  decideInvest(
    player: Player,
    availableProjects: { projectId: string; cost: number; riskLevel: 'low' | 'high' }[]
  ): string | null {
    const minCash = this.aiLevel === 'easy' ? 7000 : 5000
    if (player.cash < minCash) return null

    const windRatio = this.aiLevel === 'easy' ? 1.6 : this.aiLevel === 'hard' ? 1.2 : 1.3
    const wind = availableProjects.find((p) => p.riskLevel === 'low' && player.cash >= p.cost * windRatio)
    if (wind) return wind.projectId

    // easy 不投资核电（风险厌恶）
    if (this.aiLevel === 'easy') return null

    const nuclearCashThreshold = this.aiLevel === 'hard' ? 6500 : 8000
    const nuclearRatio = this.aiLevel === 'hard' ? 1.2 : 1.3
    if (player.cash >= nuclearCashThreshold) {
      const nuclear = availableProjects.find((p) => p.riskLevel === 'high' && player.cash >= p.cost * nuclearRatio)
      if (nuclear) return nuclear.projectId
    }
    return null
  }
}
