<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Property } from '@/engine/types'

const store = useGameStore()

const visible = computed(() => {
  const t = store.pendingModal?.type
  return t === 'teleportAnyEmpty' || t === 'moveAnyCell'
})

const mode = computed(() => store.pendingModal?.type ?? '')

const title = computed(() =>
  mode.value === 'teleportAnyEmpty' ? '选择一处空地传送' : '选择目标格子移动'
)

const emptyProps = computed(() => store.getEmptyProperties())

function cellIndexOfProp(propId: string): number {
  const cell = store.board.find((c) => c.propertyRef === propId)
  return cell?.index ?? -1
}

function colorOf(prop: Property): string {
  return store.getColorGroup(prop.colorGroup)?.color ?? '#1E88E5'
}

function canAffordProp(prop: Property): boolean {
  const p = store.currentPlayer
  return p != null && p.cash >= prop.price
}

function selectEmpty(prop: Property) {
  if (!canAffordProp(prop)) return
  const idx = cellIndexOfProp(prop.id)
  if (idx >= 0) store.teleportTo(idx)
}

function selectCell(idx: number) {
  store.teleportTo(idx)
}

function cancel() {
  store.endTurn()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="overlay">
      <div class="modal">
        <h2 class="title">{{ title }}</h2>

        <!-- 空地列表 -->
        <div v-if="mode === 'teleportAnyEmpty'" class="empty-list">
          <div
            v-for="prop in emptyProps"
            :key="prop.id"
            :class="['empty-item', { disabled: !canAffordProp(prop) }]"
            @click="selectEmpty(prop)"
          >
            <div class="item-bar" :style="{ background: colorOf(prop) }" />
            <div class="item-body">
              <div class="item-name">{{ prop.name }}</div>
              <div class="item-price">¥{{ prop.price }}</div>
            </div>
            <div v-if="!canAffordProp(prop)" class="item-tag">资金不足</div>
          </div>
          <div v-if="emptyProps.length === 0" class="empty-hint">暂无空地</div>
        </div>

        <!-- 全格子网格 -->
        <div v-else class="cell-grid">
          <button
            v-for="cell in store.board"
            :key="cell.index"
            class="cell-btn"
            @click="selectCell(cell.index)"
          >
            <span class="cell-icon">{{ cell.icon ?? '·' }}</span>
            <span class="cell-name">{{ cell.name }}</span>
            <span class="cell-idx">#{{ cell.index }}</span>
          </button>
        </div>

        <button class="btn-cancel" @click="cancel">取消</button>
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
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  width: 380px;
  max-height: 85vh;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  animation: popIn 0.3s ease;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #212121;
  text-align: center;
  padding: 18px 22px 12px;
}

.empty-list {
  padding: 4px 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-item {
  display: flex;
  align-items: center;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.empty-item:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30, 136, 229, 0.2);
}

.empty-item.disabled { opacity: 0.5; cursor: not-allowed; }

.item-bar { width: 6px; align-self: stretch; }

.item-body {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-name { font-size: 15px; font-weight: 600; color: #212121; }
.item-price { font-size: 14px; font-weight: 600; color: #1E88E5; }

.item-tag {
  font-size: 11px;
  color: #fff;
  background: #E53935;
  padding: 2px 8px;
  border-radius: 9999px;
  margin-right: 10px;
}

.empty-hint { padding: 16px; text-align: center; color: #9e9e9e; }

.cell-grid {
  padding: 4px 16px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.cell-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  background: #fafafa;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, background 0.15s;
}

.cell-btn:hover {
  transform: translateY(-2px);
  border-color: #1E88E5;
  background: #E3F2FD;
}

.cell-icon { font-size: 20px; }
.cell-name { font-size: 11px; color: #424242; text-align: center; line-height: 1.2; }
.cell-idx { font-size: 10px; color: #9e9e9e; }

.btn-cancel {
  margin: 14px 22px 18px;
  padding: 11px 0;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  background: #f5f5f5;
  color: #616161;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-cancel:hover { background: #e0e0e0; }

@keyframes popIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
