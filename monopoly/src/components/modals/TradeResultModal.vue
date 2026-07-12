<script setup lang="ts">
defineProps<{
  show: boolean
  accepted: boolean
  message: string
}>()

const emit = defineEmits<{ 'update:show': [boolean] }>()
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="overlay" @click="emit('update:show', false)">
      <div class="modal" @click.stop>
        <div class="icon">{{ accepted ? '✅' : '❌' }}</div>
        <p class="title">{{ accepted ? '对方已同意' : '对方不同意' }}</p>
        <p class="msg">{{ message }}</p>
        <button class="btn-ok" @click="emit('update:show', false)">知道了</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
  backdrop-filter: blur(4px);
}

.modal {
  width: 300px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 24px;
  animation: popIn 0.3s ease;
}

.icon { font-size: 48px; margin-bottom: 12px; }

.title { font-size: 18px; font-weight: 700; color: #212121; margin: 0 0 8px 0; }

.msg { font-size: 14px; color: #666; margin: 0 0 20px 0; text-align: center; }

.btn-ok {
  padding: 10px 40px;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  background: #1E88E5;
  color: #fff;
  border: none;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-ok:hover { transform: translateY(-1px); }

@keyframes popIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 767px) {
  .modal {
    width: calc(100vw - 24px);
    max-height: calc(100dvh - 40px);
    border-radius: 16px;
    padding: 20px 16px;
  }

  .icon { font-size: 40px; }

  .title { font-size: 16px; }

  .msg { font-size: 13px; }

  .btn-ok {
    font-size: 14px;
    min-height: 44px;
    padding: 0 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal {
    animation: none;
  }

  .fade-enter-active, .fade-leave-active { transition: none; }
}
</style>
