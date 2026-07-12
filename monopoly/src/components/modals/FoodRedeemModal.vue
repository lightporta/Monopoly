<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const store = useGameStore()

const FOODS = [
  { id: 'F01', name: '烟台焖子', icon: '🍲' },
  { id: 'F02', name: '蓬莱小面', icon: '🍜' },
  { id: 'F03', name: '海鲜疙瘩汤', icon: '🥣' },
  { id: 'F04', name: '鲅鱼水饺', icon: '🥟' },
]

const player = computed(() => store.currentPlayer)

const collectedSet = computed<Set<string>>(() => {
  return new Set(player.value?.foodCards ?? [])
})

const hasAll = computed(() => collectedSet.value.size >= 4)

function hasFood(id: string): boolean {
  return collectedSet.value.has(id)
}

function redeem(option: 'cash' | 'freeRent') {
  const ok = store.redeemFood(option)
  if (ok) emit('update:show', false)
}

function close() {
  emit('update:show', false)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="overlay">
      <div class="modal">
        <h2 class="title">美食卡兑换</h2>
        <p class="subtitle">集齐 4 种美食即可兑换奖励</p>

        <div class="food-grid">
          <div
            v-for="food in FOODS"
            :key="food.id"
            :class="['food-item', { collected: hasFood(food.id) }]"
          >
            <div class="food-icon">{{ food.icon }}</div>
            <div class="food-name">{{ food.name }}</div>
            <div class="food-status">
              {{ hasFood(food.id) ? '已收集' : '未收集' }}
            </div>
          </div>
        </div>

        <div v-if="hasAll" class="redeem-actions">
          <button class="btn btn-cash" @click="redeem('cash')">
            兑换 ¥2000
          </button>
          <button class="btn btn-rent" @click="redeem('freeRent')">
            兑换免租券
          </button>
        </div>
        <div v-else class="hint">
          还差 {{ 4 - collectedSet.size }} 种即可兑换
        </div>

        <button class="btn-close" @click="close">关闭</button>
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
  width: 360px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  padding: 24px 22px 20px;
  animation: popIn 0.3s ease;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #212121;
  text-align: center;
}

.subtitle {
  font-size: 13px;
  color: #9e9e9e;
  text-align: center;
  margin-top: 4px;
  margin-bottom: 16px;
}

.food-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.food-item {
  border: 2px solid #eee;
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
}

.food-item.collected {
  border-color: #43A047;
  background: #E8F5E9;
}

.food-icon { font-size: 32px; }
.food-name { font-size: 13px; font-weight: 600; color: #424242; margin-top: 4px; }

.food-status {
  font-size: 11px;
  margin-top: 2px;
  color: #9e9e9e;
}

.food-item.collected .food-status { color: #43A047; font-weight: 600; }

.redeem-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
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

.btn-cash { background: #1E88E5; color: #fff; }
.btn-rent { background: #FBC02D; color: #fff; }

.hint {
  margin-top: 18px;
  text-align: center;
  font-size: 14px;
  color: #9e9e9e;
}

.btn-close {
  width: 100%;
  margin-top: 14px;
  padding: 11px 0;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  background: #f5f5f5;
  color: #616161;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-close:hover { background: #e0e0e0; }

@keyframes popIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
