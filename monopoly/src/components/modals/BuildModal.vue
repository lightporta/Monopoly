<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Property, Player } from '@/engine/types'
import TradeResultModal from './TradeResultModal.vue'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const store = useGameStore()

const player = computed(() => store.currentPlayer)

const activeTab = ref<'mine' | 'other'>('mine')
const otherPlayerIndex = ref(0)

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

const myProps = computed(() => {
  const p = player.value
  if (!p) return []
  return store.properties.filter((prop) => p.properties.includes(prop.id))
})

const otherPlayers = computed(() => {
  const p = player.value
  if (!p) return []
  return store.state.players.filter(pl => pl.id !== p.id && !pl.bankrupt)
})

const currentOtherPlayer = computed(() => {
  const players = otherPlayers.value
  if (players.length === 0) return null
  return players[otherPlayerIndex.value % players.length]
})

const otherPlayerProps = computed(() => {
  const p = currentOtherPlayer.value
  if (!p) return []
  return store.properties.filter((prop) => p.properties.includes(prop.id))
})

const currentCellOwnerProp = computed(() => {
  const p = player.value
  if (!p) return null
  const cell = store.board[p.position]
  if (!cell || cell.type !== 'property' || !cell.propertyRef) return null
  const prop = store.properties.find(pr => pr.id === cell.propertyRef)
  if (!prop) return null
  const owner = store.getPropertyOwner(prop.id)
  if (!owner || owner.id === p.id) return null
  if (owner.mortgaged.includes(prop.id)) return null
  return { prop, owner }
})

function levelIcon(level: number): string {
  if (level === 0) return '空地'
  if (level >= 4) return '🏨'
  return '🏠'.repeat(level)
}

function isMortgaged(propId: string, targetPlayer?: Player): boolean {
  const p = targetPlayer ?? player.value
  return p?.mortgaged.includes(propId) ?? false
}

function buildingLevel(propId: string, targetPlayer?: Player): number {
  const pid = (targetPlayer ?? player.value)?.id
  return pid != null ? store.getBuildingLevel(propId, pid) : 0
}

function mortgageValue(prop: Property): number {
  return Math.floor(prop.price * 0.5)
}

function redeemCost(prop: Property): number {
  return Math.floor(prop.price * 0.55)
}

function canBuild(prop: Property): boolean {
  const p = player.value
  if (!p) return false
  return (
    !isMortgaged(prop.id) &&
    buildingLevel(prop.id) < 4 &&
    p.cash >= prop.buildCost
  )
}

function canSellBuilding(prop: Property): boolean {
  const p = player.value
  if (!p) return false
  return !isMortgaged(prop.id) && buildingLevel(prop.id) > 0
}

function sellRefund(prop: Property): number {
  return Math.floor(prop.buildCost / 2)
}

function canRedeem(prop: Property): boolean {
  const p = player.value
  if (!p) return false
  return isMortgaged(prop.id) && p.cash >= redeemCost(prop)
}

function colorOf(prop: Property): string {
  return store.getColorGroup(prop.colorGroup)?.color ?? '#1E88E5'
}

// ---- 四大海洋板块：装备/养殖辅助 ----

/** 该地产是否为装备供应点，返回对应装备数据 */
function getEquipmentForProp(propId: string) {
  const cell = store.board.find((c) => c.propertyRef === propId)
  if (!cell) return null
  return store.equipmentList.find((e) => e.soldAtCell === cell.index) ?? null
}

/** 该地产对应的装备是否已售出 */
function isEquipSold(propId: string): boolean {
  const eq = getEquipmentForProp(propId)
  return eq ? store.isEquipmentSold(eq.id) : false
}

/** 打开装备购买弹窗 */
function openEquipment(propId: string) {
  store.activeEquipmentPropertyId = propId
  store.showEquipmentModal = true
}

/** 该地产是否支持养殖 */
function isAquacultureProp(propId: string): boolean {
  return store.isAquacultureProperty(propId)
}

/** 该地产的养殖等级 */
function getAquacultureLevel(propId: string): number {
  const p = player.value
  return p ? store.getAquacultureLevel(propId, p.id) : 0
}

