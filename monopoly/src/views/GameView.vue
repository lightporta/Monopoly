<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useOnlineStore } from '@/stores/onlineStore'
import { onlineSDK } from '@/online/onlineSdk.js'
import TopBar from '@/components/hud/TopBar.vue'
import BoardMap from '@/components/board/BoardMap.vue'
import PlayerPanel from '@/components/hud/PlayerPanel.vue'
import GameLog from '@/components/hud/GameLog.vue'
import DiceWidget from '@/components/hud/DiceWidget.vue'
import ActionButtons from '@/components/hud/ActionButtons.vue'
import CardModal from '@/components/modals/CardModal.vue'
import BuyPropertyModal from '@/components/modals/BuyPropertyModal.vue'
import BuildModal from '@/components/modals/BuildModal.vue'
import TeleportSelectModal from '@/components/modals/TeleportSelectModal.vue'
import FoodRedeemModal from '@/components/modals/FoodRedeemModal.vue'
import TurnHandoffModal from '@/components/modals/TurnHandoffModal.vue'
import ExitConfirmModal from '@/components/modals/ExitConfirmModal.vue'
import VictoryModal from '@/components/modals/VictoryModal.vue'
import LandedOnOpponentModal from '@/components/modals/LandedOnOpponentModal.vue'
import EquipmentModal from '@/components/modals/EquipmentModal.vue'
import AquacultureModal from '@/components/modals/AquacultureModal.vue'
import InvestModal from '@/components/modals/InvestModal.vue'
import EcologyDetailModal from '@/components/modals/EcologyDetailModal.vue'

const router = useRouter()
const store = useGameStore()
const onlineStore = useOnlineStore()

const showBuild = ref(false)
const showFoodRedeem = ref(false)
const showSideDrawer = ref(false)
const isMobile = ref(false)
const showInvest = ref(false)

// 联机模式：只有"我的待处理事件"才显示交互弹窗（interactivePendingModal 在非自己回合返回 null）
const interactive = computed(() => store.interactivePendingModal)
const showBuyProperty = computed(() => interactive.value?.type === 'buyProperty')
const showCard = computed(() => {
  const t = interactive.value?.type
  return t === 'drawChance' || t === 'drawDestiny'
})
const showTeleport = computed(() => {
  const t = interactive.value?.type
  return t === 'teleportAnyEmpty' || t === 'moveAnyCell'
})
const showLandedOnOpponent = computed(() => interactive.value?.type === 'landOpponentProperty')

// 联机观战提示：非自己回合且有待处理事件时，显示"等待 XXX 操作..."
const waitingForPlayer = computed(() => {
  if (!store.isOnlineMode || !store.pendingModal || store.isMyPendingEvent) return null
  const pid = store.pendingModal.playerId
  const p = store.state.players.find(pl => pl.id === pid) || store.state.players[pid]
  return p ? p.name : null
})

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

// ============ 联机模式：监听服务端状态 ============
let onlineUnsubs: (() => void)[] = []

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  let lastTouchEnd = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) e.preventDefault()
    lastTouchEnd = now
  }, { passive: false })

  // 联机模式：接收服务端广播的完整游戏状态
  if (store.isOnlineMode) {
    onlineUnsubs.push(onlineSDK.on('game:state', (data: any) => {
      store.applyOnlineState(data.gameState || data)
    }))
    onlineUnsubs.push(onlineSDK.on('game:ended', (data: any) => {
      // 服务端已通过 game:state 广播 ended 状态，这里做额外 UI 处理
      store.applyOnlineState({ ...store.onlineGameState, phase: 'ended', winner: data.winner ? { name: data.winner } : null, winReason: data.winReason })
    }))
    // 房主解散房间：所有人回首页并提示
    onlineUnsubs.push(onlineSDK.on('room:disbanded', () => {
      const isHost = onlineStore.isHost
      onlineStore.reset()
      store.setOnlineMode(false)
      store.showVictory = false
      // 房主看到"你已解散该房间"，其他人看到"房主已解散该房间"
      store.notifyRoomDisbanded(isHost ? '你已解散该房间' : '房主已解散该房间')
      router.push('/')
    }))
    // 玩家退出房间：提示剩余玩家（1s 自动消失）
    onlineUnsubs.push(onlineSDK.on('player:left', (data: any) => {
      if (data?.playerName) store.showPlayerLeftNotice(data.playerName)
    }))
    // 退到只剩房主：房主回到房间等待界面
    onlineUnsubs.push(onlineSDK.on('room:returned_to_lobby', (data: any) => {
      onlineStore.setRoomState(data)
      onlineStore.gameStarted = false
      router.push('/online-room')
    }))
    // 房主开下一局：重新进入游戏界面
    onlineUnsubs.push(onlineSDK.on('room:started', (data: any) => {
      store.showVictory = false
      if (data.playerSeats) onlineStore.setGameStarted(data.playerSeats)
      if (data.gameState) {
        store.applyOnlineState(data.gameState)
      }
    }))
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  onlineUnsubs.forEach(fn => fn())
  onlineUnsubs = []
})
</script>

