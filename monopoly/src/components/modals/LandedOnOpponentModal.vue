<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import TradeResultModal from './TradeResultModal.vue'

defineProps<{ show: boolean }>()

const store = useGameStore()

const player = computed(() => store.currentPlayer)

const pendingEvent = computed(() => store.pendingModal)

const showWaiting = ref(false)
const showTradeResult = ref(false)
const tradeAccepted = ref(false)
const tradeResultMsg = ref('')
const tradeData = ref({
  type: 'buyProperty' as 'buyProperty' | 'buyBuilding' | 'rent',
  propertyId: '',
  propertyName: '',
  ownerId: -1,
  ownerName: '',
  buyerId: -1,
  buyerName: '',
  price: 0
})

function getPropertyName(): string {
  const event = pendingEvent.value
  if (!event?.propertyId) return ''
  const prop = store.properties.find(p => p.id === event.propertyId)
  return prop?.name ?? ''
}

function buyPropertyPrice(): number {
  const event = pendingEvent.value
  if (!event) return 0
  return (event.amount ?? 0) + (event.buildCost ?? 0) * (event.buildingLevel ?? 0)
}

function buyBuildingPrice(): number {
  const event = pendingEvent.value
  if (!event) return 0
  return (event.buildCost ?? 0) * (event.buildingLevel ?? 0)
}

function rentPrice(): number {
  const event = pendingEvent.value
  if (!event || !player.value || !event.ownerId) return 0
  return store.getRentPrice(event.propertyId ?? '', event.ownerId, player.value.id)
}

function canBuyProperty(): boolean {
  const p = player.value
  if (!p) return false
  return p.cash >= buyPropertyPrice()
}

function canBuyBuilding(): boolean {
  const p = player.value
  if (!p) return false
  return (pendingEvent.value?.buildingLevel ?? 0) > 0 && p.cash >= buyBuildingPrice()
}

function canRent(): boolean {
  const p = player.value
  if (!p) return false
  return p.cash >= rentPrice()
}

function initTrade(type: 'buyProperty' | 'buyBuilding' | 'rent') {
  const event = pendingEvent.value
  if (!event || !player.value) return
  const price = type === 'buyProperty' ? buyPropertyPrice()
    : type === 'buyBuilding' ? buyBuildingPrice()
    : rentPrice()
  tradeData.value = {
    type,
    propertyId: event.propertyId ?? '',
    propertyName: getPropertyName(),
    ownerId: event.ownerId ?? -1,
    ownerName: event.ownerName ?? '',
    buyerId: player.value.id,
    buyerName: player.value.name,
    price
  }

  // 买家不需看到同意/不同意弹窗，只显示等待状态，然后显示结果
  showWaiting.value = true
  const owner = store.state.players.find(p => p.id === event.ownerId)
  // AI 玩家 70% 概率同意，真人玩家也自动决定（80%同意）
  const acceptRate = owner?.isAI ? 0.7 : 0.8
  const accept = Math.random() < acceptRate
  setTimeout(() => {
    showWaiting.value = false
    handleTradeResult(accept)
  }, 1200)
}

function handleTradeResult(accepted: boolean) {
  tradeAccepted.value = accepted

  if (accepted) {
    const t = tradeData.value.type
    let ok = false
    if (t === 'buyProperty') {
      ok = store.buyPropertyFromPlayer(tradeData.value.propertyId, tradeData.value.buyerId, tradeData.value.ownerId)
    } else if (t === 'buyBuilding') {
      ok = store.buyBuildingFromPlayer(tradeData.value.propertyId, tradeData.value.buyerId, tradeData.value.ownerId)
    } else if (t === 'rent') {
      ok = store.payRentToPlayer(tradeData.value.propertyId, tradeData.value.buyerId, tradeData.value.ownerId)
    }
    tradeResultMsg.value = ok
      ? `${tradeData.value.ownerName} 已同意，交易成功！`
      : '交易失败：资金不足'
  } else {
    tradeResultMsg.value = `${tradeData.value.ownerName} 不同意此次交易`
  }
  showTradeResult.value = true
}

function handleNoNeed() {
  // 玩家选择不进行任何交易，直接结束回合
  store.clearPendingEvent()
  store.endTurn()
}

