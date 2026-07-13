<script setup lang="ts">
// 棋子悬浮图层：独立绝对定位图层，覆盖在 BoardMap 上方。
// 棋子按格坐标定位并偏移到格子边缘外侧，不被 .cell { overflow: hidden } 裁剪。
// 同格多棋子按象限错位避让，当前回合者轻微弹跳动画。

import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

// 与 BoardMap 一致的 10×10 网格坐标映射（1-indexed）
function gridPos(index: number): { gridRow: number; gridColumn: number } {
  if (index <= 9) return { gridRow: 10, gridColumn: index + 1 }
  if (index <= 17) return { gridRow: 19 - index, gridColumn: 10 }
  if (index <= 27) return { gridRow: 1, gridColumn: 28 - index }
  return { gridRow: index - 26, gridColumn: 1 }
}

// 10×10 网格，每格中心占 10%。padding 10px + gap 3px 影响微小，这里用百分比近似。
// grid 1-indexed，中心 = (n - 0.5) * 10%
function cellCenter(index: number): { xPct: number; yPct: number } {
  const { gridRow, gridColumn } = gridPos(index)
  return {
    xPct: (gridColumn - 0.5) * 10,
    yPct: (gridRow - 0.5) * 10,
  }
}

// 判断格子在哪条边，决定棋子向外偏移方向
function edgeOf(index: number): 'top' | 'bottom' | 'left' | 'right' | 'corner' {
  if (index <= 9) {
    // 底行（含两个角）
    if (index === 0 || index === 9) return 'corner'
    return 'bottom'
  }
  if (index <= 17) {
    if (index === 18) return 'corner'
    return 'right'
  }
  if (index <= 27) {
    if (index === 18 || index === 27) return 'corner'
    return 'top'
  }
  return 'left'
}

interface PositionedToken {
  playerId: number
  token: string
  color: string
  name: string
  isCurrent: boolean
  // 像素偏移（相对格子中心，向外）
  offsetX: number
  offsetY: number
  // 多人同格的错位索引（0~3）
  slot: number
}

const positionedTokens = computed<PositionedToken[]>(() => {
  const result: PositionedToken[] = []
  const currentPlayerId = store.currentPlayer?.id
  // 按格分组玩家
  const byCell = new Map<number, typeof store.state.players>()
  for (const p of store.state.players) {
    if (p.bankrupt) continue
    const arr = byCell.get(p.position) ?? []
    arr.push(p)
    byCell.set(p.position, arr)
  }

  for (const [cellIndex, players] of byCell) {
    const edge = edgeOf(cellIndex)
    const slotOffsets = [
      { x: 0, y: 0 },
      { x: 14, y: 0 },
      { x: 0, y: 14 },
      { x: 14, y: 14 },
    ]
    players.forEach((p, i) => {
      const slot = i % 4
      let extraX = slotOffsets[slot].x
      let extraY = slotOffsets[slot].y
      // 向外偏移
      if (edge === 'top') extraY -= 16
      else if (edge === 'bottom') extraY += 16
      else if (edge === 'left') extraX -= 16
      else if (edge === 'right') extraX += 16
      else {
        // corner：向对角外侧
        if (cellIndex === 0) { extraX -= 16; extraY += 16 }
        else if (cellIndex === 9) { extraX += 16; extraY += 16 }
        else if (cellIndex === 18) { extraX += 16; extraY -= 16 }
        else if (cellIndex === 27) { extraX -= 16; extraY -= 16 }
      }
      result.push({
        playerId: p.id,
        token: p.token,
        color: p.color,
        name: p.name,
        isCurrent: p.id === currentPlayerId,
        offsetX: extraX,
        offsetY: extraY,
        slot,
      })
    })
  }
  return result
})

function tokenStyle(t: PositionedToken, cellIndex: number): Record<string, string> {
  const { xPct, yPct } = cellCenter(cellIndex)
  // 找到该棋子对应的格子
  const player = store.state.players.find((p) => p.id === t.playerId)
  const idx = player?.position ?? 0
  const center = cellCenter(idx)
  return {
    left: `${center.xPct}%`,
    top: `${center.yPct}%`,
    transform: `translate(calc(-50% + ${t.offsetX}px), calc(-50% + ${t.offsetY}px))`,
  }
}

// 按玩家 id 查找其当前格子
function cellIndexOfPlayer(playerId: number): number {
  return store.state.players.find((p) => p.id === playerId)?.position ?? 0
}
</script>

<template>
  <div class="token-layer" aria-hidden="true">
    <div
      v-for="t in positionedTokens"
      :key="t.playerId"
      class="floating-token"
      :class="{ 'floating-token--current': t.isCurrent }"
      :style="[tokenStyle(t, cellIndexOfPlayer(t.playerId)), { '--tk-color': t.color }]"
      :title="t.name"
    >
      <span class="floating-token-emoji">{{ t.token }}</span>
    </div>
  </div>
</template>

<style scoped>
.token-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 50;
}

.floating-token {
  position: absolute;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
  transition: left 0.3s ease, top 0.3s ease, transform 0.3s ease;
  will-change: left, top, transform;
}

.floating-token-emoji {
  display: inline-block;
  text-shadow: 0 0 3px rgba(255, 255, 255, 0.95), 0 0 2px var(--tk-color, #fff);
}

.floating-token::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 2px solid var(--tk-color, #fff);
  opacity: 0.85;
  box-shadow: 0 0 4px var(--tk-color, rgba(255, 255, 255, 0.6));
}

.floating-token--current {
  animation: tokenBounce 1.2s ease-in-out infinite;
  z-index: 60;
}

.floating-token--current::after {
  opacity: 1;
  border-width: 3px;
}

@keyframes tokenBounce {
  0%, 100% {
    transform: translate(calc(-50% + var(--ox, 0px)), calc(-50% + var(--oy, 0px))) scale(1);
  }
  50% {
    transform: translate(calc(-50% + var(--ox, 0px)), calc(-50% + var(--oy, 0px))) scale(1.15);
  }
}

@media (max-width: 480px) {
  .floating-token {
    width: 22px;
    height: 22px;
    font-size: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-token {
    transition: none;
  }
  .floating-token--current {
    animation: none;
  }
}
</style>
