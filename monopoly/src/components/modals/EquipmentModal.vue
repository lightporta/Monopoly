<script setup lang="ts">
// 海工装备购买弹窗：在「我的资产」面板点击装备供应点地产的「购买装备卡」按钮时弹出。
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

// 当前选中的装备（由 activeEquipmentPropertyId 反查）
const equipment = computed(() => {
  const propId = store.activeEquipmentPropertyId
  if (!propId) return null
  const cell = store.board.find((c) => c.propertyRef === propId)
  if (!cell) return null
  return store.equipmentList.find((e) => e.soldAtCell === cell.index) ?? null
})

const isSold = computed(() => (equipment.value ? store.isEquipmentSold(equipment.value.id) : false))

// 装配目标候选：玩家拥有的、与装备色块匹配的地产
const bindTargets = computed(() => {
  if (!equipment.value || equipment.value.effect.type !== 'rentBoost') return []
  const targetColorGroup = equipment.value.effect.colorGroup
  const player = store.currentPlayer
  if (!player) return []
  return store.properties
    .filter((p) => p.colorGroup === targetColorGroup)
    .filter((p) => player.properties.includes(p.id))
})

const selectedTarget = ref<string | null>(null)

import { ref, watch } from 'vue'
watch(() => props.show, (v) => {
  if (v) selectedTarget.value = null
})

const playerCash = computed(() => store.currentPlayer?.cash ?? 0)
const canAfford = computed(() => equipment.value ? playerCash.value >= equipment.value.price : false)
const needTarget = computed(() => equipment.value?.effect.type === 'rentBoost')

function close() {
  emit('update:show', false)
}

function confirmBuy() {
  if (!equipment.value || isSold.value) return
  if (!canAfford.value) return
  if (needTarget.value && !selectedTarget.value) return
  const propId = store.activeEquipmentPropertyId
  if (!propId) return
  store.buyEquipment(equipment.value.id, propId, selectedTarget.value)
  close()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show && equipment" class="overlay" @click.self="close">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ equipment.icon }} 购买装备卡 — {{ store.board.find(c => c.index === equipment!.soldAtCell)?.name }}</h3>
          <button class="close-btn" @click="close" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <div class="equip-info">
            <div class="equip-name">{{ equipment.icon }} {{ equipment.name }}</div>
            <div class="equip-price">售价：{{ equipment.price }} 元 | 你的现金：{{ playerCash }} 元</div>
            <div class="equip-desc">{{ equipment.description }}</div>
          </div>

          <div v-if="isSold" class="sold-notice">⚠️ 该装备已被购买</div>

          <div v-else-if="needTarget" class="target-section">
            <div class="section-title">选择装配地产（仅显示你拥有的同色块地产）：</div>
            <div v-if="bindTargets.length === 0" class="empty-hint">你没有可装配的地产（需拥有海岸线/仙山色块地产）</div>
            <div v-else class="target-list">
              <label
                v-for="t in bindTargets"
                :key="t.id"
                class="target-item"
                :class="{ active: selectedTarget === t.id }"
              >
                <input type="radio" :value="t.id" v-model="selectedTarget" />
                <span>{{ t.name }}</span>
              </label>
            </div>
          </div>

          <div v-else class="global-hint">该装备全局生效，无需选择目标地产。</div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="close">取消</button>
          <button
            v-if="!isSold"
            class="btn-confirm"
            :disabled="!canAfford || (needTarget && !selectedTarget)"
            @click="confirmBuy"
          >
            {{ canAfford ? '确认购买' : '资金不足' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  backdrop-filter: blur(4px);
}
.modal {
  width: 440px;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 64px);
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popIn 0.25s ease;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, #1E88E5, #1565c0);
  color: #fff;
}
.modal-header h3 { margin: 0; font-size: 15px; font-weight: 700; }
.close-btn {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.25); color: #fff; font-size: 18px; cursor: pointer;
}
.modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; }
.equip-info { background: #f5f9ff; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.equip-name { font-size: 16px; font-weight: 700; color: #1565c0; }
.equip-price { font-size: 13px; color: #555; margin-top: 4px; }
.equip-desc { font-size: 12px; color: #777; margin-top: 6px; line-height: 1.5; }
.sold-notice { text-align: center; color: #E53935; font-weight: 600; padding: 12px; }
.section-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #333; }
.target-list { display: flex; flex-direction: column; gap: 6px; }
.target-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border: 1.5px solid #e0e0e0; border-radius: 8px;
  cursor: pointer; font-size: 13px; transition: all 0.15s;
}
.target-item.active { border-color: #1E88E5; background: #e3f2fd; }
.target-item input { accent-color: #1E88E5; }
.global-hint { font-size: 13px; color: #666; padding: 8px 0; }
.empty-hint { font-size: 12px; color: #E53935; }
.modal-footer { padding: 12px 18px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; }
.btn-cancel, .btn-confirm { padding: 9px 22px; font-size: 14px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; }
.btn-cancel { background: #eee; color: #555; }
.btn-confirm { background: #1E88E5; color: #fff; }
.btn-confirm:disabled { background: #bdbdbd; cursor: not-allowed; }
@keyframes popIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 480px) {
  .modal { width: calc(100vw - 16px); }
  .modal-header h3 { font-size: 14px; }
}
</style>
