// 破产处理模块：清算资产 / 判定破产

import type { GameConfig, Player } from './types'
import { PropertyManager } from './Property'

export class BankruptcyHandler {
  private config: GameConfig
  private propertyManager: PropertyManager

  constructor(config: GameConfig, propertyManager: PropertyManager) {
    this.config = config
    this.propertyManager = propertyManager
  }

  /**
   * 判定玩家是否破产：现金 < 0 且已无法通过清算补足。
   * 调用方应先调用 liquidate 尝试补足；若清算后仍 cash < 0，则视为破产。
   */
  check(player: Player): boolean {
    return player.cash < 0
  }

  /**
   * 清算：尝试变卖资产以筹集至少 amountNeeded 的现金。
   * 顺序：
   *   1) 先卖所有建筑（按 sellBuildingRatio 半价回收）
   *   2) 若仍不足，抵押所有可抵押地产（按 mortgageRatio 获得 50% 价格）
   * 返回实际筹集到的金额。
   * 注意：此方法会直接修改 player 状态。
   */
  liquidate(player: Player, amountNeeded: number): number {
    let raised = 0
    const need = () => amountNeeded - raised - player.cash
    // 注意：player.cash 在 sellBuildings/mortgage 中会增加，所以用 need() 判断剩余缺口

    // 1) 出售所有建筑
    for (const propertyId of player.properties.slice()) {
      if (need() <= 0) break
      const level = this.propertyManager.getBuildingLevel(propertyId, player)
      if (level > 0) {
        const refund = this.propertyManager.sellBuildings(propertyId, player)
        raised += refund
      }
    }

    // 2) 抵押所有可抵押地产
    for (const propertyId of player.properties.slice()) {
      if (need() <= 0) break
      if (!this.propertyManager.isMortgaged(propertyId, player)) {
        const ok = this.propertyManager.mortgage(propertyId, player)
        if (ok) {
          const data = this.propertyManager.getPropertyData(propertyId)
          if (data) {
            raised += Math.floor(data.price * this.config.economy.mortgageRatio)
          }
        }
      }
    }

    return raised
  }

  /**
   * 执行破产：将玩家标记为破产，释放其所有地产（理论上由 Game 层处理释放后归属）。
   * 这里仅设置 bankrupt 标志并清空其资产，地产释放由 Game 决定（如转为无主或交给债权人）。
   */
  declareBankrupt(player: Player): void {
    player.bankrupt = true
    player.properties = []
    player.buildings = {}
    player.mortgaged = []
    player.foodCards = []
    player.freeRentTickets = 0
  }
}
