// 卡牌堆模块：支持洗牌、抽卡（抽完放到底部）

import type { Card } from './types'

/**
 * 通用卡牌堆：内部维护一个数组，抽一张后放到底部，
 * 形成无限循环使用。可随时洗牌。
 */
export class CardDeck {
  private deck: Card[]

  constructor(cards: Card[]) {
    // 复制一份，避免外部修改影响内部状态
    this.deck = cards.slice()
  }

  /** Fisher-Yates 洗牌 */
  shuffle(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]
    }
  }

  /**
   * 抽出顶部一张卡，并将其放到堆底（不消耗卡牌）。
   * 若堆为空，返回 null。
   */
  draw(): Card | null {
    if (this.deck.length === 0) return null
    const card = this.deck.shift()!
    this.deck.push(card)
    return card
  }

  /** 当前堆大小 */
  size(): number {
    return this.deck.length
  }

  /** 返回堆内卡牌的只读快照 */
  snapshot(): Card[] {
    return this.deck.slice()
  }
}
