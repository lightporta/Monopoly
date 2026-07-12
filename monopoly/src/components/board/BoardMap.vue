<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import BoardCell from './BoardCell.vue'

const store = useGameStore()

// 10×10 grid (1-indexed), corners shared → 36 border cells.
// index 0–9:  bottom row (row 10), cols 1→10
// index 10–17: right column (col 10), rows 9→2
// index 18–27: top row (row 1), cols 10→1
// index 28–35: left column (col 1), rows 2→9
function gridPos(index: number): { gridRow: number; gridColumn: number } {
  if (index <= 9) return { gridRow: 10, gridColumn: index + 1 }
  if (index <= 17) return { gridRow: 19 - index, gridColumn: 10 }
  if (index <= 27) return { gridRow: 1, gridColumn: 28 - index }
  return { gridRow: index - 26, gridColumn: 1 }
}

const positioned = computed(() =>
  store.board.map((cell, index) => ({ cell, index, pos: gridPos(index) }))
)
</script>

<template>
  <div class="board-wrap">
    <div class="board">
      <BoardCell
        v-for="item in positioned"
        :key="item.index"
        :cell="item.cell"
        :index="item.index"
        :style="{ gridRow: item.pos.gridRow, gridColumn: item.pos.gridColumn }"
      />
      <div class="board-center">
        <div class="center-emblem">🏝️</div>
        <h1 class="center-title">仙境海岸</h1>
        <div class="center-divider" />
        <p class="center-subtitle">大富翁</p>
        <div class="center-waves">🌊 🌊 🌊</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
}

.board {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 1 / 1;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  grid-template-rows: repeat(10, 1fr);
  gap: 3px;
  padding: 10px;
  background:
    radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.55), transparent 60%),
    linear-gradient(135deg, #fdf6e3 0%, #f5ecd0 100%);
  border-radius: 20px;
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.12),
    0 8px 28px rgba(30, 136, 229, 0.2);
  border: 4px solid var(--color-gold);
}

.board-center {
  grid-row: 2 / 10;
  grid-column: 2 / 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background:
    radial-gradient(circle at 50% 35%, rgba(227, 242, 253, 0.7), transparent 70%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.6), rgba(187, 222, 251, 0.35));
  border-radius: 14px;
  border: 1px dashed rgba(30, 136, 229, 0.3);
  text-align: center;
  padding: 16px;
}

.center-emblem {
  font-size: 42px;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2));
}

.center-title {
  font-size: clamp(22px, 4vw, 34px);
  font-weight: 800;
  letter-spacing: 4px;
  color: var(--color-ocean);
  text-shadow: 0 2px 4px rgba(255, 255, 255, 0.8);
  margin: 0;
}

.center-divider {
  width: 48px;
  height: 3px;
  background: var(--color-gold);
  border-radius: 2px;
}

.center-subtitle {
  font-size: clamp(14px, 2.5vw, 20px);
  font-weight: 600;
  letter-spacing: 8px;
  color: var(--color-text-secondary);
  margin: 0;
}

.center-waves {
  font-size: 18px;
  letter-spacing: 2px;
  opacity: 0.7;
  margin-top: 4px;
}
</style>
