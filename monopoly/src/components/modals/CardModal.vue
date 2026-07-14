<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { CardEffect } from '@/engine/types'

const store = useGameStore()

const visible = computed(() => {
  const t = store.interactivePendingModal?.type
  return t === 'drawChance' || t === 'drawDestiny'
})

const card = computed(() => store.interactivePendingModal?.card ?? null)
const isChance = computed(() => store.interactivePendingModal?.type === 'drawChance')

const effectText = computed(() => {
  const eff: CardEffect | undefined = card.value?.effect
  if (!eff) return ''
  if (eff.action === 'cash' && eff.amount != null) {
    return `${eff.amount >= 0 ? '+' : ''}${eff.amount}元`
  }
  if (eff.action === 'move') return '移动到指定位置'
  if (eff.action === 'moveRel') return `前进/后退 ${eff.steps ?? 0} 步`
  if (eff.action === 'teleport') return '传送到指定位置'
  if (eff.action === 'jail') return '休息一回合'
  if (eff.action === 'collectFood') return '获得一张美食卡'
  return ''
})

const isPositive = computed(() => {
  const eff = card.value?.effect
  if (!eff) return true
  if (eff.action === 'cash') return (eff.amount ?? 0) >= 0
  return eff.action === 'collectFood'
})

function confirm() {
  // 联机模式：服务端已自动推进回合，只需关闭弹窗（清空 pendingEvent）
  if (store.isOnlineMode) {
    store.clearPendingEvent()
    return
  }
  store.clearPendingEvent()
  store.endTurn()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible && card" class="overlay">
      <div :class="['card', isChance ? 'card-chance' : 'card-destiny']">
        <div class="card-label">{{ isChance ? '机 会' : '命 运' }}</div>
        <div class="card-icon">{{ card.icon }}</div>
        <div class="card-text">{{ card.text }}</div>
        <div :class="['card-effect', isPositive ? 'effect-pos' : 'effect-neg']">
          {{ effectText }}
        </div>
        <button class="btn-confirm" @click="confirm">确认</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.card {
  width: 320px;
  border-radius: 20px;
  padding: 32px 24px;
  text-align: center;
  color: #fff;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  animation: flipIn 0.6s ease;
}

.card-chance {
  background: linear-gradient(135deg, #43A047 0%, #2E7D32 100%);
}

.card-destiny {
  background: linear-gradient(135deg, #8E24AA 0%, #6A1B9A 100%);
}

.card-label {
  font-size: 14px;
  letter-spacing: 4px;
  opacity: 0.85;
  margin-bottom: 4px;
}

.card-icon {
  font-size: 64px;
  margin: 12px 0;
  line-height: 1;
}

.card-text {
  font-size: 18px;
  line-height: 1.6;
  margin-bottom: 16px;
  min-height: 56px;
}

.card-effect {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 24px;
}

.effect-pos { color: #B9F6CA; }
.effect-neg { color: #FFCDD2; }

.btn-confirm {
  background: rgba(255, 255, 255, 0.95);
  color: #1E88E5;
  border: none;
  border-radius: 9999px;
  padding: 10px 44px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

@keyframes flipIn {
  0% { transform: rotateY(90deg) scale(0.85); opacity: 0; }
  100% { transform: rotateY(0deg) scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
