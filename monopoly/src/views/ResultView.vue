<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import type { Player } from '@/engine/types'

const router = useRouter()
const store = useGameStore()

const winner = computed(() => store.state.winner)
const winReason = computed(() => store.state.winReason || '游戏结束')

const confettiColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#FBC02D', '#1E88E5']
const confettiPieces = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  color: confettiColors[i % confettiColors.length],
  delay: Math.random() * 3,
  duration: 2.5 + Math.random() * 2,
  rotate: Math.random() * 360,
}))

function calcTotalAssets(player: Player): number {
  let total = player.cash
  const props = store.getPlayerProperties(player.id)
  for (const prop of props) {
    total += prop.price
    const level = player.buildings[prop.id] ?? 0
    if (level > 0) total += prop.buildCost * level
  }
  return total
}

const rankedPlayers = computed(() => {
  return [...store.state.players]
    .map(p => ({
      player: p,
      cash: p.cash,
      propCount: store.getPlayerProperties(p.id).length,
      totalAssets: calcTotalAssets(p),
    }))
    .sort((a, b) => b.totalAssets - a.totalAssets)
})

function playerStatus(p: Player): string {
  if (winner.value?.id === p.id) return '🏆 获胜'
  if (p.bankrupt) return '💸 破产'
  return '在局'
}
</script>

<template>
  <div class="result-view">
    <div class="confetti">
      <div v-for="c in confettiPieces" :key="c.id" class="confetti-piece"
        :style="{ left: c.left + '%', background: c.color, animationDelay: c.delay + 's', animationDuration: c.duration + 's', transform: `rotate(${c.rotate}deg)` }"></div>
    </div>

    <div class="result-card">
      <!-- 获胜者横幅 -->
      <div class="winner-banner" v-if="winner">
        <div class="winner-token">{{ winner.token }}</div>
        <h1 class="winner-name">{{ winner.name }}</h1>
        <p class="win-reason">{{ winReason }}</p>
      </div>

      <!-- 排名表 -->
      <div class="ranking-section">
        <h2 class="section-title">最终排名</h2>
        <div class="table-wrapper">
          <table class="rank-table">
            <thead>
              <tr>
                <th>名次</th><th>玩家</th><th>现金</th><th>地产</th><th>总资产</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in rankedPlayers" :key="item.player.id"
                :class="{ 'is-winner': winner?.id === item.player.id, 'is-bankrupt': item.player.bankrupt }">
                <td class="rank">{{ idx + 1 }}</td>
                <td class="player-cell">
                  <span class="mini-token" :style="{ background: item.player.color }">{{ item.player.token }}</span>
                  <span>{{ item.player.name }}</span>
                </td>
                <td>¥{{ item.cash.toLocaleString() }}</td>
                <td>{{ item.propCount }} 块</td>
                <td class="assets">¥{{ item.totalAssets.toLocaleString() }}</td>
                <td class="status">{{ playerStatus(item.player) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-row">
        <button class="btn btn-primary" @click="router.push('/')">再来一局</button>
        <button class="btn btn-secondary" @click="router.push('/')">返回主菜单</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-view { position: relative; width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(160deg, #0D47A1 0%, #1565C0 40%, #FBC02D 120%); }

.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.confetti-piece { position: absolute; top: -20px; width: 10px; height: 16px; border-radius: 2px; animation: confettiFall linear infinite; }
@keyframes confettiFall { 0% { top: -20px; opacity: 1; } 90% { opacity: 1; } 100% { top: 110vh; opacity: 0; } }

.result-card { position: relative; z-index: 1; width: 90%; max-width: 640px; padding: 36px 32px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(16px); border-radius: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); animation: cardIn 0.5s ease; }
@keyframes cardIn { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

.winner-banner { text-align: center; padding-bottom: 24px; border-bottom: 2px solid rgba(251, 192, 45, 0.3); }
.winner-token { font-size: 64px; line-height: 1; margin-bottom: 8px; animation: tokenBounce 1.5s ease-in-out infinite; }
@keyframes tokenBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
.winner-name { font-size: 32px; font-weight: 800; color: var(--color-gold); text-shadow: 0 2px 8px rgba(251, 192, 45, 0.3); }
.win-reason { margin-top: 8px; font-size: 15px; color: var(--color-text-secondary); }

.ranking-section { margin-top: 24px; }
.section-title { font-size: 18px; font-weight: 700; color: var(--color-ocean); margin-bottom: 12px; }
.table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid #E0E0E0; }
.rank-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.rank-table th { padding: 10px 8px; background: var(--color-ocean); color: #fff; font-weight: 600; white-space: nowrap; }
.rank-table th:first-child { border-radius: 12px 0 0 0; }
.rank-table th:last-child { border-radius: 0 12px 0 0; }
.rank-table td { padding: 10px 8px; text-align: center; border-bottom: 1px solid #EEE; }
.rank-table tbody tr:last-child td { border-bottom: none; }
.rank-table tbody tr:hover { background: #E3F2FD; }
tr.is-winner { background: rgba(251, 192, 45, 0.12); }
tr.is-bankrupt { opacity: 0.55; }
.rank { font-weight: 700; font-size: 16px; color: var(--color-gold); }
.player-cell { display: flex; align-items: center; gap: 6px; justify-content: center; white-space: nowrap; }
.mini-token { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 14px; flex-shrink: 0; }
.assets { font-weight: 700; color: var(--color-ocean); }
.status { font-size: 13px; white-space: nowrap; }

.action-row { display: flex; gap: 16px; justify-content: center; margin-top: 28px; }

@media (max-width: 480px) {
  .result-card { padding: 24px 16px; }
  .winner-token { font-size: 48px; }
  .winner-name { font-size: 24px; }
  .rank-table { font-size: 12px; }
  .rank-table th, .rank-table td { padding: 8px 4px; }
  .action-row { flex-direction: column; }
}
</style>
