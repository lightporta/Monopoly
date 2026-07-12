<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { onlineSDK } from '@/online/onlineSdk.js'
import { useOnlineStore } from '@/stores/onlineStore'
import { useGameStore } from '@/stores/gameStore'

const router = useRouter()
const onlineStore = useOnlineStore()
const gameStore = useGameStore()

const showLeaveConfirm = ref(false)
const showDisbandConfirm = ref(false)
const errorMsg = ref('')

const isHost = computed(() => onlineStore.isHost)
const roomKey = computed(() => onlineStore.roomKey)
const players = computed(() => onlineStore.roomState?.players || [])
const status = computed(() => onlineStore.roomState?.status || 'waiting')

const canStart = computed(() => {
  const connectedCount = players.value.filter((p: any) => p.connected).length
  return isHost.value && status.value === 'waiting' && connectedCount >= 2
})

let unsub: (() => void)[] = []

onMounted(() => {
  unsub.push(onlineSDK.on('room:state', (state: any) => {
    onlineStore.setRoomState(state)
  }))
  unsub.push(onlineSDK.on('room:started', (data: any) => {
    onlineStore.setGameStarted(data.playerSeats)
    gameStore.setOnlineGameState(data.gameState)
    gameStore.setOnlineMode(true)
    router.push('/game')
  }))
  unsub.push(onlineSDK.on('room:disbanded', (data: any) => {
    onlineStore.reset()
    gameStore.setOnlineMode(false)
    alert('房主已解散房间')
    router.push('/')
  }))
  unsub.push(onlineSDK.on('room:error', (payload: any) => {
    errorMsg.value = payload.message
  }))
  unsub.push(onlineSDK.on('disconnect', () => {
    if (!onlineStore.roomKey) return
    alert('连接中断，请重新加入')
    onlineStore.reset()
    gameStore.setOnlineMode(false)
    router.push('/')
  }))
})

onUnmounted(() => {
  unsub.forEach(fn => fn())
})

function copyKey() {
  if (roomKey.value) {
    navigator.clipboard.writeText(roomKey.value)
      .then(() => {
        alert('房间号已复制到剪贴板')
      })
      .catch(() => {
        alert(`房间号：${roomKey.value}`)
      })
  }
}

function handleStart() {
  if (!canStart.value) return
  errorMsg.value = ''
  onlineSDK.startGame()
}

function handleLeave() {
  showLeaveConfirm.value = true
}

function confirmLeave() {
  showLeaveConfirm.value = false
  onlineSDK.leaveRoom()
  onlineSDK.disconnect()
  onlineStore.reset()
  gameStore.setOnlineMode(false)
  router.push('/')
}

function handleDisband() {
  showDisbandConfirm.value = true
}

function confirmDisband() {
  showDisbandConfirm.value = false
  onlineSDK.disbandRoom()
}

function getSeatPlayers() {
  const seats = []
  for (let i = 0; i < 4; i++) {
    const p = players.value.find((pl: any) => pl.seatIndex === i)
    seats.push(p || null)
  }
  return seats
}
</script>