<template>
  <div class="game-view">
    <TopBar />

    <!-- 联机观战提示：等待其他玩家操作 -->
    <div v-if="waitingForPlayer" class="waiting-banner">
      ⏳ 等待 {{ waitingForPlayer }} 操作...
    </div>
    <!-- 联机玩家退出提示（1s 自动消失） -->
    <Transition name="fade">
      <div v-if="store.playerLeftNotice" class="player-left-toast">
        {{ store.playerLeftNotice }}
      </div>
    </Transition>

    <!-- 桌面端布局：棋盘 + 右侧面板 -->
    <template v-if="!isMobile">
      <div class="game-main">
        <div class="board-area">
          <BoardMap />
        </div>
        <div class="side-panel">
          <PlayerPanel />
          <GameLog />
        </div>
      </div>
      <div class="bottom-bar">
        <DiceWidget />
        <ActionButtons
          @manage-assets="showBuild = true"
          @redeem-food="showFoodRedeem = true"
          @open-invest="showInvest = true"
        />
      </div>
      <!-- 桌面端投资按钮 -->
      <button class="invest-fab" @click="showInvest = true" aria-label="投资核电">
        💼 投资核电
      </button>
    </template>

    <!-- 移动端布局：棋盘 → 按钮一排 → 玩家状态+日志（可滚动） -->
    <template v-else>
      <div class="mobile-layout">
        <!-- 棋盘区（自适应高度） -->
        <div class="mobile-board">
          <BoardMap />
        </div>

        <!-- 骰子显示（紧凑） -->
        <div class="mobile-dice">
          <DiceWidget />
        </div>

        <!-- 主操作按钮一排 -->
        <div class="mobile-actions">
          <button class="m-btn m-roll" :disabled="!store.canRollDice" @click="store.rollDice()">
            🎲 掷骰
          </button>
          <button class="m-btn" :disabled="!store.canManageAssets" @click="showBuild = true">
            🏠 资产
          </button>
          <button class="m-btn" :disabled="!store.canRollDice" @click="showFoodRedeem = true">
            🍱 美食
          </button>
          <button class="m-btn m-invest" @click="showInvest = true">
            💼 投资核电
          </button>
        </div>
        <div v-if="store.reRollTickets > 0" class="mobile-extras">
          <button class="m-btn m-reroll" :disabled="!store.canUseReRollTicket" @click="store.useReRollTicket()">
            🎫 重掷({{ store.reRollTickets }})
          </button>
          <button class="m-btn m-skip" :disabled="!store.canSkipTurn" @click="store.skipTurn()">
            🏳️ 放弃
          </button>
        </div>

        <!-- 玩家状态 + 日志（可滚动） -->
        <div class="mobile-status">
          <PlayerPanel />
          <GameLog />
        </div>
      </div>
    </template>

    <!-- 弹窗层 -->
    <CardModal v-if="showCard" />
    <BuyPropertyModal v-if="showBuyProperty" />
    <BuildModal v-model:show="showBuild" />
    <LandedOnOpponentModal :show="showLandedOnOpponent" />
    <TeleportSelectModal v-if="showTeleport" />
    <FoodRedeemModal v-model:show="showFoodRedeem" />
    <TurnHandoffModal v-if="store.showTurnHandoff" />
    <ExitConfirmModal v-if="store.showExitConfirm" />
    <VictoryModal v-if="store.showVictory" />
    <!-- 四大海洋板块弹窗 -->
    <EquipmentModal v-model:show="store.showEquipmentModal" />
    <AquacultureModal v-model:show="store.showAquacultureModal" />
    <InvestModal v-model:show="showInvest" />
    <EcologyDetailModal v-model:show="store.showEcologyDetail" />
  </div>
