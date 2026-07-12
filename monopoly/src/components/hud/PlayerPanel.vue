<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const players = computed(() => store.state.players)

function formatCash(n: number): string {
  return '¥' + n.toLocaleString('zh-CN')
}

function propertyCount(playerId: number): number {
  const p = store.state.players.find((x) => x.id === playerId)
  return p ? p.properties.length : 0
}

function foodTypeCount(playerId: number): number {
  const p = store.state.players.find((x) => x.id === playerId)
  return p ? new Set(p.foodCards).size : 0
}
</script>

<template>
  <aside class="player-panel">
    <h2 class="panel-title">玩家阵营</h2>
    <ul class="player-list">
      <li
        v-for="p in players"
        :key="p.id"
        class="player-card"
        :class="{
          active: store.currentPlayer?.id === p.id,
          bankrupt: p.bankrupt,
        }"
        :style="{ '--accent': p.color }"
      >
        <div class="card-header">
          <span class="p-token">{{ p.token }}</span>
          <span class="p-name">{{ p.name }}</span>
          <span v-if="p.isAI" class="p-badge">AI</span>
        </div>
        <div class="card-stats">
          <div class="stat">
            <span class="stat-label">现金</span>
            <span class="stat-value cash">{{ formatCash(p.cash) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">地产</span>
            <span class="stat-value">{{ propertyCount(p.id) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">美食</span>
            <span class="stat-value">{{ foodTypeCount(p.id) }}<sub>/4</sub></span>
          </div>
          <div class="stat">
            <span class="stat-label">免租券</span>
            <span class="stat-value">{{ p.freeRentTickets }}</span>
          </div>
        </div>
        <div v-if="p.bankrupt" class="bankrupt-overlay">已破产</div>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.player-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(227, 242, 253, 0.92));
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(30, 136, 229, 0.12);
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-ocean);
  text-align: center;
  letter-spacing: 2px;
  padding-bottom: 8px;
  border-bottom: 2px solid rgba(30, 136, 229, 0.15);
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-card {
  position: relative;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  border: 2px solid transparent;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: var(--transition-base);
  overflow: hidden;
}

.player-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 0 14px color-mix(in srgb, var(--accent) 45%, transparent);
  transform: translateX(-2px);
}

.player-card.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--accent);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.p-token {
  font-size: 20px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.p-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  flex: 1;
}

.p-badge {
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: var(--color-text-secondary);
  padding: 1px 6px;
  border-radius: var(--radius-pill);
}

.card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}

.stat {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
}

.stat-label {
  color: var(--color-text-secondary);
}

.stat-value {
  font-weight: 700;
  color: var(--color-text);
}

.stat-value.cash {
  color: var(--color-pine);
}

.stat-value sub {
  font-size: 9px;
  color: var(--color-text-secondary);
  font-weight: 400;
}

.bankrupt-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 4px;
  transform: rotate(-8deg);
  backdrop-filter: blur(2px);
}

.player-card.bankrupt {
  opacity: 0.85;
}
</style>
