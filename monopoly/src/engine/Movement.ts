// 移动模块：处理在环形棋盘上的位移

export interface MoveResult {
  newPos: number
  passedStart: boolean
}

/**
 * 36 格环形棋盘移动逻辑（顺时针）。
 */
export class Movement {
  /**
   * 从 currentPos 向前走 steps 步。
   * 若经过起点（index 0），passedStart=true。
   */
  move(currentPos: number, steps: number, boardSize: number = 36): MoveResult {
    const newPos = (currentPos + steps) % boardSize
    const passedStart = currentPos + steps >= boardSize
    return { newPos, passedStart }
  }

  /**
   * 从 currentPos 直接跳到 targetIndex。
   * 默认按顺时针最短经过路径计算是否过起点：
   * 若 targetIndex <= currentPos，则视为绕了一圈经过起点。
   * 注意：某些卡片/事件可能不希望因 teleport 触发起点奖励，
   * 由调用方根据场景决定是否使用本方法的 passedStart。
   */
  moveTo(currentPos: number, targetIndex: number, boardSize: number = 36): MoveResult {
    const newPos = ((targetIndex % boardSize) + boardSize) % boardSize
    // 顺时针移动；若目标在当前位置之前或相同位置，则必经过起点
    const passedStart = newPos <= currentPos
    return { newPos, passedStart }
  }
}
