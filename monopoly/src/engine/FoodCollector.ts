// 美食收集模块：经过起点抽美食卡，集齐 4 种兑换奖励

import type { FoodItem, Player } from './types'

export interface FoodData {
  collectRule: {
    trigger: string
    drawCount: number
    redeemSetSize: number
    redeemOptions: Array<{ type: 'cash'; amount: number } | { type: 'freeRent'; uses: number }>
  }
  items: FoodItem[]
  distribution: Record<string, number>
}

export type RedeemOption = 'cash' | 'freeRent'

/**
 * FoodCollector 负责管理美食卡的抽取与兑换。
 * 内部维护一个按 distribution 配置的卡池，抽完后自动重洗。
 */
export class FoodCollector {
  private items: FoodItem[]
  private pool: string[] // 当前剩余可抽的 foodId 列表
  private distribution: Record<string, number>
  private redeemSetSize: number
  private cashReward: number
  private freeRentUses: number

  constructor(data: FoodData) {
    this.items = data.items.slice()
    this.distribution = { ...data.distribution }
    this.redeemSetSize = data.collectRule.redeemSetSize
    this.cashReward = 0
    this.freeRentUses = 0
    for (const opt of data.collectRule.redeemOptions) {
      if (opt.type === 'cash') this.cashReward = opt.amount
      else this.freeRentUses = opt.uses
    }
    this.pool = this.buildFreshPool()
  }

  /** 按 distribution 构建一个全新的卡池 */
  private buildFreshPool(): string[] {
    const pool: string[] = []
    for (const item of this.items) {
      const count = this.distribution[item.id] ?? 0
      for (let i = 0; i < count; i++) pool.push(item.id)
    }
    return pool
  }

  /**
   * 玩家经过起点时调用：随机抽 1 张美食卡加入 player.foodCards。
   * 内部池为空时自动重洗。
   */
  drawOnPassStart(player: Player): FoodItem | null {
    if (this.items.length === 0) return null
    if (this.pool.length === 0) {
      this.pool = this.buildFreshPool()
    }
    const idx = Math.floor(Math.random() * this.pool.length)
    const foodId = this.pool.splice(idx, 1)[0]
    player.foodCards.push(foodId)
    return this.items.find((i) => i.id === foodId) ?? null
  }

  /**
   * 判断玩家是否集齐 redeemSetSize 种不同美食卡。
   * 默认 redeemSetSize=4，即 4 种各 1 张。
   */
  canRedeem(player: Player): boolean {
    const uniqueTypes = new Set(player.foodCards)
    return uniqueTypes.size >= this.redeemSetSize
  }

  /**
   * 兑换奖励：从玩家手牌中移除每种美食各 1 张，
   * 根据选项发放现金或免租券。
   * 返回是否兑换成功。
   */
  redeem(player: Player, option: RedeemOption): boolean {
    if (!this.canRedeem(player)) return false

    // 收集 redeemSetSize 种不同 foodId，每种移除 1 张
    const uniqueTypes = Array.from(new Set(player.foodCards))
    const toRemove = uniqueTypes.slice(0, this.redeemSetSize)

    for (const foodId of toRemove) {
      const idx = player.foodCards.indexOf(foodId)
      if (idx >= 0) player.foodCards.splice(idx, 1)
    }

    if (option === 'cash') {
      player.cash += this.cashReward
    } else {
      player.freeRentTickets += this.freeRentUses
    }
    return true
  }

  /** 获取所有美食类型（用于 UI 展示） */
  getItems(): FoodItem[] {
    return this.items.slice()
  }

  /** 玩家拥有美食卡的统计：返回每种 foodId 的数量 */
  static getFoodCount(player: Player): Record<string, number> {
    const count: Record<string, number> = {}
    for (const id of player.foodCards) {
      count[id] = (count[id] ?? 0) + 1
    }
    return count
  }
}
