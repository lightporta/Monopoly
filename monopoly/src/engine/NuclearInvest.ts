// 核电投资系统：购买 / 每回合分红结算 / 核事故处理
// 高回报高风险（核电）vs 低回报零风险（风电）。全局限购份数，先到先得。
// 核心铁律：投资是独立现金流通道，不影响地产/过路费/胜利逻辑；破产时投资归零。

import type { InvestmentProject, OwnedInvestment, Player } from './types'

export interface InvestResult {
  ok: boolean
  message: string
  dividend?: number
}

export class NuclearInvestManager {
  private projects: InvestmentProject[]
  private projectMap: Map<string, InvestmentProject>
  private soldCopies: Record<string, number>

  constructor(projects: InvestmentProject[], soldCopies: Record<string, number>) {
    this.projects = projects
    this.projectMap = new Map(projects.map((p) => [p.id, p]))
    this.soldCopies = soldCopies
  }

  getAll(): InvestmentProject[] {
    return this.projects
  }

  getData(projectId: string): InvestmentProject | undefined {
    return this.projectMap.get(projectId)
  }

  /** 项目剩余可购份数 */
  remainingCopies(projectId: string): number {
    const data = this.projectMap.get(projectId)
    if (!data) return 0
    return Math.max(0, data.maxCopies - (this.soldCopies[projectId] ?? 0))
  }

  /** 购买投资 */
  invest(projectId: string, player: Player): InvestResult {
    const data = this.projectMap.get(projectId)
    if (!data) return { ok: false, message: '投资项目不存在' }
    if (this.remainingCopies(projectId) <= 0) return { ok: false, message: `${data.name} 已售罄` }
    if (player.cash < data.cost) return { ok: false, message: '资金不足' }

    player.cash -= data.cost
    player.investments.push({ projectId, stopDividendTurns: 0 })
    this.soldCopies[projectId] = (this.soldCopies[projectId] ?? 0) + 1
    return { ok: true, message: `投资 ${data.name} 成功` }
  }

  /**
   * 每回合分红结算（在自己回合开始时调用）。
   * 受生态危机减益（nuclearDividendPenalty）影响。
   * 返回总分红与明细。
   */
  settleDividend(player: Player, nuclearDividendPenalty: number): { total: number; details: { name: string; amount: number }[] } {
    let total = 0
    const details: { name: string; amount: number }[] = []
    for (const inv of player.investments) {
      const data = this.projectMap.get(inv.projectId)
      if (!data) continue
      // 停发分红回合内不发
      if (inv.stopDividendTurns > 0) {
        continue
      }
      let amount = data.dividendPerTurn
      // 生态危机减益
      amount = Math.floor(amount * nuclearDividendPenalty)
      player.cash += amount
      total += amount
      details.push({ name: data.name, amount })
    }
    return { total, details }
  }

  /**
   * 触发核事故：所有持有核电投资的玩家付救援费 + 停发分红 N 回合。
   * 连锁效应：1号事故时，chainEffect 中的项目（如2号）也停发但不另收费。
   * players: 所有玩家（需遍历找出投资者）。
   * 返回受影响的玩家与金额明细（用于日志）。
   */
  triggerAccident(
    players: Player[],
    triggeredProjectId: string
  ): { player: Player; fee: number; stopTurns: number; projectName: string }[] {
    const triggered = this.projectMap.get(triggeredProjectId)
    if (!triggered) return []

    const results: { player: Player; fee: number; stopTurns: number; projectName: string }[] = []
    const accidentProjectIds = new Set<string>([triggeredProjectId])
    // 连锁项目
    for (const chainId of triggered.chainEffect) accidentProjectIds.add(chainId)

    for (const player of players) {
      if (player.bankrupt) continue
      for (const inv of player.investments) {
        if (!accidentProjectIds.has(inv.projectId)) continue
        const data = this.projectMap.get(inv.projectId)
        if (!data) continue
        const isTriggered = inv.projectId === triggeredProjectId
        const fee = isTriggered ? triggered.accidentFee : 0
        if (fee > 0) {
          player.cash -= fee
        }
        inv.stopDividendTurns = Math.max(inv.stopDividendTurns, data.accidentStopTurns)
        results.push({ player, fee, stopTurns: data.accidentStopTurns, projectName: data.name })
      }
    }
    return results
  }

  /** 每回合维护：递减停发分红回合数 */
  tickStopTurns(player: Player): void {
    for (const inv of player.investments) {
      if (inv.stopDividendTurns > 0) inv.stopDividendTurns -= 1
    }
  }

  /** 破产清算：投资自动失效归零，不退还投入 */
  liquidateAll(player: Player): void {
    player.investments = []
  }

  /** 计算玩家投资成本估值（用于结算总资产，按投入成本计） */
  estimateValue(player: Player): number {
    let value = 0
    for (const inv of player.investments) {
      const data = this.projectMap.get(inv.projectId)
      if (data) value += data.cost
    }
    return value
  }
}
