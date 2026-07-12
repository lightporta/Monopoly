<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const emit = defineEmits<{
  (e: 'manage-assets'): void
  (e: 'redeem-food'): void
}>()

const store = useGameStore()

const canRedeemFood = computed(() => {
  const p = store.currentPlayer
  if (!p || p.isAI || p.bankrupt) return false
  return !store.pendingModal
})
</script>

<template>
  <div class="action-bar">
    <div class="buttons">
      <button
        class="btn-roll"
        :disabled="!store.canRollDice"
        @click="store.rollDice()"
      >
        🎲 掷骰子
      </button>
      <button
        class="btn-skip"
        :disabled="!store.canSkipTurn"
        @click="store.skipTurn()"
      >
        🏳️ 放弃
      </button>
      <button
        class="btn-asset"
        :disabled="!store.canManageAssets"
        @click="emit('manage-assets')"
      >
        🏠 资产
      </button>
      <button
        class="btn-asset"
        :disabled="!canRedeemFood"
        @click="emit('redeem-food')"
      >
        🍱 美食
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(227, 242, 253, 0.9));
  border-radius: 16px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(30, 136, 229, 0.12);
}

.buttons {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 8px;
}

button {
  padding: 12px 6px;
  font-size: 13px;
  font-weight: 700;
  border-radius: var(--radius-pill);
  transition: var(--transition-base);
  border: none;
  user-select: none;
}

.btn-roll {
  background: linear-gradient(135deg, var(--color-ocean), #1565c0);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30, 136, 229, 0.4);
}

.btn-roll:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(30, 136, 229, 0.55);
}

.btn-roll:active:not(:disabled) {
  transform: translateY(0);
}

.btn-skip {
  background: linear-gradient(135deg, #78909C, #546E7A);
  color: #fff;
  box-shadow: 0 4px 10px rgba(96, 125, 139, 0.35);
}

.btn-skip:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(96, 125, 139, 0.5);
}

.btn-skip:active:not(:disabled) {
  transform: translateY(0);
}

.btn-asset {
  background: #fff;
  color: var(--color-ocean);
  border: 2px solid var(--color-ocean);
}

.btn-asset:hover:not(:disabled) {
  background: #e3f2fd;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(30, 136, 229, 0.25);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}
</style>
