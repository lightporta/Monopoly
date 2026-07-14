import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGameStore } from './gameStore'

export const useOnlineStore = defineStore('online', () => {
  const roomKey = ref<string | null>(null)
  const playerId = ref<string | null>(null)
  const isHost = ref(false)
  const roomState = ref<any>(null)
  const playerSeats = ref<any[]>([])
  const gameStarted = ref(false)

  function setRoomInfo(key: string, pid: string, host: boolean) {
    roomKey.value = key
    playerId.value = pid
    isHost.value = host
  }

  function setRoomState(state: any) {
    roomState.value = state
  }

  function setGameStarted(seats: any[]) {
    playerSeats.value = seats
    gameStarted.value = true
  }

  function reset() {
    roomKey.value = null
    playerId.value = null
    isHost.value = false
    roomState.value = null
    playerSeats.value = []
    gameStarted.value = false
    // 同步清理 gameStore 联机状态，防止残留导致下次进入异常
    try {
      const gameStore = useGameStore()
      gameStore.setOnlineMode(false)
    } catch (e) { /* Pinia 未初始化时忽略 */ }
  }

  return {
    roomKey,
    playerId,
    isHost,
    roomState,
    playerSeats,
    gameStarted,
    setRoomInfo,
    setRoomState,
    setGameStarted,
    reset
  }
})