<template>
  <div class="online-room">
    <div class="waves"><div class="wave w1"></div><div class="wave w2"></div><div class="wave w3"></div></div>
    <div class="room-card">
      <div class="room-header">
        <div class="room-key">
          <span>🏠 房间：</span>
          <span class="key-text">{{ roomKey }}</span>
          <button class="copy-btn" @click="copyKey" aria-label="复制房间号">复制</button>
        </div>
        <div class="room-status">
          <span class="status-dot" :class="status"></span>
          {{ status === 'waiting' ? '等待玩家加入...' : '游戏中' }}
        </div>
      </div>

      <div class="seat-list">
        <div v-for="(p, i) in getSeatPlayers()" :key="i" class="seat-item">
          <div class="seat-number">座位 {{ i + 1 }}</div>
          <template v-if="p">
            <div class="player-info">
              <span v-if="p.isHost" class="host-badge">👑 房主</span>
              <span class="player-name" :class="{ disconnected: !p.connected }">{{ p.playerName }}</span>
            </div>
            <div class="seat-status">
              <span v-if="p.connected" class="connected">已就绪</span>
              <span v-else class="disconnected">已断开</span>
            </div>
          </template>
          <template v-else>
            <div class="empty-seat">（空）等待加入</div>
          </template>
        </div>
      </div>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

      <div class="action-buttons">
        <button v-if="isHost" class="btn-start" :disabled="!canStart" @click="handleStart">开始游戏</button>
        <button class="btn-leave" @click="isHost ? handleDisband() : handleLeave()">
          {{ isHost ? '解散房间' : '离开房间' }}
        </button>
      </div>
    </div>

    <transition name="modal">
      <div v-if="showLeaveConfirm" class="modal-overlay" @click.self="showLeaveConfirm = false">
        <div class="modal">
          <h3>确认离开</h3>
          <p>确定离开当前房间？你的本局记录将被清空</p>
          <div class="modal-buttons">
            <button class="btn-cancel" @click="showLeaveConfirm = false">取消</button>
            <button class="btn-confirm" @click="confirmLeave">确认离开</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="modal">
      <div v-if="showDisbandConfirm" class="modal-overlay" @click.self="showDisbandConfirm = false">
        <div class="modal">
          <h3>确认解散</h3>
          <p>你是房主，解散将使所有玩家退出。确定解散？</p>
          <div class="modal-buttons">
            <button class="btn-cancel" @click="showDisbandConfirm = false">取消</button>
            <button class="btn-confirm danger" @click="confirmDisband">确认解散</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.online-room { position: relative; width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(160deg, #0D47A1, #1565C0 30%, #1E88E5 60%, #42A5F5); }
.waves { position: absolute; bottom: 0; left: 0; width: 100%; height: 40%; pointer-events: none; }
.wave { position: absolute; bottom: 0; left: -50%; width: 200%; height: 100%; transform-origin: center bottom; }
.w1 { background: radial-gradient(ellipse at center bottom, rgba(255,255,255,.12), transparent 70%); animation: waveFloat 8s ease-in-out infinite; }
.w2 { background: radial-gradient(ellipse at center bottom, rgba(78,205,196,.15), transparent 70%); animation: waveFloat 6s ease-in-out infinite reverse; }
.w3 { background: radial-gradient(ellipse at center bottom, rgba(251,192,45,.08), transparent 70%); animation: waveFloat 10s ease-in-out infinite; }
@keyframes waveFloat { 0%,100% { transform: translateX(0) scaleY(1); } 50% { transform: translateX(-25px) scaleY(1.05); } }

.room-card { position: relative; z-index: 1; width: 90%; max-width: 460px; padding: 28px; background: rgba(255,255,255,.1); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.2); border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.3); }

.room-header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,.15); }
.room-key { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 600; color: #fff; }
.key-text { color: var(--color-gold, #FBC02D); letter-spacing: 2px; font-family: monospace; font-size: 18px; }
.copy-btn { padding: 4px 10px; background: rgba(251,192,45,.2); border: 1px solid rgba(251,192,45,.4); border-radius: 8px; color: var(--color-gold, #FBC02D); font-size: 12px; cursor: pointer; transition: all .2s; }
.copy-btn:hover { background: rgba(251,192,45,.3); }
.room-status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,.7); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4CAF50; }
.status-dot.waiting { background: #FFC107; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

.seat-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.seat-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,.08); border-radius: 12px; border: 1px solid rgba(255,255,255,.1); }
.seat-number { font-size: 12px; color: rgba(255,255,255,.5); }
.player-info { display: flex; align-items: center; gap: 8px; }
.host-badge { font-size: 12px; }
.player-name { font-size: 14px; font-weight: 600; color: #fff; }
.player-name.disconnected { color: rgba(255,255,255,.4); text-decoration: line-through; }
.seat-status { font-size: 12px; }
.seat-status .connected { color: #4CAF50; }
.seat-status .disconnected { color: #FF6B6B; }
.empty-seat { color: rgba(255,255,255,.4); font-size: 14px; font-style: italic; }

.error-msg { color: #FF6B6B; font-size: 13px; text-align: center; margin: 0 0 12px 0; }

.action-buttons { display: flex; gap: 12px; justify-content: center; }
.action-buttons button { padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all .2s; }
.btn-start { background: linear-gradient(135deg, #FBC02D, #FFA000); color: #3E2723; }
.btn-start:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(251,192,45,.4); }
.btn-start:disabled { opacity: .5; cursor: not-allowed; }
.btn-leave { background: rgba(255,255,255,.15); color: #fff; }
.btn-leave:hover { background: rgba(255,255,255,.25); }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { width: 100%; max-width: 380px; background: linear-gradient(160deg, #1A237E, #283593); border-radius: 20px; padding: 28px; border: 1px solid rgba(255,255,255,.2); }
.modal h3 { margin: 0 0 12px 0; color: var(--color-gold, #FBC02D); font-size: 18px; }
.modal p { color: rgba(255,255,255,.8); font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
.modal-buttons { display: flex; gap: 12px; }
.modal-buttons button { flex: 1; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
.btn-cancel { background: rgba(255,255,255,.15); color: #fff; }
.btn-confirm { background: var(--color-gold, #FBC02D); color: #3E2723; }
.btn-confirm.danger { background: #FF6B6B; color: #fff; }

.modal-enter-active, .modal-leave-active { transition: all .3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal, .modal-leave-to .modal { transform: scale(0.9); }
</style>
