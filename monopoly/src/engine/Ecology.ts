// 海洋生态系统：全局生态指数维护 / 等级判定 / 全局效果计算
// 初始值 50，每抽 1 张正面生态卡 +5，负面 -5；5 回合未抽到生态卡自然恢复 +2。
// 4 档阈值：优良(80~100) / 正常(50~79) / 预警(20~49) / 危机(0~19)。

import type { EcologyState, GameConfig } from './types'

export interface EcologyTier {
  status: 'good' | 'normal' | 'warning' | 'crisis'
  label: string
  color: string
  subsidyPerTurn: number
  aquaculturePenalty: number // 0~1，养殖收益扣减比例
  nuclearDividendPenalty: number // 0~1，核电分红保留比例（1=不减）
}

const TIERS: EcologyTier[] = [
  { status: 'good', label: '生态优良', color: '#43A047', subsidyPerTurn: 200, aquaculturePenalty: 0, nuclearDividendPenalty: 1.0 },
  { status: 'normal', label: '生态正常', color: '#FBC02D', subsidyPerTurn: 0, aquaculturePenalty: 0, nuclearDividendPenalty: 1.0 },
  { status: 'warning', label: '生态预警', color: '#FB8C00', subsidyPerTurn: 0, aquaculturePenalty: 0.3, nuclearDividendPenalty: 1.0 },
  { status: 'crisis', label: '生态危机', color: '#E53935', subsidyPerTurn: 0, aquaculturePenalty: 0.6, nuclearDividendPenalty: 0.5 },
]

export class EcologyManager {
  private config: GameConfig
  private state: EcologyState

  constructor(config: GameConfig, state: EcologyState) {
    this.config = config
    this.state = state
  }

  getState(): EcologyState {
    return this.state
  }

  getIndex(): number {
    return this.state.index
  }

  /** 根据当前指数返回所属档位 */
  getTier(): EcologyTier {
    return this.getTierForIndex(this.state.index)
  }

  getTierForIndex(index: number): EcologyTier {
    if (index >= 80) return TIERS[0]
    if (index >= 50) return TIERS[1]
    if (index >= 20) return TIERS[2]
    return TIERS[3]
  }

  /**
   * 应用生态卡效果：增减指数，重置自然恢复计数。
   * 返回实际变化量（已 clamp）与新的档位。
   */
  applyCardDelta(delta: number): { actualDelta: number; newIndex: number; tier: EcologyTier } {
    const newIndex = this.clamp(this.state.index + delta)
    const actualDelta = newIndex - this.state.index
    this.state.index = newIndex
    // 抽到生态卡 → 重置自然恢复计数
    this.state.turnsSinceLastEcoCard = 0
    return { actualDelta, newIndex, tier: this.getTier() }
  }

  /**
   * 回合自然恢复：每 N 回合未抽到生态卡，指数 +amount。
   * 在每回合结束时调用。
   */
  tickNaturalRecovery(): { recovered: number; newIndex: number } {
    this.state.turnsSinceLastEcoCard += 1
    if (this.state.turnsSinceLastEcoCard >= this.config.ecology.naturalRecoveryTurns) {
      const before = this.state.index
      this.state.index = this.clamp(this.state.index + this.config.ecology.naturalRecoveryAmount)
      this.state.turnsSinceLastEcoCard = 0
      return { recovered: this.state.index - before, newIndex: this.state.index }
    }
    return { recovered: 0, newIndex: this.state.index }
  }

  /** 重置为初始值 */
  reset(): void {
    this.state.index = this.config.ecology.initial
    this.state.turnsSinceLastEcoCard = 0
  }

  private clamp(v: number): number {
    return Math.max(this.config.ecology.min, Math.min(this.config.ecology.max, v))
  }
}
