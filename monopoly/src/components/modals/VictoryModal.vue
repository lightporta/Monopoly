<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import type { Player } from '@/engine/types'

const store = useGameStore()
const router = useRouter()

const visible = computed(() => store.showVictory)

const winner = computed(() => store.state.winner)

const winReason = computed(() => store.state.winReason ?? '胜利')

const confetti = computed(() =>
  Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 2.5 + Math.random() * 2,
    color: ['#FBC02D', '#1E88E5', '#E53935', '#43A047', '#8E24AA'][i % 5],
  }))
)

function totalAssets(p: Player): number {
  let assets = p.cash
  for (const propId of p.properties) {
    const prop = store.properties.find((pr) => pr.id === propId)
    if (!prop) continue
    const mortgaged = p.mortgaged.includes(propId)
    assets += mortgaged ? Math.floor(prop.price * 0.5) : prop.price
    const lvl = p.buildings[propId] ?? 0
    assets += prop.buildCost * lvl
  }
  return assets
}

const ranking = computed(() => {
  return [...store.state.players]
    .map((p) => ({ player: p, assets: totalAssets(p) }))
    .sort((a, b) => {
      if (a.player.bankrupt !== b.player.bankrupt) return a.player.bankrupt ? 1 : -1
      return b.assets - a.assets
    })
})

function backHome() {
  router.push('/')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible && winner" class="overlay">
      <div class="confetti-layer">
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
        <div class="crown">👑</div>
        <div class="winner-token">{{ winner.token }}</div>
        <h1 class="winner-name">{{ winner.name }}</h1>
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

        <button class="btn-home" @click="backHome">返回主菜单</button>
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

.winner-name {
  font-size: 28px;
  font-weight: 800;
  color: #F57F17;
  text-shadow: 0 2px 8px rgba(251, 192, 45, 0.4);
}

.reason {
  margin-top: 4px;
  font-size: 15px;
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

.btn-home {
  width: 100%;
  padding: 13px 0;
  border-radius: 9999px;
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #FBC02D 0%, #F57F17 100%);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-home:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(245, 127, 23, 0.4);
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
</style>
