<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const turnInfo = computed(() => {
  const p = store.currentPlayer
  if (!p) return '准备开始'
  return `第 ${store.state.turnCount} 回合 · ${p.name}`
})

const currentToken = computed(() => store.currentPlayer?.token ?? '')
</script>

<template>
  <header class="top-bar">
    <div class="brand">
      <span class="brand-icon">🏝️</span>
      <span class="brand-text">仙境海岸·大富翁</span>
    </div>
    <div class="turn-info">
      <span v-if="currentToken" class="turn-token">{{ currentToken }}</span>
      <span>{{ turnInfo }}</span>
    </div>
    <button class="exit-btn" @click="store.requestExit()">
      <span>🚪</span><span>退出</span>
    </button>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--color-ocean) 0%, #1565c0 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(30, 136, 229, 0.35);
  border-bottom: 3px solid var(--color-gold);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}

.brand-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3));
}

.brand-text {
  font-size: 20px;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
}

.turn-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  padding: 6px 18px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-pill);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  white-space: nowrap;
}

.turn-token {
  font-size: 18px;
}

.exit-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: rgba(229, 57, 53, 0.85);
  border-radius: var(--radius-pill);
  transition: var(--transition-base);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.exit-btn:hover {
  background: var(--color-brick);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(229, 57, 53, 0.5);
}

.exit-btn:active {
  transform: translateY(0);
}

@media (max-width: 640px) {
  .top-bar {
    padding: 10px 14px;
    gap: 8px;
  }
  .brand-text {
    font-size: 16px;
  }
  .turn-info {
    font-size: 12px;
    padding: 4px 12px;
  }
}
</style>