</template>

<style scoped>
.game-view {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, #E3F2FD 0%, #BBDEFB 100%);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  box-sizing: border-box;
}

/* ============ 移动端布局：5 个板块自然流式排列，整页可上下滚动 ============ */
/* 棋盘 → 骰子 → 按钮 → 玩家状态+日志，各板块不重叠，日志内部也可滚动 */
.mobile-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 关键：整页可滚动，不裁剪 */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 4px;
  gap: 6px;
}

/* 板块 1：棋盘（按宽度自适应方形） */
.mobile-board {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 板块 2：骰子 */
.mobile-dice {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 2px 0;
}

/* 板块 3：主操作按钮一排 */
.mobile-actions {
  display: flex;
  gap: 6px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  flex-shrink: 0;
}

.mobile-extras {
  display: flex;
  gap: 6px;
  padding: 0 6px;
  flex-shrink: 0;
}

.m-btn {
  flex: 1;
  padding: 10px 4px;
  font-size: 12px;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  background: #fff;
  color: var(--color-ocean, #1E88E5);
  border: 1.5px solid var(--color-ocean, #1E88E5);
  cursor: pointer;
  min-height: 44px;
  transition: all 0.15s;
}

.m-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.m-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.m-roll {
  background: linear-gradient(135deg, #1E88E5, #1565c0);
  color: #fff;
  border: none;
}

.m-invest {
  background: linear-gradient(135deg, #6A1B9A, #4a148c);
  color: #fff;
  border: none;
}

.m-reroll {
  background: linear-gradient(135deg, #FBC02D, #F57F17);
  color: #fff;
  border: none;
}

.m-skip {
  background: linear-gradient(135deg, #78909C, #546E7A);
  color: #fff;
  border: none;
}

/* 板块 4：玩家状态 + 日志（内部可滚动，类似电脑端） */
.mobile-status {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}

/* 移动端：解除 game-view 的 overflow 限制，让整页可滚动 */
@media (max-width: 767px) {
  .game-view {
    height: auto;
    min-height: 100dvh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

.game-main {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.board-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.side-panel {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
}

.side-drawer-fab {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #fff;
  border: none;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  font-size: 20px;
  cursor: pointer;
  z-index: 10;
}

.side-drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.side-drawer {
  width: 100%;
  max-height: 75vh;
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding: 12px 16px 20px;
  box-sizing: border-box;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: slideUp 0.3s ease;
}

.drawer-handle {
  width: 40px;
  height: 4px;
  background: #ddd;
  border-radius: 2px;
  margin: 0 auto 8px;
  flex-shrink: 0;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.drawer-enter-active, .drawer-leave-active {
  transition: opacity 0.3s ease;
}
.drawer-enter-from, .drawer-leave-to {
  opacity: 0;
}

.bottom-bar {
  height: 100px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 0 20px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
}

/* 四大海洋板块：投资核电按钮（左下方固定） */
.invest-fab {
  position: fixed;
  left: 16px;
  bottom: calc(112px + env(safe-area-inset-bottom));
  z-index: 90;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #6A1B9A, #4a148c);
  border: none;
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 14px rgba(106, 27, 154, 0.45);
  cursor: pointer;
  transition: var(--transition-base);
}

.invest-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(106, 27, 154, 0.6);
}

@media (max-width: 900px) {
  .game-main {
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }
  .side-panel {
    width: 100%;
    max-height: 180px;
  }
  .bottom-bar {
    height: auto;
    padding: 10px 12px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

@media (max-width: 767px) {
  .game-view {
    font-size: 14px;
  }
  .bottom-bar {
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  }
  .side-drawer-fab {
    top: 8px;
    right: 8px;
    width: 44px;
    height: 44px;
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .game-main {
    padding: 4px;
  }
  .bottom-bar {
    gap: 6px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  }
}

@media (orientation: landscape) and (max-height: 480px) {
  .bottom-bar {
    height: auto;
    padding: 6px 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* 联机观战提示条 */
.waiting-banner {
  position: fixed;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: rgba(33, 150, 243, 0.95);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 20px;
  border-radius: 9999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

/* 联机玩家退出提示（toast） */
.player-left-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1100;
  background: rgba(244, 67, 54, 0.95);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  padding: 14px 28px;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
</style>
