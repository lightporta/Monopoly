<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useOnlineStore } from '@/stores/onlineStore'
import { onlineSDK } from '@/online/onlineSdk.js'
import type { Player } from '@/engine/types'

const store = useGameStore()
const onlineStore = useOnlineStore()
const router = useRouter()

const visible = computed(() => store.showVictory)

const winner = computed(() => store.state.winner)
const winReason = computed(() => store.state.winReason ?? '胜利')
const mode = computed(() => store.gameMode)
const isOnline = computed(() => store.isOnlineMode)
const isHost = computed(() => onlineStore.isHost)

// 玩家自身（联机模式下用于判断输赢）
const myPlayer = computed(() => store.state.players[store.myPlayerId] ?? null)
const iWon = computed(() => {
  if (!isOnline.value) return false
  return winner.value?.id === store.myPlayerId
})

// AI 模式：真人是否赢（winner 为真人且非 AI）
const humanWonInPve = computed(() => {
  if (mode.value !== 'pve') return false
  return winner.value ? !winner.value.isAI : false
})

// 同设备模式：输家列表（除 winner 外，含破产与未破产）
const losers = computed(() => store.state.players.filter((p) => p.id !== winner.value?.id))

const confetti = computed(() =>
  Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 2.5 + Math.random() * 2,
    color: ['#FBC02D', '#1E88E5', '#E53935', '#43A047', '#8E24AA'][i % 5],
  }))
)

// 统一资产口径（含四大板块），避免与历史 ResultView 口径不一致
function totalAssets(p: Player): number {
  return store.estimateAssets(p.id)?.total ?? 0
}

const ranking = computed(() => {
  return [...store.state.players]
    .map((p) => ({ player: p, assets: totalAssets(p) }))
    .sort((a, b) => {
      if (a.player.bankrupt !== b.player.bankrupt) return a.player.bankrupt ? 1 : -1
      return b.assets - a.assets
    })
})

// 主标题与副标题
const mainTitle = computed(() => {
  if (isOnline.value) return iWon.value ? '🎉 胜利' : '💔 失败'
  if (mode.value === 'pve') return humanWonInPve.value ? '🎉 胜利' : '💔 失败'
  // 同设备：展示赢家昵称
  return `🏆 ${winner.value?.name ?? ''} 赢`
})

const subTitle = computed(() => {
  if (isOnline.value) return iWon.value ? '你赢得了本局！' : '本局你输了，再来一次吧'
  if (mode.value === 'pve') return humanWonInPve.value ? '你击败了 AI 对手！' : 'AI 对手取得了胜利'
  // 同设备：列出输家
  const names = losers.value.map((l) => l.name).join('、')
  return names ? `${names} 输` : ''
})

const showConfetti = computed(() => {
  if (isOnline.value) return iWon.value
  if (mode.value === 'pve') return humanWonInPve.value
  return true // 同设备模式总展示
})

// ====== 按钮行为 ======
// 单机"再玩一局"：用相同配置重开
function playAgain() {
  store.playAgain()
}

// 单机"退出"：回首页
function exitToHome() {
  store.confirmExit()
  router.push('/')
}

// 联机房主"再来一局"：通知服务端重开
function onlineRestart() {
  onlineSDK.restartGame()
  store.showVictory = false
}

// 联机房主"解散房间"
function onlineDisband() {
  onlineSDK.disbandRoom()
  // 服务端会广播 room:disbanded，由 GameView 统一处理跳转与提示
  store.showVictory = false
}

// 联机非房主"等待房主开下一局"：关闭弹窗留在房间
function onlineWaitNext() {
  store.showVictory = false
}

