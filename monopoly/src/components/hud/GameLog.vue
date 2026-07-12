<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const logContainer = ref<HTMLElement | null>(null)

interface LogEntry {
  id: number
  playerId: number | null
  playerName: string
  playerToken: string
  playerColor: string
  text: string
  timestamp: string
}

const visibleLogs = ref<LogEntry[]>([])
let nextLogId = 0
let streamTimer: number | null = null
const pendingQueue: string[] = []
let lastProcessedLen = 0

function formatTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function parseLog(log: string): LogEntry {
  const players = store.state.players
  let matchedPlayer = null

  for (const p of players) {
    if (log.startsWith(p.name) || log.includes(`${p.name} `)) {
      matchedPlayer = p
      break
    }
  }

  if (matchedPlayer) {
    return {
      id: nextLogId++,
      playerId: matchedPlayer.id,
      playerName: matchedPlayer.name,
      playerToken: matchedPlayer.token,
      playerColor: matchedPlayer.color,
      text: log.replace(matchedPlayer.name, '').trim(),
      timestamp: formatTime()
    }
  }

  return {
    id: nextLogId++,
    playerId: null,
    playerName: '系统',
    playerToken: '🔔',
    playerColor: '#95A5A6',
    text: log,
    timestamp: formatTime()
  }
}

function streamNext() {
  if (pendingQueue.length === 0) return

  const log = pendingQueue.shift()!
  const entry = parseLog(log)
  visibleLogs.value.push(entry)

  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })

  if (pendingQueue.length > 0) {
    streamTimer = window.setTimeout(streamNext, 120)
  } else {
    streamTimer = null
  }
}

function checkForNewLogs() {
  const currentLen = store.state.log.length
  if (currentLen > lastProcessedLen) {
    const newEntries = store.state.log.slice(lastProcessedLen)
    lastProcessedLen = currentLen
    pendingQueue.push(...newEntries)
    if (!streamTimer) {
      streamNext()
    }
  }
}

watch(() => store.state.log.length, () => {
  checkForNewLogs()
})

onMounted(() => {
  lastProcessedLen = 0
  checkForNewLogs()
})
</script>

<template>
  <aside class="game-log">
    <h2 class="log-title">📜 游戏日志</h2>
    <div ref="logContainer" class="log-container">
      <div v-if="visibleLogs.length === 0" class="log-empty">
        游戏尚未开始...
      </div>
      <div
        v-for="entry in visibleLogs"
        :key="entry.id"
        class="log-bubble"
        :class="{ 'log-bubble--system': entry.playerId === null }"
      >
        <div class="bubble-avatar" :style="{ background: entry.playerColor }">
          {{ entry.playerToken }}
        </div>
        <div class="bubble-body">
          <div class="bubble-header">
            <span class="bubble-name" :style="{ color: entry.playerColor }">{{ entry.playerName }}</span>
            <span class="bubble-time">{{ entry.timestamp }}</span>
          </div>
          <div class="bubble-text">{{ entry.text }}</div>
        </div>
      </div>
      <div v-if="pendingQueue.length > 0" class="log-typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.game-log {
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #2C3E50, #1A232E);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 10px;
}

.log-title {
  font-size: 14px;
  font-weight: 700;
  color: #FFE66D;
  text-align: center;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  letter-spacing: 1px;
  margin: 0;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 10px 10px;
  max-height: 300px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-empty {
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}

.log-bubble {
  display: flex;
  gap: 8px;
  animation: slideIn 0.25s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.log-bubble--system {
  justify-content: center;
}

.log-bubble--system .bubble-body {
  text-align: center;
}

.log-bubble--system .bubble-text {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 12px;
}

.bubble-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.bubble-body {
  flex: 1;
  min-width: 0;
}

.bubble-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 2px;
}

.bubble-name {
  font-size: 11px;
  font-weight: 700;
}

.bubble-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  font-family: 'Monaco', 'Menlo', monospace;
}

.bubble-text {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  background: rgba(255, 255, 255, 0.06);
  padding: 6px 10px;
  border-radius: 0 10px 10px 10px;
}

.log-typing {
  display: flex;
  gap: 3px;
  padding: 8px 12px;
}

.log-typing span {
  width: 5px;
  height: 5px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  animation: typingBounce 1s infinite;
}

.log-typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.log-typing span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.log-container::-webkit-scrollbar {
  width: 4px;
}

.log-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.04);
}

.log-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
</style>
