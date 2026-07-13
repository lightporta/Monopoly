<script setup lang="ts">
// 核电/风电投资弹窗（左下方「💼 投资核电」入口）
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const player = computed(() => store.currentPlayer)
const playerCash = computed(() => player.value?.cash ?? 0)

// 我已持有的投资
const myInvestments = computed(() => {
  if (!player.value) return []
  return player.value.investments.map((inv) => {
    const data = store.investmentProjects.find((p) => p.id === inv.projectId)
    return { ...inv, name: data?.name ?? inv.projectId, icon: data?.icon ?? '💼' }
  })
})

function close() {
  emit('update:show', false)
}

function buy(projectId: string, cost: number) {
  if (playerCash.value < cost) return
  store.investNuclear(projectId)
}

function remaining(projectId: string): number {
  return store.investmentRemaining(projectId)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="overlay" @click.self="close">
      <div class="modal">
        <div class="modal-header">
          <h3>💼 投资项目</h3>
          <button class="close-btn" @click="close" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <div class="cash-row">你的现金：<strong>{{ playerCash }} 元</strong></div>

          <div v-for="p in store.investmentProjects" :key="p.id" class="project-card">
            <div class="project-head">
              <span class="project-icon">{{ p.icon }}</span>
              <span class="project-name">{{ p.name }}</span>
              <span class="project-remaining">剩余 {{ remaining(p.id) }}/{{ p.maxCopies }} 份</span>
            </div>
            <div class="project-meta">
              <span>投入：{{ p.cost }}</span>
              <span>每回合分红：+{{ p.dividendPerTurn }}</span>
            </div>
            <div class="project-risk">
              <span v-if="p.accidentFee > 0">⚠️ 风险：抽到核事故卡 → {{ p.accidentStopTurns }}回合无分红 + 付{{ p.accidentFee }}救援费</span>
              <span v-else-if="p.chainEffect.length > 0">⚠️ 连锁：1号机组事故时本机组也停发分红</span>
              <span v-else class="safe">✓ 无风险</span>
            </div>
            <button
              class="btn-buy"
              :disabled="remaining(p.id) <= 0 || playerCash < p.cost"
              @click="buy(p.id, p.cost)"
            >
              <span v-if="remaining(p.id) <= 0">已售罄</span>
              <span v-else-if="playerCash < p.cost">资金不足</span>
              <span v-else>购买</span>
            </button>
          </div>

          <div v-if="myInvestments.length > 0" class="my-investments">
            <div class="section-title">我的投资：</div>
            <div v-for="inv in myInvestments" :key="inv.projectId" class="my-inv-item">
              {{ inv.icon }} {{ inv.name }}
              <span v-if="inv.stopDividendTurns > 0" class="stopped">（停发{{ inv.stopDividendTurns }}回合）</span>
              <span v-else>（正常分红中）</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-close" @click="close">关闭</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1100; backdrop-filter: blur(4px); }
.modal { width: 460px; max-width: calc(100vw - 32px); max-height: calc(100dvh - 64px); background: #fff; border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; animation: popIn 0.25s ease; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: linear-gradient(135deg, #6A1B9A, #4a148c); color: #fff; }
.modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.close-btn { width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(255,255,255,0.25); color: #fff; font-size: 18px; cursor: pointer; }
.modal-body { padding: 14px 18px; overflow-y: auto; flex: 1; }
.cash-row { font-size: 13px; color: #555; margin-bottom: 12px; }
.project-card { border: 1.5px solid #e0e0e0; border-radius: 10px; padding: 12px; margin-bottom: 12px; position: relative; }
.project-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.project-icon { font-size: 20px; }
.project-name { font-size: 14px; font-weight: 700; color: #333; flex: 1; }
.project-remaining { font-size: 11px; color: #888; background: #f0f0f0; padding: 2px 8px; border-radius: 10px; }
.project-meta { display: flex; gap: 16px; font-size: 12px; color: #555; margin-bottom: 4px; }
.project-risk { font-size: 11px; color: #FB8C00; margin-bottom: 10px; }
.project-risk .safe { color: #43A047; }
.btn-buy { padding: 7px 20px; background: #6A1B9A; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-buy:disabled { background: #bdbdbd; cursor: not-allowed; }
.my-investments { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ddd; }
.section-title { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
.my-inv-item { font-size: 12px; color: #555; line-height: 1.8; }
.my-inv-item .stopped { color: #E53935; }
.modal-footer { padding: 12px 18px; border-top: 1px solid #eee; display: flex; justify-content: center; }
.btn-close { padding: 8px 28px; background: #eee; color: #555; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
@keyframes popIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 480px) { .modal { width: calc(100vw - 16px); } }
</style>
