// 骰子模块：纯逻辑，无 Vue 依赖

/**
 * 双骰子（1-6），支持连续双数（doubles）连击追踪。
 */
export class Dice {
  private streak: number = 0

  /**
   * 掷一次骰子，返回两枚骰子点数 [d1, d2]。
   * 若为双数，自动累加连击；否则重置连击。
   */
  roll(): [number, number] {
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    if (Dice.isDoubles([d1, d2])) {
      this.streak += 1
    } else {
      this.streak = 0
    }
    return [d1, d2]
  }

  /** 判断是否为双数 */
  static isDoubles(dice: [number, number]): boolean {
    return dice[0] === dice[1]
  }

  /** 获取当前连续双数次数 */
  getStreak(): number {
    return this.streak
  }

  /** 重置连击计数（如入狱/进入休息格后） */
  resetStreak(): void {
    this.streak = 0
  }
}
