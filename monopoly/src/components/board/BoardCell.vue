<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { BoardCell as CellData } from '@/engine/types'

const props = defineProps<{
  cell: CellData
  index: number
}>()

const store = useGameStore()

const colorGroup = computed(() =>
  props.cell.colorGroup ? store.getColorGroup(props.cell.colorGroup) : null
)

const playersHere = computed(() =>
  store.state.players.filter((p) => p.position === props.index)
)

const hasAnyPlayer = computed(() => playersHere.value.length > 0)

const isCurrentSpot = computed(
  () => !!store.currentPlayer && store.currentPlayer.position === props.index
)

const currentPlayerHere = computed(() =>
  store.currentPlayer && store.currentPlayer.position === props.index
    ? store.currentPlayer
    : null
)

const building = computed(() => {
  if (!props.cell.propertyRef) return null
  const owner = store.getPropertyOwner(props.cell.propertyRef)
  if (!owner) return null
  const level = store.getBuildingLevel(props.cell.propertyRef, owner.id)
  if (level === 0) return null
  if (level >= 4) return { hotel: true, houses: 0 }
  return { hotel: false, houses: level }
})

const isMortgaged = computed(() => {
  if (!props.cell.propertyRef) return false
  return store.state.players.some((p) =>
    p.mortgaged.includes(props.cell.propertyRef!)
  )
})

const isProperty = computed(() => props.cell.type === 'property')
const isCorner = computed(() =>
  props.cell.type === 'start' || props.cell.type === 'rest'
)
</script>

<template>
  <div
    class="cell"
    :class="{
      'cell--property': isProperty,
      'cell--corner': isCorner,
      'cell--current': isCurrentSpot,
      'cell--occupied': hasAnyPlayer,
      'cell--mortgaged': isMortgaged,
    }"
    :style="currentPlayerHere ? { '--player-color': currentPlayerHere.color } : {}"
  >
    <div
      v-if="isProperty && colorGroup"
      class="color-bar"
      :style="{ background: colorGroup.color }"
    />
    <div class="cell-body">
      <div v-if="cell.icon" class="cell-icon">{{ cell.icon }}</div>
      <div class="cell-name">{{ cell.name }}</div>
      <div v-if="building" class="cell-buildings">
        <span v-if="building.hotel">🏨</span>
        <span v-else>🏠<sub v-if="building.houses > 1">×{{ building.houses }}</sub></span>
      </div>
    </div>
    <div v-if="playersHere.length" class="cell-tokens">
      <span
        v-for="p in playersHere"
        :key="p.id"
        class="token"
        :style="{ color: p.color }"
        :title="p.name"
      >{{ p.token }}</span>
    </div>
    <div v-if="isMortgaged" class="mortgage-tag">抵押</div>
  </div>
</template>

<style scoped>
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #fffdf7;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  min-width: 0;
  min-height: 0;
}

.cell--corner {
  background: linear-gradient(135deg, #fff3d6 0%, #ffe9a8 100%);
}

.cell--current {
  box-shadow: 0 0 0 2px var(--color-gold), 0 0 12px rgba(251, 192, 45, 0.6);
  transform: translateY(-1px);
  z-index: 2;
}

.cell--occupied {
  background: #1a1a2e;
  color: #fff;
  animation: glowPulse 1.5s ease-in-out infinite;
}

.cell--occupied .cell-name {
  color: #fff;
}

.cell--occupied .color-bar {
  opacity: 0.9;
  box-shadow: inset 0 -1px 2px rgba(255, 255, 255, 0.2);
}

.cell--occupied.cell--corner {
  background: linear-gradient(135deg, #2d3561 0%, #1a1a2e 100%);
}

.cell--occupied::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--player-color, var(--color-gold));
  border-radius: 6px;
  pointer-events: none;
  animation: borderGlow 1.5s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% {
    box-shadow: 0 0 6px var(--player-color, rgba(251, 192, 45, 0.4));
  }
  50% {
    box-shadow: 0 0 14px var(--player-color, rgba(251, 192, 45, 0.8));
  }
}

@keyframes borderGlow {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.color-bar {
  height: 8px;
  width: 100%;
  flex-shrink: 0;
  box-shadow: inset 0 -1px 2px rgba(0, 0, 0, 0.15);
}

.cell-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 1px;
  text-align: center;
  min-height: 0;
}

.cell-icon {
  font-size: 14px;
  line-height: 1;
  margin-bottom: 1px;
}

.cell-name {
  font-size: 8px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--color-text);
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.cell--corner .cell-name {
  font-size: 9px;
  font-weight: 700;
}

.cell-buildings {
  font-size: 10px;
  line-height: 1;
  margin-top: 1px;
}

.cell-buildings sub {
  font-size: 7px;
  vertical-align: baseline;
}

.cell-tokens {
  position: absolute;
  bottom: 1px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 1px;
  font-size: 11px;
  line-height: 1;
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.9);
}

.token {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
}

.cell--mortgaged {
  opacity: 0.6;
}

.mortgage-tag {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  background: var(--color-brick);
  padding: 1px 4px;
  border-radius: 3px;
  pointer-events: none;
}
</style>
