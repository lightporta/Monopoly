<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()
const router = useRouter()

function confirmExit() {
  store.confirmExit()
  router.push('/')
}

function cancelExit() {
  store.cancelExit()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="store.showExitConfirm" class="overlay">
      <div class="modal">
        <div class="icon-wrap">
          <span class="icon">⚠️</span>
        </div>
        <h2 class="title">确定退出本局游戏吗？</h2>
        <p class="warning">当前进度将不会保存</p>

        <div class="actions">
          <button class="btn btn-exit" @click="confirmExit">确认退出</button>
          <button class="btn btn-stay" @click="cancelExit">继续游戏</button>
        </div>
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

.modal {
  width: 340px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  padding: 28px 24px 24px;
  text-align: center;
  animation: popIn 0.3s ease;
}

.icon-wrap {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: #FFEBEE;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon { font-size: 32px; line-height: 1; }

.title {
  font-size: 20px;
  font-weight: 700;
  color: #212121;
}

.warning {
  margin-top: 8px;
  font-size: 14px;
  color: #E53935;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  flex: 1;
  padding: 11px 0;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}

.btn-exit { background: #E53935; color: #fff; }
.btn-exit:hover { background: #C62828; }

.btn-stay { background: #fff; color: #1E88E5; border: 2px solid #1E88E5; }

@keyframes popIn {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
