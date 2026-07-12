import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
