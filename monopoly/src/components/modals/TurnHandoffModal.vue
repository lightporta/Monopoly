<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const visible = computed(() => store.showTurnHandoff)

const player = computed(() => store.currentPlayer)

const accent = computed(() => player.value?.color ?? '#1E88E5')
</script>

<template>
  <Transition name="fade">
    <div v-if="visible && player" class="overlay">
      <div class="card" :style="{ '--accent': accent }">
        <div class="ring" :style="{ background: accent }">
          <span class="token">{{ player.token }}</span>
        </div>
        <p class="tip">请将设备交给</p>
        <h2 class="name">{{ player.name }}</h2>
        <button class="btn-ready" @click="store.confirmTurnHandoff()">
          我已准备好
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  backdrop-filter: blur(6px);
}

.card {
  text-align: center;
  color: #fff;
  animation: popIn 0.35s ease;
}

.ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.2), 0 12px 32px rgba(0, 0, 0, 0.4);
  animation: pulse 1.8s ease-in-out infinite;
}

.token {
  font-size: 60px;
  line-height: 1;
}

.tip {
  font-size: 18px;
  opacity: 0.85;
  letter-spacing: 2px;
}

.name {
  font-size: 36px;
  font-weight: 800;
  margin: 6px 0 32px;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}

.btn-ready {
  background: #fff;
  color: var(--accent, #1E88E5);
  border: none;
  border-radius: 9999px;
  padding: 14px 56px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-ready:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

@keyframes popIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
