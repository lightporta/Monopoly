<script setup lang="ts">
import { watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

// 显示提示后 1s 自动关闭（房间解散/玩家退出等场景）
watch(() => store.showRoomDisbanded, (visible) => {
  if (visible) {
    setTimeout(() => {
      store.dismissRoomDisbanded()
    }, 1000)
  }
})
</script>

<template>
  <Transition name="fade">
    <div v-if="store.showRoomDisbanded" class="overlay">
      <div class="modal">
        <div class="icon">🏠</div>
        <p class="message">{{ store.roomDisbandedMessage }}</p>
        <button class="btn-action" @click="store.dismissRoomDisbanded">我已知晓</button>
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
  z-index: 1300;
  backdrop-filter: blur(4px);
  padding: 16px;
}

.modal {
  width: 340px;
  max-width: 100%;
  background: #fff;
  border: 3px solid #FBC02D;
  border-radius: 22px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
  padding: 28px 24px 22px;
  text-align: center;
  animation: popIn 0.35s ease;
}

.icon {
  font-size: 44px;
  line-height: 1;
  margin-bottom: 8px;
}

.message {
  font-size: 17px;
  font-weight: 600;
  color: #5D4037;
  margin: 0 0 22px;
  line-height: 1.6;
}

.btn-action {
  width: 100%;
  padding: 13px 0;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #FBC02D 0%, #F57F17 100%);
  color: #fff;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(245, 127, 23, 0.4);
}

@keyframes popIn {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