function onResultClose() {
  showTradeResult.value = false
  store.clearPendingEvent()
  store.endTurn()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show && pendingEvent" class="overlay">
      <!-- 主弹窗 -->
      <div v-if="!showWaiting && !showTradeResult" class="modal">
        <div class="header">
          <h2 class="title">📍 遇到对方资产</h2>
        </div>
        <div class="body">
          <div class="prop-info">
            <div class="prop-name">{{ getPropertyName() }}</div>
            <div class="prop-owner">
              主人：{{ pendingEvent.ownerName }}
              <span v-if="pendingEvent.buildingLevel && pendingEvent.buildingLevel > 0">
                （{{ pendingEvent.buildingLevel }}级建筑）
              </span>
            </div>
          </div>
          <div class="prompt">此地有对方资产，是否需要购买地皮/购房（如果有）/租赁？</div>
          <div class="actions">
            <button class="btn-action btn-buy-prop" :disabled="!canBuyProperty()" @click="initTrade('buyProperty')">
              买地皮 (¥{{ buyPropertyPrice() }})
            </button>
            <button v-if="(pendingEvent.buildingLevel ?? 0) > 0" class="btn-action btn-buy-build" :disabled="!canBuyBuilding()" @click="initTrade('buyBuilding')">
              买房屋 (¥{{ buyBuildingPrice() }})
            </button>
            <button class="btn-action btn-rent" :disabled="!canRent()" @click="initTrade('rent')">
              租房 (¥{{ rentPrice() }})
            </button>
          </div>
          <button class="btn-no-need" @click="handleNoNeed">不需要</button>
        </div>
      </div>

      <!-- 等待对方回复 -->
      <div v-if="showWaiting" class="modal modal-waiting">
        <div class="waiting-icon">⏳</div>
        <div class="waiting-text">等待 {{ tradeData.ownerName }} 回复...</div>
        <div class="waiting-detail">
          {{ tradeData.buyerName }} 请求 {{ tradeData.type === 'buyProperty' ? '购买地皮' : tradeData.type === 'buyBuilding' ? '购买房屋' : '租赁' }}
          {{ tradeData.propertyName }}
        </div>
      </div>

      <TradeResultModal
        v-model:show="showTradeResult"
        :accepted="tradeAccepted"
        :message="tradeResultMsg"
        @update:show="onResultClose"
      />
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
  z-index: 1100;
  backdrop-filter: blur(4px);
}

.modal {
  width: 340px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  animation: popIn 0.3s ease;
}

.header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid #eee;
}

.title { font-size: 18px; font-weight: 700; color: #212121; margin: 0; }

.body { padding: 16px 20px; }

.prop-info {
  background: linear-gradient(135deg, #FFF3E0, #FFE0B2);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.prop-name { font-size: 16px; font-weight: 700; color: #E65100; }
.prop-owner { font-size: 13px; color: #BF360C; margin-top: 4px; }

.prompt {
  font-size: 14px;
  color: #424242;
  text-align: center;
  margin-bottom: 16px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.btn-action {
  padding: 10px 0;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.btn-action:hover:not(:disabled) { transform: translateY(-1px); }
.btn-action:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-buy-prop { background: #FF6F00; color: #fff; }
.btn-buy-build { background: #FF8F00; color: #fff; }
.btn-rent { background: #43A047; color: #fff; }

.btn-no-need {
  width: 100%;
  padding: 10px 0;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 600;
  background: #f5f5f5;
  color: #666;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-no-need:hover { background: #e0e0e0; }

.modal-waiting {
  text-align: center;
  padding: 32px 24px;
}

.waiting-icon {
  font-size: 48px;
  animation: pulse 1.2s ease-in-out infinite;
}

.waiting-text {
  font-size: 17px;
  font-weight: 700;
  color: #212121;
  margin-top: 12px;
}

.waiting-detail {
  font-size: 13px;
  color: #9e9e9e;
  margin-top: 8px;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.7; }
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

  .prop-info {
    padding: 10px 12px;
  }

  .prop-name { font-size: 14px; }
  .prop-owner { font-size: 12px; }

  .prompt {
    font-size: 13px;
  }

  .btn-action {
    font-size: 14px;
    min-height: 44px;
  }

  .btn-no-need {
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
