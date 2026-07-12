<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
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

const router = useRouter()
const store = useGameStore()

const showBuild = ref(false)
const showFoodRedeem = ref(false)
const showSideDrawer = ref(false)
const isMobile = ref(false)

const showBuyProperty = computed(() => store.pendingModal?.type === 'buyProperty')
const showCard = computed(() => {
  const t = store.pendingModal?.type
  return t === 'drawChance' || t === 'drawDestiny'
})
const showTeleport = computed(() => {
  const t = store.pendingModal?.type
  return t === 'teleportAnyEmpty' || t === 'moveAnyCell'
})
const showLandedOnOpponent = computed(() => store.pendingModal?.type === 'landOpponentProperty')

function onVictoryClose() {
  store.confirmExit()
  router.push('/')
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  let lastTouchEnd = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) e.preventDefault()
    lastTouchEnd = now
  }, { passive: false })
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="game-view">
    <TopBar />

    <div class="game-main">
      <div class="board-area">
        <BoardMap />
      </div>

      <!-- 桌面端：右侧面板 -->
      <div v-if="!isMobile" class="side-panel">
        <PlayerPanel />
        <GameLog />
      </div>

      <!-- 移动端：抽屉按钮 -->
      <button v-if="isMobile" class="side-drawer-fab" @click="showSideDrawer = !showSideDrawer">
        {{ showSideDrawer ? '✕' : '👥' }}
      </button>
    </div>

    <!-- 移动端抽屉 -->
    <Transition name="drawer">
      <div v-if="isMobile && showSideDrawer" class="side-drawer-mask" @click="showSideDrawer = false">
        <div class="side-drawer" @click.stop>
          <div class="drawer-handle" />
          <PlayerPanel />
          <GameLog />
        </div>
      </div>
    </Transition>

    <div class="bottom-bar">
      <DiceWidget />
      <ActionButtons @manage-assets="showBuild = true" @redeem-food="showFoodRedeem = true" />
    </div>

    <!-- 弹窗层 -->
    <CardModal v-if="showCard" />
    <BuyPropertyModal v-if="showBuyProperty" />
    <BuildModal v-model:show="showBuild" />
    <LandedOnOpponentModal :show="showLandedOnOpponent" />
    <TeleportSelectModal v-if="showTeleport" />
    <FoodRedeemModal v-model:show="showFoodRedeem" />
    <TurnHandoffModal v-if="store.showTurnHandoff" />
    <ExitConfirmModal v-if="store.showExitConfirm" />
    <VictoryModal v-if="store.showVictory" @close="onVictoryClose" />
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
</style>
