// 海产养殖系统：建造 / 升级 / 拆除 / 过起点收益结算
// 4 处海岸渔业相关地产可选建造养殖场（与房屋互斥），提供 3 级被动收入，每经过起点结算。
// 核心铁律：养殖地产仍收过路费，但过路费恒为「空地基础 × 色块加成」，不随养殖等级提升。

import type { AquacultureState, GameConfig, Player, Property } from './types'

export interface AquaResult {
  ok: boolean
  message: string
  level?: number
  cost?: number
}

export class AquacultureManager {
  private propertyMap: Map<string, Property>
  private config: GameConfig

  constructor(properties: Property[], config: GameConfig) {
    this.propertyMap = new Map(properties.map((p) => [p.id, p]))
    this.config = config
  }

  /** 该地产是否支持养殖 */
  isAquacultureProperty(propertyId: string): boolean {
    const prop = this.propertyMap.get(propertyId)
    return !!prop?.aquaculture?.enabled
  }

  /** 获取玩家在该地产上的养殖状态（无则 null） */
  getState(propertyId: string, player: Player): AquacultureState | null {
    return player.aquaculture[propertyId] ?? null
  }

  /** 当前等级（0=未建） */
  getLevel(propertyId: string, player: Player): number {
    return player.aquaculture[propertyId]?.level ?? 0
  }

  /**
   * 建造 / 升级养殖场。
   * 互斥规则：一旦建造养殖场，本局不可再建房（同块地产）。
   * 调用方需保证 player.buildings[propertyId] === 0。
   */
  buildOrUpgrade(propertyId: string, player: Player): AquaResult {
    const prop = this.propertyMap.get(propertyId)
    if (!prop?.aquaculture) return { ok: false, message: '该地产不支持养殖' }
    if (!player.properties.includes(propertyId)) return { ok: false, message: '该地产不属于你' }
    if (this.isMortgaged(propertyId, player)) return { ok: false, message: '地产已抵押，无法操作' }

    // 互斥：已有建筑则不可建养殖
    const bldLevel = player.buildings[propertyId] ?? 0
    if (bldLevel > 0) return { ok: false, message: '该地产已建造房屋/旅馆，与养殖场互斥' }

    const currentLevel = this.getLevel(propertyId, player)
    if (currentLevel >= 3) return { ok: false, message: '已达最高等级（深海牧场）' }

    const nextLevel = currentLevel + 1
    const cost = prop.aquaculture.levels[currentLevel].cost
    if (player.cash < cost) return { ok: false, message: '资金不足' }

    player.cash -= cost
    player.aquaculture[propertyId] = {
      propertyId,
      level: nextLevel,
      incomeDebuffTurns: 0,
      debuffFactor: 1,
    }
    return {
      ok: true,
      level: nextLevel,
      cost,
      message: `${prop.name} 养殖场升级至 ${prop.aquaculture.levels[nextLevel - 1].name}`,
    }
  }

  /** 拆除养殖场，回收 50% 累计投入 */
  demolish(propertyId: string, player: Player): AquaResult {
    const prop = this.propertyMap.get(propertyId)
    if (!prop?.aquaculture) return { ok: false, message: '该地产不支持养殖' }
    if (!player.properties.includes(propertyId)) return { ok: false, message: '该地产不属于你' }
    const state = player.aquaculture[propertyId]
    if (!state || state.level === 0) return { ok: false, message: '该地产未建养殖场' }

    // 累计投入 = 前 level 级的 cost 之和
    let invested = 0
    for (let i = 0; i < state.level; i++) {
      invested += prop.aquaculture.levels[i].cost
    }
    const refund = Math.floor(invested * this.config.aquaculture.demolishRefundRatio)
    player.cash += refund
    delete player.aquaculture[propertyId]
    return { ok: true, cost: refund, message: `拆除 ${prop.name} 养殖场，回收 ${refund}` }
  }

  /**
   * 过起点结算：玩家名下所有养殖场一次性入账。
   * 受生态减益系数 + 赤潮减益系数影响。
   * 返回总收益与明细（用于日志）。
   */
  settleIncome(player: Player, ecologyPenalty: number): { total: number; details: { name: string; income: number; level: number }[] } {
    let total = 0
    const details: { name: string; income: number; level: number }[] = []
    for (const propertyId of Object.keys(player.aquaculture)) {
      const state = player.aquaculture[propertyId]
      if (!state || state.level === 0) continue
      const prop = this.propertyMap.get(propertyId)
      if (!prop?.aquaculture) continue

      // 基础收益 = 当前等级对应的 income
      let income = prop.aquaculture.levels[state.level - 1].income
      // 生态减益（预警 -30%，危机 -60%）
      income = Math.floor(income * (1 - ecologyPenalty))
      // 赤潮减益（state.debuffFactor，如 0.5 = 再扣 50%）
      if (state.incomeDebuffTurns > 0) {
        income = Math.floor(income * state.debuffFactor)
      }
      player.cash += income
      total += income
      details.push({ name: prop.name, income, level: state.level })
    }
    return { total, details }
  }

  /** 赤潮减益：所有养殖场 N 回合收益减半 */
  applyRedTideDebuff(player: Player): string[] {
    const affected: string[] = []
    for (const propertyId of Object.keys(player.aquaculture)) {
      const state = player.aquaculture[propertyId]
      if (state && state.level > 0) {
        state.incomeDebuffTurns = this.config.aquaculture.debuffTurnsOnRedTide
        state.debuffFactor = this.config.aquaculture.debuffFactor
        const prop = this.propertyMap.get(propertyId)
        if (prop) affected.push(prop.name)
      }
    }
    return affected
  }

  /** 台风降级：随机 1 处养殖场降 1 级 */
  applyTyphoonDowngrade(player: Player): string | null {
    const candidates = Object.keys(player.aquaculture).filter((id) => {
      const s = player.aquaculture[id]
      return s && s.level > 0
    })
    if (candidates.length === 0) return null
    const target = candidates[Math.floor(Math.random() * candidates.length)]
    const state = player.aquaculture[target]
    state.level -= 1
    const prop = this.propertyMap.get(target)
    return prop?.name ?? null
  }

  /** 每回合维护：递减赤潮减益回合数 */
  tickDebuffs(player: Player): void {
    for (const propertyId of Object.keys(player.aquaculture)) {
      const state = player.aquaculture[propertyId]
      if (state && state.incomeDebuffTurns > 0) {
        state.incomeDebuffTurns -= 1
        if (state.incomeDebuffTurns === 0) {
          state.debuffFactor = 1
        }
      }
    }
  }

  private isMortgaged(propertyId: string, player: Player): boolean {
    return player.mortgaged.includes(propertyId)
  }

  /** 破产清算：所有养殖场清除（归银行变无主），累计投入不退还 */
  liquidateAll(player: Player): void {
    player.aquaculture = {}
  }

  /** 计算玩家养殖场估值（用于结算总资产） */
  estimateValue(player: Player): number {
    let value = 0
    for (const propertyId of Object.keys(player.aquaculture)) {
      const state = player.aquaculture[propertyId]
      if (!state || state.level === 0) continue
      const prop = this.propertyMap.get(propertyId)
      if (!prop?.aquaculture) continue
      for (let i = 0; i < state.level; i++) {
        value += prop.aquaculture.levels[i].cost
      }
    }
    return value
  }
}
