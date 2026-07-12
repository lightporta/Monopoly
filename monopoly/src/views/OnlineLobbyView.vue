<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { onlineSDK } from '@/online/onlineSdk.js'
import { useOnlineStore } from '@/stores/onlineStore'

const router = useRouter()
const onlineStore = useOnlineStore()

const tab = ref<'create' | 'join'>('create')
const roomKey = ref('')
const playerName = ref(onlineSDK.getPlayerName())
const errorMsg = ref('')
const isConnecting = ref(false)

let unsub: (() => void)[] = []

onMounted(() => {
  unsub.push(onlineSDK.on('room:created', (payload: any) => {
    onlineStore.setRoomInfo(payload.roomKey, payload.playerId, true)
    onlineStore.setRoomState({ status: 'waiting', players: [{ playerId: payload.playerId, playerName: playerName.value, seatIndex: 0, isHost: true, connected: true }] })
    router.push('/online-room')
  }))
  unsub.push(onlineSDK.on('room:joined', (payload: any) => {
    onlineStore.setRoomInfo(payload.roomKey, payload.playerId, false)
    onlineStore.setRoomState({ status: 'waiting', players: payload.players })
    router.push('/online-room')
  }))
  unsub.push(onlineSDK.on('room:error', (payload: any) => {
    errorMsg.value = payload.message
    isConnecting.value = false
  }))
})

onUnmounted(() => {
  unsub.forEach(fn => fn())
})

async function handleSubmit() {
  errorMsg.value = ''
  if (!playerName.value.trim()) {
    errorMsg.value = '请输入昵称'
    return
  }
  if (playerName.value.length < 1 || playerName.value.length > 8) {
    errorMsg.value = '昵称1~8字符'
    return
  }
  if (!roomKey.value.trim()) {
    errorMsg.value = '请输入房间号'
    return
  }
  if (!/^[A-Za-z0-9]{4,10}$/.test(roomKey.value)) {
    errorMsg.value = '房间号需4~10位字母数字（区分大小写）'
    return
  }

  isConnecting.value = true
  onlineSDK.setPlayerName(playerName.value.trim())

  try {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`
    await onlineSDK.connect(wsUrl)
    if (tab.value === 'create') {
      onlineSDK.createRoom(roomKey.value.trim().toUpperCase(), playerName.value.trim())
    } else {
      onlineSDK.joinRoom(roomKey.value.trim(), playerName.value.trim())
    }
  } catch (e) {
    errorMsg.value = '连接服务器失败，请稍后重试'
    isConnecting.value = false
  }
}

function goBack() {
  onlineSDK.disconnect()
  router.push('/')
}
</script>

<template>
  <div class="online-lobby">
    <div class="waves"><div class="wave w1"></div><div class="wave w2"></div><div class="wave w3"></div></div>
    <div class="lobby-card">
      <button class="back-btn" @click="goBack" aria-label="返回">← 返回</button>
      <h2 class="lobby-title">🌐 联机大厅</h2>

      <div class="input-group">
        <label>玩家昵称</label>
        <input v-model="playerName" class="name-input" placeholder="请输入昵称（1~8字符）" maxlength="8" />
      </div>

      <div class="tabs">
        <button :class="['tab-btn', { active: tab === 'create' }]" @click="tab = 'create'; errorMsg = ''">创建房间</button>
        <button :class="['tab-btn', { active: tab === 'join' }]" @click="tab = 'join'; errorMsg = ''">加入房间</button>
      </div>

      <div class="input-group">
        <label>房间 Key</label>
        <input v-model="roomKey" class="key-input" :placeholder="tab === 'create' ? '自定义房间号（4~10位）' : '输入房间号'" maxlength="10" />
        <p class="hint">区分大小写，仅支持字母和数字</p>
      </div>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

      <button class="submit-btn" @click="handleSubmit" :disabled="isConnecting">
        {{ isConnecting ? '连接中...' : (tab === 'create' ? '创建房间' : '加入房间') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.online-lobby { position: relative; width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(160deg, #0D47A1, #1565C0 30%, #1E88E5 60%, #42A5F5); }
.waves { position: absolute; bottom: 0; left: 0; width: 100%; height: 40%; pointer-events: none; }
.wave { position: absolute; bottom: 0; left: -50%; width: 200%; height: 100%; transform-origin: center bottom; }
.w1 { background: radial-gradient(ellipse at center bottom, rgba(255,255,255,.12), transparent 70%); animation: waveFloat 8s ease-in-out infinite; }
.w2 { background: radial-gradient(ellipse at center bottom, rgba(78,205,196,.15), transparent 70%); animation: waveFloat 6s ease-in-out infinite reverse; }
.w3 { background: radial-gradient(ellipse at center bottom, rgba(251,192,45,.08), transparent 70%); animation: waveFloat 10s ease-in-out infinite; }
@keyframes waveFloat { 0%,100% { transform: translateX(0) scaleY(1); } 50% { transform: translateX(-25px) scaleY(1.05); } }

.lobby-card { position: relative; z-index: 1; width: 90%; max-width: 420px; padding: 32px 28px; background: rgba(255,255,255,.1); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.2); border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
.back-btn { background: none; border: none; color: rgba(255,255,255,.7); font-size: 14px; cursor: pointer; padding: 4px 8px; margin-bottom: 8px; transition: color .2s; }
.back-btn:hover { color: #fff; }
.lobby-title { text-align: center; font-size: 24px; font-weight: 700; color: var(--color-gold, #FBC02D); margin-bottom: 24px; text-shadow: 0 2px 8px rgba(0,0,0,.3); }

.input-group { margin-bottom: 16px; }
.input-group label { display: block; color: rgba(255,255,255,.9); font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.name-input, .key-input { width: 100%; padding: 12px 16px; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25); border-radius: 12px; color: #fff; font-size: 15px; outline: none; box-sizing: border-box; }
.name-input:focus, .key-input:focus { border-color: var(--color-gold, #FBC02D); background: rgba(255,255,255,.2); }
.name-input::placeholder, .key-input::placeholder { color: rgba(255,255,255,.4); }
.hint { color: rgba(255,255,255,.5); font-size: 12px; margin-top: 6px; }

.tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.tab-btn { flex: 1; padding: 10px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2); border-radius: 10px; color: rgba(255,255,255,.7); font-size: 14px; font-weight: 600; cursor: pointer; transition: all .2s; }
.tab-btn.active { background: var(--color-gold, #FBC02D); border-color: var(--color-gold, #FBC02D); color: #3E2723; }

.error-msg { color: #FF6B6B; font-size: 13px; margin: 0 0 12px 0; text-align: center; }

.submit-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #FBC02D, #FFA000); border: none; border-radius: 14px; color: #3E2723; font-size: 16px; font-weight: 700; cursor: pointer; transition: transform .2s, box-shadow .2s; }
.submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(251,192,45,.4); }
.submit-btn:disabled { opacity: .6; cursor: not-allowed; }
</style>
