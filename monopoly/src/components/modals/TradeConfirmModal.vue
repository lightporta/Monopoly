<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { onlineSDK } from '@/online/onlineSdk.js'

const props = defineProps<{
  show: boolean
  tradeType: 'buyProperty' | 'buyBuilding' | 'rent'
  propertyId: string
  propertyName: string
  ownerId: number
  ownerName: string
  buyerId: number
  buyerName: string
  price: number
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  'resolved': [accepted: boolean]
}>()

const store = useGameStore()

const typeLabel = computed(() => {
  switch (props.tradeType) {
    case 'buyProperty': return '购买地皮（含建筑）'
    case 'buyBuilding': return '购买房屋'
    case 'rent': return '租赁'
  }
})

async function accept() {
  // 联机模式：发 trade:respond 给服务端，由服务端执行交易
  if (store.isOnlineMode) {
    onlineSDK.respondTrade(true)
    emit('update:show', false)
    return
  }
  // 单机模式：本地执行交易
  let ok = false
  if (props.tradeType === 'buyProperty') {
    ok = store.buyPropertyFromPlayer(props.propertyId, props.buyerId, props.ownerId)
  } else if (props.tradeType === 'buyBuilding') {
    ok = store.buyBuildingFromPlayer(props.propertyId, props.buyerId, props.ownerId)
  } else if (props.tradeType === 'rent') {
    ok = store.payRentToPlayer(props.propertyId, props.buyerId, props.ownerId)
  }
  emit('resolved', ok)
  emit('update:show', false)
}

async function reject() {
  // 联机模式：发 trade:respond 拒绝
  if (store.isOnlineMode) {
    onlineSDK.respondTrade(false)
    emit('update:show', false)
    return
  }
  emit('resolved', false)
  emit('update:show', false)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="overlay">
      <div class="modal">
        <div class="header">
          <h2 class="title">🤝 交易请求</h2>
        </div>
        <div class="body">
          <p class="msg">
            <span class="player-name">{{ buyerName }}</span>
            想要
            <span class="trade-type">{{ typeLabel }}</span>
          </p>
          <div class="detail-card">
            <div class="detail-row">
              <span class="label">地产</span>
              <span class="value">{{ propertyName }}</span>
            </div>
            <div class="detail-row">
              <span class="label">价格</span>
              <span class="value price">¥{{ price }}</span>
            </div>
            <div class="detail-row">
              <span class="label">买家</span>
              <span class="value">{{ buyerName }}</span>
            </div>
          </div>
          <p class="ask">{{ ownerName }}，是否同意？</p>
        </div>
        <div class="footer">
          <button class="btn btn-reject" @click="reject">不同意</button>
          <button class="btn btn-accept" @click="accept">同意</button>
        </div>
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
  z-index: 1200;
  backdrop-filter: blur(4px);
}

.modal {
  width: 340px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  animation: popIn 0.3s ease;
}

.header {
  padding: 18px 22px 12px;
  border-bottom: 1px solid #eee;
}

.title { font-size: 18px; font-weight: 700; color: #212121; margin: 0; }

.body { padding: 16px 22px; }

.msg { font-size: 15px; color: #333; margin: 0 0 12px 0; }
.player-name { font-weight: 700; color: #1E88E5; }
.trade-type { font-weight: 700; color: #FF8F00; }

.detail-card {
  background: #f5f5f5;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.label { font-size: 13px; color: #9e9e9e; }
.value { font-size: 14px; font-weight: 600; color: #333; }
.price { color: #E53935; font-size: 16px; }

.ask { font-size: 14px; color: #666; margin: 0; text-align: center; }

.footer {
  display: flex;
  gap: 12px;
  padding: 12px 22px 18px;
}

.btn {
  flex: 1;
  padding: 11px 0;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.btn:hover { transform: translateY(-1px); }

.btn-reject {
  background: #f5f5f5;
  color: #666;
}

.btn-accept {
  background: #43A047;
  color: #fff;
}

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
  }

  .header {
    padding: 14px 16px 10px;
  }

  .title { font-size: 16px; }

  .body { padding: 12px 16px; }

  .msg { font-size: 13px; }

  .detail-card {
    padding: 10px 12px;
  }

  .label { font-size: 12px; }
  .value { font-size: 13px; }
  .price { font-size: 14px; }

  .ask { font-size: 13px; }

  .footer {
    padding: 10px 16px 14px;
  }

  .btn {
    font-size: 14px;
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal {
    animation: none;
  }

  .fade-enter-active, .fade-leave-active { transition: none; }
}
</style>