/** 打开养殖场弹窗 */
function openAquaculture(propId: string) {
  store.activeAquaculturePropertyId = propId
  store.showAquacultureModal = true
}

function prevOtherPlayer() {
  const players = otherPlayers.value
  if (players.length <= 1) return
  otherPlayerIndex.value = (otherPlayerIndex.value - 1 + players.length) % players.length
}

function nextOtherPlayer() {
  const players = otherPlayers.value
  if (players.length <= 1) return
  otherPlayerIndex.value = (otherPlayerIndex.value + 1) % players.length
}

function buyPropertyPrice(): number {
  const info = currentCellOwnerProp.value
  if (!info) return 0
  const level = store.getBuildingLevel(info.prop.id, info.owner.id)
  return info.prop.price + info.prop.buildCost * level
}

function buyBuildingPrice(): number {
  const info = currentCellOwnerProp.value
  if (!info) return 0
  const level = store.getBuildingLevel(info.prop.id, info.owner.id)
  return info.prop.buildCost * level
}

function rentPrice(): number {
  const info = currentCellOwnerProp.value
  if (!info || !player.value) return 0
  return store.getRentPrice(info.prop.id, info.owner.id, player.value.id)
}

function ownerBuildingLevel(): number {
  const info = currentCellOwnerProp.value
  if (!info) return 0
  return store.getBuildingLevel(info.prop.id, info.owner.id)
}

function canBuyProperty(): boolean {
  const p = player.value
  if (!p) return false
  return p.cash >= buyPropertyPrice()
}

function canBuyBuilding(): boolean {
  const p = player.value
  if (!p) return false
  return ownerBuildingLevel() > 0 && p.cash >= buyBuildingPrice()
}

function canRent(): boolean {
  const p = player.value
  if (!p) return false
  return p.cash >= rentPrice()
}

function initTrade(type: 'buyProperty' | 'buyBuilding' | 'rent') {
  const info = currentCellOwnerProp.value
  if (!info || !player.value) return
  const price = type === 'buyProperty' ? buyPropertyPrice()
    : type === 'buyBuilding' ? buyBuildingPrice()
    : rentPrice()
  tradeData.value = {
    type,
    propertyId: info.prop.id,
    propertyName: info.prop.name,
    ownerId: info.owner.id,
    ownerName: info.owner.name,
    buyerId: player.value.id,
    buyerName: player.value.name,
    price
  }

  // 买家不需看到同意/不同意弹窗，只显示等待状态，然后显示结果
  showWaiting.value = true
  const acceptRate = info.owner.isAI ? 0.7 : 0.8
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
      ? `交易成功！${tradeData.value.ownerName} 已同意`
      : '交易失败：资金不足'
  } else {
    tradeResultMsg.value = `${tradeData.value.ownerName} 不同意此次交易`
  }
  showTradeResult.value = true
}

function buyPropertyPriceFor(propId: string, owner: Player | null): number {
  if (!owner) return 0
  const prop = store.properties.find(p => p.id === propId)
  if (!prop) return 0
  const level = store.getBuildingLevel(propId, owner.id)
  return prop.price + prop.buildCost * level
}

function buyBuildingPriceFor(propId: string, owner: Player | null): number {
  if (!owner) return 0
  const prop = store.properties.find(p => p.id === propId)
  if (!prop) return 0
  const level = store.getBuildingLevel(propId, owner.id)
  return prop.buildCost * level
}

function rentPriceFor(propId: string, owner: Player | null): number {
  if (!owner || !player.value) return 0
  return store.getRentPrice(propId, owner.id, player.value.id)
}

function canBuyPropertyFor(propId: string, owner: Player | null): boolean {
  const p = player.value
  if (!p || !owner) return false
  if (isMortgaged(propId, owner)) return false
  return p.cash >= buyPropertyPriceFor(propId, owner)
}

function canBuyBuildingFor(propId: string, owner: Player | null): boolean {
  const p = player.value
  if (!p || !owner) return false
  if (isMortgaged(propId, owner)) return false
  const level = store.getBuildingLevel(propId, owner.id)
  return level > 0 && p.cash >= buyBuildingPriceFor(propId, owner)
}

