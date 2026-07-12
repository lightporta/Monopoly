<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Property } from '@/engine/types'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const store = useGameStore()

const player = computed(() => store.currentPlayer)

const myProps = computed(() => {
  const p = player.value
  if (!p) return []
  return store.properties.filter((prop) => p.properties.includes(prop.id))
})

function levelIcon(level: number): string {
  if (level === 0) return '空地'
  if (level >= 4) return '🏨'
  return '🏠'.repeat(level)
}

function isMortgaged(propId: string): boolean {
  return player.value?.mortgaged.includes(propId) ?? false
}

function buildingLevel(propId: string): number {
  const pid = player.value?.id
  return pid != null ? store.getBuildingLevel(propId, pid) : 0
}

function mortgageValue(prop: Property): number {
  return Math.floor(prop.price * 0.5)
}

function redeemCost(prop: Property): number {
  return Math.floor(prop.price * 0.55)
}

function canBuild(prop: Property): boolean {
  const p = player.value
  if (!p) return false
  return (
    !isMortgaged(prop.id) &&
    buildingLevel(prop.id) < 4 &&
    p.cash >= prop.buildCost
  )
}

function canRedeem(prop: Property): boolean {
  const p = player.value
  if (!p) return false
  return isMortgaged(prop.id) && p.cash >= redeemCost(prop)
}

function colorOf(prop: Property): string {
  return store.getColorGroup(prop.colorGroup)?.color ?? '#1E88E5'
}

function close() {
  emit('update:show', false)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="overlay">
      <div class="modal">
        <div class="header">
          <h2 class="title">资产管理</h2>
          <div class="cash">现金 ¥{{ player?.cash ?? 0 }}</div>
        </div>

        <div v-if="myProps.length === 0" class="empty">
          暂无地产，先去购买一块吧！
        </div>

        <div v-else class="list">
          <div v-for="prop in myProps" :key="prop.id" class="prop-card">
            <div class="prop-bar" :style="{ background: colorOf(prop) }" />
            <div class="prop-body">
              <div class="prop-head">
                <span class="prop-name">{{ prop.name }}</span>
                <span class="prop-level">{{ levelIcon(buildingLevel(prop.id)) }}</span>
              </div>
              <div class="prop-meta">
                建房 ¥{{ prop.buildCost }} · 抵押 ¥{{ mortgageValue(prop) }}
              </div>
              <div v-if="isMortgaged(prop.id)" class="mortgaged-tag">已抵押</div>
              <div class="prop-actions">
                <button
                  class="btn btn-build"
                  :disabled="!canBuild(prop)"
                  @click="store.buildHouse(prop.id)"
                >
                  建房 (¥{{ prop.buildCost }})
                </button>
                <button
                  v-if="!isMortgaged(prop.id)"
                  class="btn btn-mortgage"
                  :disabled="buildingLevel(prop.id) > 0"
                  @click="store.mortgage(prop.id)"
                >
                  抵押
                </button>
                <button
                  v-else
                  class="btn btn-redeem"
                  :disabled="!canRedeem(prop)"
                  @click="store.redeem(prop.id)"
                >
                  赎回 (¥{{ redeemCost(prop) }})
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="footer">
          <button class="btn-close" @click="close">关闭</button>
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

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 12px;
  border-bottom: 1px solid #eee;
}

.title { font-size: 18px; font-weight: 700; color: #212121; }
.cash { font-size: 14px; font-weight: 600; color: #1E88E5; }

.empty { padding: 32px 22px; text-align: center; color: #9e9e9e; }

.list {
  padding: 12px 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prop-card {
  display: flex;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;
}

.prop-bar { width: 6px; flex-shrink: 0; }

.prop-body { flex: 1; padding: 10px 12px; position: relative; }

.prop-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.prop-name { font-size: 15px; font-weight: 600; color: #212121; }
.prop-level { font-size: 16px; }

.prop-meta { font-size: 12px; color: #9e9e9e; margin-top: 2px; }

.mortgaged-tag {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  color: #fff;
  background: #E53935;
  padding: 1px 8px;
  border-radius: 9999px;
}

.prop-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.btn:hover:not(:disabled) { transform: translateY(-1px); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-build { background: #1E88E5; color: #fff; }
.btn-mortgage { background: #fff; color: #E53935; border: 1.5px solid #E53935; }
.btn-redeem { background: #43A047; color: #fff; }

.footer { padding: 12px 22px 18px; border-top: 1px solid #eee; }

.btn-close {
  width: 100%;
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

.btn-close:hover { background: #e0e0e0; }

@keyframes popIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
