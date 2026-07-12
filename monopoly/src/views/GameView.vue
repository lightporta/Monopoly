<script setup lang="ts">
import { ref, computed } from 'vue'
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

const router = useRouter()
const store = useGameStore()

const showBuild = ref(false)
const showFoodRedeem = ref(false)

const showBuyProperty = computed(() => store.pendingModal?.type === 'buyProperty')
const showCard = computed(() => {
  const t = store.pendingModal?.type
  return t === 'drawChance' || t === 'drawDestiny'
})
const showTeleport = computed(() => {
  const t = store.pendingModal?.type
  return t === 'teleportAnyEmpty' || t === 'moveAnyCell'
})

function onVictoryClose() {
  store.confirmExit()
  router.push('/')
}
</script>

<template>
  <div class="game-view">
    <TopBar />

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
      <ActionButtons @build="showBuild = true" @redeem-food="showFoodRedeem = true" />
    </div>

    <!-- 弹窗层 -->
    <CardModal v-if="showCard" />
    <BuyPropertyModal v-if="showBuyProperty" />
    <BuildModal v-model:show="showBuild" />
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, #E3F2FD 0%, #BBDEFB 100%);
}

.game-main {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  min-height: 0;
  overflow: hidden;
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
  }
  .side-panel {
    width: 100%;
    max-height: 200px;
  }
  .bottom-bar {
    height: auto;
    padding: 10px 12px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

@media (max-width: 600px) {
  .bottom-bar {
    flex-direction: column;
  }
}
</style>