function canRentFor(propId: string, owner: Player | null): boolean {
  const p = player.value
  if (!p || !owner) return false
  if (isMortgaged(propId, owner)) return false
  return p.cash >= rentPriceFor(propId, owner)
}

function initTradeFor(type: 'buyProperty' | 'buyBuilding' | 'rent', propId: string, owner: Player | null) {
  if (!owner || !player.value) return
  const prop = store.properties.find(p => p.id === propId)
  if (!prop) return
  const price = type === 'buyProperty' ? buyPropertyPriceFor(propId, owner)
    : type === 'buyBuilding' ? buyBuildingPriceFor(propId, owner)
    : rentPriceFor(propId, owner)
  tradeData.value = {
    type,
    propertyId: propId,
    propertyName: prop.name,
    ownerId: owner.id,
    ownerName: owner.name,
    buyerId: player.value.id,
    buyerName: player.value.name,
    price
  }

  // 买家不需看到同意/不同意弹窗，只显示等待状态，然后显示结果
  showWaiting.value = true
  const acceptRate = owner.isAI ? 0.7 : 0.8
  const accept = Math.random() < acceptRate
  setTimeout(() => {
    showWaiting.value = false
    handleTradeResult(accept)
  }, 1200)
}

function close() {
  emit('update:show', false)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="overlay">
      <div class="modal">
        <div class="header">
          <div class="tabs">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'mine' }"
              @click="activeTab = 'mine'"
            >
              资产管理
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'other' }"
              @click="activeTab = 'other'"
            >
              对方资产
            </button>
          </div>
          <div v-if="activeTab === 'mine'" class="cash">现金 ¥{{ player?.cash ?? 0 }}</div>
        </div>

        <!-- 我的资产 -->
        <template v-if="activeTab === 'mine'">
          <div v-if="myProps.length === 0" class="empty">暂无地产，先去购买一块吧！</div>
          <div v-if="myProps.length > 0" class="list">
            <div v-for="prop in myProps" :key="prop.id" class="prop-card">
              <div class="prop-bar" :style="{ background: colorOf(prop) }" />
              <div class="prop-body">
                <div class="prop-head">
                  <span class="prop-name">{{ prop.name }}</span>
                  <span class="prop-level">{{ levelIcon(buildingLevel(prop.id)) }}</span>
                </div>
                <div class="prop-meta">建房 ¥{{ prop.buildCost }} · 抵押 ¥{{ mortgageValue(prop) }}</div>
                <div v-if="isMortgaged(prop.id)" class="mortgaged-tag">已抵押</div>
                <div class="prop-actions">
                  <button
                    class="btn btn-build"
                    :disabled="!canBuild(prop) || getAquacultureLevel(prop.id) > 0"
                    @click="store.buildHouse(prop.id)"
                  >建房 (¥{{ prop.buildCost }})</button>
                  <button
                    v-if="buildingLevel(prop.id) > 0"
                    class="btn btn-sell"
                    :disabled="!canSellBuilding(prop)"
                    @click="store.sellBuilding(prop.id)"
                  >拆房 (+¥{{ sellRefund(prop) }})</button>
                  <button
                    v-if="!isMortgaged(prop.id)"
                    class="btn btn-mortgage"
                    :disabled="buildingLevel(prop.id) > 0"
                    @click="store.mortgage(prop.id)"
                  >抵押</button>
                  <button
                    v-else
                    class="btn btn-redeem"
                    :disabled="!canRedeem(prop)"
                    @click="store.redeem(prop.id)"
                  >赎回 (¥{{ redeemCost(prop) }})</button>
                  <!-- 四大海洋板块：装备购买按钮（4 处装备供应点地产） -->
                  <button
                    v-if="getEquipmentForProp(prop.id)"
                    class="btn btn-equip"
                    :disabled="isEquipSold(prop.id)"
                    @click="openEquipment(prop.id)"
                  >{{ getEquipmentForProp(prop.id)?.icon }} {{ isEquipSold(prop.id) ? '已售' : '买装备' }}</button>
                  <!-- 四大海洋板块：养殖场按钮（4 处养殖地产） -->
                  <button
                    v-if="isAquacultureProp(prop.id) && getAquacultureLevel(prop.id) === 0"
                    class="btn btn-aqua"
                    :disabled="buildingLevel(prop.id) > 0"
                    @click="openAquaculture(prop.id)"
                  >🐚 建养殖场</button>
                  <button
                    v-else-if="isAquacultureProp(prop.id) && getAquacultureLevel(prop.id) > 0"
                    class="btn btn-aqua"
                    @click="openAquaculture(prop.id)"
                  >🐚 养殖L{{ getAquacultureLevel(prop.id) }} 管理</button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 对方资产 -->
        <template v-if="activeTab === 'other'">
          <div v-if="otherPlayers.length === 0" class="empty">暂无其他玩家</div>
          <template v-else>
            <div class="other-player-header">
              <button v-if="otherPlayers.length > 1" class="nav-btn" @click="prevOtherPlayer">‹</button>
              <div class="player-info">
                <span class="player-token">{{ currentOtherPlayer?.token }}</span>
                <span class="player-name">{{ currentOtherPlayer?.name }}</span>
                <span class="player-cash">现金 ¥{{ currentOtherPlayer?.cash ?? 0 }}</span>
              </div>
              <button v-if="otherPlayers.length > 1" class="nav-btn" @click="nextOtherPlayer">›</button>
            </div>
            <div class="list">
              <div v-if="otherPlayerProps.length === 0" class="empty">暂无地产</div>
              <div v-for="prop in otherPlayerProps" :key="prop.id" class="prop-card">
                <div class="prop-bar" :style="{ background: colorOf(prop) }" />
                <div class="prop-body">
                  <div class="prop-head">
                    <span class="prop-name">{{ prop.name }}</span>
                    <span class="prop-level">{{ levelIcon(buildingLevel(prop.id, currentOtherPlayer ?? undefined)) }}</span>
                  </div>
                  <div class="prop-meta">地价 ¥{{ prop.price }} · 建房 ¥{{ prop.buildCost }}</div>
                  <div v-if="isMortgaged(prop.id, currentOtherPlayer ?? undefined)" class="mortgaged-tag">已抵押</div>
                  <div v-else class="trade-buttons">
                    <button
                      class="tbtn tbtn-buy-prop"
                      :disabled="!canBuyPropertyFor(prop.id, currentOtherPlayer)"
                      @click="initTradeFor('buyProperty', prop.id, currentOtherPlayer)"
                    >买地皮 ¥{{ buyPropertyPriceFor(prop.id, currentOtherPlayer) }}</button>
                    <button
                      v-if="buildingLevel(prop.id, currentOtherPlayer ?? undefined) > 0"
                      class="tbtn tbtn-buy-build"
                      :disabled="!canBuyBuildingFor(prop.id, currentOtherPlayer)"
                      @click="initTradeFor('buyBuilding', prop.id, currentOtherPlayer)"
                    >买房屋 ¥{{ buyBuildingPriceFor(prop.id, currentOtherPlayer) }}</button>
                    <button
                      class="tbtn tbtn-rent"
                      :disabled="!canRentFor(prop.id, currentOtherPlayer)"
                      @click="initTradeFor('rent', prop.id, currentOtherPlayer)"
                    >租房 ¥{{ rentPriceFor(prop.id, currentOtherPlayer) }}</button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </template>

        <div class="footer">
          <button class="btn-close" @click="close">关闭</button>
        </div>
      </div>

      <!-- 等待对方回复 -->
      <div v-if="showWaiting" class="modal-waiting-overlay">
        <div class="modal-waiting-box">
          <div class="waiting-icon">⏳</div>
          <div class="waiting-text">等待 {{ tradeData.ownerName }} 回复...</div>
          <div class="waiting-detail">
            {{ tradeData.buyerName }} 请求 {{ tradeData.type === 'buyProperty' ? '购买地皮' : tradeData.type === 'buyBuilding' ? '购买房屋' : '租赁' }}
            {{ tradeData.propertyName }}
          </div>
        </div>
      </div>

      <TradeResultModal
        v-model:show="showTradeResult"
        :accepted="tradeAccepted"
        :message="tradeResultMsg"
      />
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
  width: 380px;
  max-height: 85vh;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  animation: popIn 0.3s ease;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.tabs {
  display: flex;
  gap: 4px;
  background: #f5f5f5;
  padding: 4px;
  border-radius: 9999px;
}