// 联机非房主"退出房间"
function onlineLeaveRoom() {
  onlineSDK.leaveRoom()
  onlineSDK.disconnect()
  onlineStore.reset()
  store.setOnlineMode(false)
  store.showVictory = false
  router.push('/')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible && winner" class="overlay">
      <div v-if="showConfetti" class="confetti-layer">
        <span
          v-for="c in confetti"
          :key="c.id"
          class="confetti"
          :style="{
            left: c.left + '%',
            animationDelay: c.delay + 's',
            animationDuration: c.duration + 's',
            background: c.color,
          }"
        />
      </div>

      <div class="modal">
        <div class="crown">{{ showConfetti ? '👑' : '🎲' }}</div>
        <div class="winner-token">{{ winner.token }}</div>
        <h1 class="title">{{ mainTitle }}</h1>
        <p v-if="subTitle" class="subtitle">{{ subTitle }}</p>
        <p class="reason">{{ winReason }}</p>

        <div class="ranking">
          <div
            v-for="(item, idx) in ranking"
            :key="item.player.id"
            :class="['rank-row', { top: idx === 0 }]"
          >
            <span class="rank-no">{{ idx + 1 }}</span>
            <span class="rank-token">{{ item.player.token }}</span>
            <span class="rank-name">{{ item.player.name }}</span>
            <span class="rank-assets">¥{{ item.assets }}</span>
          </div>
        </div>

        <!-- 单机模式按钮 -->
        <div v-if="!isOnline" class="btn-row">
          <button class="btn-action btn-primary" @click="playAgain">再玩一局</button>
          <button class="btn-action btn-secondary" @click="exitToHome">退出</button>
        </div>

        <!-- 联机模式：房主 -->
        <div v-else-if="isHost" class="btn-row">
          <button class="btn-action btn-primary" @click="onlineRestart">再来一局</button>
          <button class="btn-action btn-secondary" @click="onlineDisband">解散房间</button>
        </div>

        <!-- 联机模式：非房主 -->
        <div v-else class="btn-row">
          <button class="btn-action btn-primary" @click="onlineWaitNext">等待房主开下一局</button>
          <button class="btn-action btn-secondary" @click="onlineLeaveRoom">退出房间</button>
        </div>
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
  z-index: 1200;
  backdrop-filter: blur(4px);
  overflow: hidden;
  padding: 16px;
}

.confetti-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.confetti {
  position: absolute;
  top: -20px;
  width: 10px;
  height: 14px;
  border-radius: 2px;
  animation: fall linear infinite;
}

@keyframes fall {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(105vh) rotate(720deg); opacity: 0.6; }
}

.modal {
  position: relative;
  width: 380px;
  max-width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  background: linear-gradient(160deg, #FFF8E1 0%, #ffffff 60%);
  border: 3px solid #FBC02D;
  border-radius: 22px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
  padding: 28px 24px 24px;
  text-align: center;
  animation: popIn 0.4s ease;
}

.crown {
  font-size: 44px;
  line-height: 1;
  animation: bounce 1.6s ease-in-out infinite;
}

.winner-token {
  font-size: 64px;
  margin: 4px 0 2px;
  line-height: 1;
}

.title {
  font-size: 28px;
  font-weight: 800;
  color: #F57F17;
  text-shadow: 0 2px 8px rgba(251, 192, 45, 0.4);
  margin: 0;
}

.subtitle {
  margin: 6px 0 0;
  font-size: 15px;
  color: #5D4037;
  font-weight: 600;
}

.reason {
  margin-top: 4px;
  font-size: 14px;
  color: #8D6E63;
  font-weight: 600;
}

.ranking {
  margin: 20px 0 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #FFE082;
}

.rank-row.top {
  background: linear-gradient(90deg, #FFF59D, #FFFDE7);
  border-color: #FBC02D;
}

.rank-no {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #FBC02D;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rank-token { font-size: 18px; }
.rank-name { flex: 1; text-align: left; font-size: 14px; font-weight: 600; color: #5D4037; }
.rank-assets { font-size: 14px; font-weight: 700; color: #F57F17; }

.btn-row {
  display: flex;
  gap: 12px;
}

.btn-action {
  flex: 1;
  padding: 13px 0;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #FBC02D 0%, #F57F17 100%);
  color: #fff;
}

.btn-secondary {
  background: rgba(0, 0, 0, 0.08);
  color: #5D4037;
}

.btn-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

@keyframes popIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 480px) {
  .modal { padding: 22px 16px 18px; }
  .title { font-size: 22px; }
  .winner-token { font-size: 52px; }
  .btn-action { font-size: 14px; padding: 12px 0; }
}
</style>
