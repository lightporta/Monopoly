<script setup lang="ts">
// 海产养殖场建造/升级/拆除弹窗
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const property = computed(() => {
  const propId = store.activeAquaculturePropertyId
  if (!propId) return null
  return store.properties.find((p) => p.id === propId) ?? null
})

const player = computed(() => store.currentPlayer)
const currentLevel = computed(() => {
  if (!property.value || !player.value) return 0
  return player.value.aquaculture[property.value.id]?.level ?? 0
})

const nextLevel = computed(() => {
  if (!property.value?.aquaculture) return null
  if (currentLevel.value >= 3) return null
  return property.value.aquaculture.levels[currentLevel.value]
})

const playerCash = computed(() => player.value?.cash ?? 0)
const canAfford = computed(() => nextLevel.value ? playerCash.value >= nextLevel.value.cost : false)

// 拆除模式
const showDemolishConfirm = ref(false)
watch(() => props.show, (v) => { if (v) showDemolishConfirm.value = false })

const demolishRefund = computed(() => {
  if (!property.value?.aquaculture || currentLevel.value === 0) return 0
  let invested = 0
  for (let i = 0; i < currentLevel.value; i++) {
    invested += property.value.aquaculture.levels[i].cost
  }
  return Math.floor(invested * 0.5)
})

function close() {
  emit('update:show', false)
}

function build() {
  if (!property.value || !canAfford.value) return
  store.buildAquaculture(property.value.id)
  close()
}

function demolish() {
  if (!property.value) return
  store.demolishAquaculture(property.value.id)
  close()
}

const levelNames = ['空地', '育苗场', '养殖场', '深海牧场']
</script>

<template>
  <Transition name="fade">
    <div v-if="show && property" class="overlay" @click.self="close">
      <div class="modal">
        <div class="modal-header">
          <h3>🐚 {{ currentLevel > 0 ? '养殖场管理' : '建造养殖场' }} — {{ property.name }}（{{ property.aquaculture?.specialty }}）</h3>
          <button class="close-btn" @click="close" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <div class="status-row">
            <span>当前等级：<strong>{{ levelNames[currentLevel] }}</strong></span>
            <span>你的现金：{{ playerCash }} 元</span>
          </div>

          <!-- 已建养殖：显示当前收益 + 升级/拆除选项 -->
          <div v-if="currentLevel > 0" class="current-info">
            <div>每经过起点收益：<strong>{{ property.aquaculture?.levels[currentLevel - 1].income }} 元</strong></div>
            <div v-if="nextLevel">可升级至：<strong>{{ nextLevel.name }}</strong>（成本 {{ nextLevel.cost }} 元，收益 {{ nextLevel.income }} 元）</div>
            <div v-else class="max-level">已达最高等级（深海牧场）</div>
          </div>

          <!-- 升级操作 -->
          <div v-if="nextLevel" class="action-card">
            <div class="action-title">{{ nextLevel.name }}</div>
            <div class="action-desc">成本：{{ nextLevel.cost }} 元 | 每经过起点 +{{ nextLevel.income }} 元</div>
            <button class="btn-build" :disabled="!canAfford" @click="build">
              {{ canAfford ? `升级至${nextLevel.name}` : '资金不足' }}
            </button>
          </div>

          <!-- 拆除操作 -->
          <div v-if="currentLevel > 0" class="demolish-section">
            <div v-if="!showDemolishConfirm" class="demolish-hint">
              ⚠️ 拆除养殖场将回收 {{ demolishRefund }} 元（累计投入的 50%），地产恢复为空地
            </div>
            <button v-if="!showDemolishConfirm" class="btn-demolish" @click="showDemolishConfirm = true">拆除养殖场</button>
            <div v-else class="confirm-row">
              <span>确认拆除？回收 {{ demolishRefund }} 元</span>
              <button class="btn-cancel" @click="showDemolishConfirm = false">取消</button>
              <button class="btn-confirm-demolish" @click="demolish">确认拆除</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="close">关闭</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1100; backdrop-filter: blur(4px); }
.modal { width: 440px; max-width: calc(100vw - 32px); max-height: calc(100dvh - 64px); background: #fff; border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; animation: popIn 0.25s ease; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: linear-gradient(135deg, #27AE60, #1e8e3e); color: #fff; }
.modal-header h3 { margin: 0; font-size: 15px; font-weight: 700; }
.close-btn { width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(255,255,255,0.25); color: #fff; font-size: 18px; cursor: pointer; }
.modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; }
.status-row { display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
.current-info { background: #e8f5e9; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; font-size: 13px; line-height: 1.7; }
.max-level { color: #888; font-style: italic; }
.action-card { border: 1.5px solid #c8e6c9; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.action-title { font-size: 15px; font-weight: 700; color: #1e8e3e; }
.action-desc { font-size: 12px; color: #666; margin: 6px 0 10px; }
.btn-build { padding: 8px 20px; background: #27AE60; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-build:disabled { background: #bdbdbd; cursor: not-allowed; }
.demolish-section { margin-top: 10px; }
.demolish-hint { font-size: 12px; color: #E53935; margin-bottom: 8px; }
.btn-demolish { padding: 7px 16px; background: #fff; color: #E53935; border: 1.5px solid #E53935; border-radius: 8px; font-size: 12px; cursor: pointer; }
.confirm-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.btn-confirm-demolish { padding: 6px 14px; background: #E53935; color: #fff; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; }
.modal-footer { padding: 12px 18px; border-top: 1px solid #eee; display: flex; justify-content: center; }
.btn-cancel { padding: 8px 24px; background: #eee; color: #555; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
@keyframes popIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 480px) { .modal { width: calc(100vw - 16px); } }
</style>