.tab-btn {
  padding: 7px 16px;
  border: none;
  background: transparent;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #fff;
  color: #1E88E5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.cash { font-size: 14px; font-weight: 600; color: #1E88E5; }

.empty { padding: 32px 22px; text-align: center; color: #9e9e9e; flex-shrink: 0; }

.list {
  padding: 8px 16px 12px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prop-card {
  display: flex;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.prop-bar { width: 6px; flex-shrink: 0; }

.prop-body { flex: 1; padding: 10px 12px; position: relative; min-width: 0; }

.prop-head { display: flex; justify-content: space-between; align-items: center; }
.prop-name { font-size: 15px; font-weight: 600; color: #212121; }
.prop-level { font-size: 16px; }

.prop-meta { font-size: 12px; color: #9e9e9e; margin-top: 2px; }

.mortgaged-tag {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  color: #fff;
  background: #E53935;
  padding: 1px 8px;
  border-radius: 9999px;
}

.prop-actions { display: flex; gap: 8px; margin-top: 8px; }

.btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.btn:hover:not(:disabled) { transform: translateY(-1px); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-build { background: #1E88E5; color: #fff; }
.btn-sell { background: #fff; color: #FF8F00; border: 1.5px solid #FF8F00; }
.btn-mortgage { background: #fff; color: #E53935; border: 1.5px solid #E53935; }
.btn-equip { background: linear-gradient(135deg, #00897B, #00695C); color: #fff; }
.btn-aqua { background: linear-gradient(135deg, #27AE60, #1e8e3e); color: #fff; }
.btn-redeem { background: #43A047; color: #fff; }

.trade-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.tbtn {
  padding: 6px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.tbtn:hover:not(:disabled) { transform: translateY(-1px); }
.tbtn:disabled { opacity: 0.4; cursor: not-allowed; }

.tbtn-buy-prop { background: #FF6F00; color: #fff; }
.tbtn-buy-build { background: #FF8F00; color: #fff; }
.tbtn-rent { background: #43A047; color: #fff; }

.other-player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #fff;
  border-radius: 50%;
  font-size: 20px;
  font-weight: bold;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.nav-btn:hover { background: #e0e0e0; }

.player-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-token { font-size: 18px; }
.player-name { font-size: 15px; font-weight: 700; color: #212121; }
.player-cash { font-size: 13px; color: #1E88E5; }

.footer { padding: 12px 16px 18px; border-top: 1px solid #eee; flex-shrink: 0; }

.btn-close {
  width: 100%;
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

.modal-waiting-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.modal-waiting-box {
  background: #fff;
  border-radius: 18px;
  padding: 32px 28px;
  text-align: center;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  animation: popIn 0.3s ease;
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

@media (max-width: 767px) {
  .modal {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 40px);
    max-height: calc(100dvh - 40px);
    border-radius: 16px;
  }
  .title { font-size: 16px; }
  .header { padding: 12px 16px 10px; }
  .tabs { gap: 2px; padding: 3px; }
  .tab-btn { padding: 6px 12px; font-size: 13px; }
  .cash { font-size: 13px; }
  .list { padding: 6px 12px 10px; gap: 8px; }
  .prop-card { border-radius: 10px; }
  .prop-body { padding: 8px 10px; }
  .prop-name { font-size: 14px; }
  .prop-meta { font-size: 11px; }
  .prop-actions { gap: 6px; margin-top: 6px; }
  .btn { padding: 6px 0; font-size: 12px; }
  .footer { padding: 10px 16px 14px; }
  .btn-close { padding: 10px 0; font-size: 14px; }
  .other-player-header { padding: 10px 12px; }
  .player-token { font-size: 16px; }
  .player-name { font-size: 14px; }
  .player-cash { font-size: 12px; }
  .nav-btn { width: 28px; height: 28px; font-size: 18px; }
  .trade-buttons { gap: 5px; margin-top: 6px; }
  .tbtn { padding: 5px 8px; font-size: 11px; }
}

@media (max-width: 480px) {
  .modal {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 20px);
    max-height: calc(100dvh - 20px);
  }
}

@keyframes popIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
