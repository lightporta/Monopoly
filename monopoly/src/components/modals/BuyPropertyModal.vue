<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const visible = computed(() => store.pendingModal?.type === 'buyProperty')

const property = computed(() => {
  const id = store.pendingModal?.propertyId
  if (!id) return null
  return store.properties.find((p) => p.id === id) ?? null
})

const colorGroup = computed(() => {
  const gid = property.value?.colorGroup
  return gid ? store.getColorGroup(gid) : undefined
})

const canAfford = computed(() => {
  const p = store.currentPlayer
  return p != null && property.value != null && p.cash >= property.value.price
})

const rentRows = computed(() => {
  const r = property.value?.rentByLevel
  if (!r) return []
  return [
    { label: '空地', rent: r.empty },
    { label: '1 房', rent: r.house1 },
    { label: '2 房', rent: r.house2 },
    { label: '3 房', rent: r.house3 },
    { label: '旅馆', rent: r.hotel },
  ]
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible && property" class="overlay">
      <div class="modal">
        <div class="accent" :style="{ background: colorGroup?.color ?? '#1E88E5' }" />
        <div class="header">
          <h2 class="title">{{ property.name }}</h2>
          <span class="group-tag" :style="{ background: colorGroup?.color ?? '#1E88E5' }">
            {{ colorGroup?.name ?? '' }}
          </span>
        </div>

        <div class="price-row">
          <span class="price-label">购买价</span>
          <span class="price-value">¥{{ property.price }}</span>
        </div>
        <div class="price-row sub">
          <span class="price-label">基础租金</span>
          <span class="rent-value">¥{{ property.baseRent }}</span>
        </div>

        <table class="rent-table">
          <thead>
            <tr><th>建筑等级</th><th>租金</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in rentRows" :key="row.label">
              <td>{{ row.label }}</td>
              <td>¥{{ row.rent }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="!canAfford" class="warn">现金不足，无法购买</div>

        <div class="actions">
          <button class="btn btn-buy" :disabled="!canAfford" @click="store.buyProperty()">
            购买 (¥{{ property.price }})
          </button>
          <button class="btn btn-decline" @click="store.declineBuy()">放弃</button>
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
  width: 340px;
  background: #fff;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  animation: popIn 0.3s ease;
}

.accent { height: 8px; }

.header {
  padding: 18px 22px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.title { font-size: 20px; font-weight: 700; color: #212121; }

.group-tag {
  color: #fff;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 9999px;
  white-space: nowrap;
}

.price-row {
  padding: 4px 22px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.price-row.sub { padding-top: 0; }

.price-label { font-size: 14px; color: #616161; }

.price-value { font-size: 26px; font-weight: 700; color: #1E88E5; }

.rent-value { font-size: 18px; font-weight: 600; color: #43A047; }

.rent-table {
  width: calc(100% - 44px);
  margin: 12px 22px;
  border-collapse: collapse;
  font-size: 14px;
}

.rent-table th,
.rent-table td {
  padding: 7px 10px;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.rent-table th { color: #616161; font-weight: 600; }
.rent-table td:last-child { color: #1E88E5; font-weight: 600; }

.warn {
  margin: 0 22px 8px;
  color: #E53935;
  font-size: 13px;
  text-align: center;
}

.actions {
  display: flex;
  gap: 12px;
  padding: 8px 22px 22px;
}

.btn {
  flex: 1;
  padding: 11px 0;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}

.btn:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-buy { background: #1E88E5; color: #fff; }
.btn-buy:hover:not(:disabled) { background: #1565C0; }

.btn-decline { background: #fff; color: #1E88E5; border: 2px solid #1E88E5; }

@keyframes popIn {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 767px) {
  .modal {
    width: calc(100vw - 24px);
    max-height: calc(100dvh - 40px);
    border-radius: 16px;
  }

  .accent { height: 6px; }

  .header {
    padding: 14px 16px 6px;
  }

  .title { font-size: 16px; }

  .group-tag {
    font-size: 11px;
    padding: 2px 8px;
  }

  .price-row {
    padding: 4px 16px;
  }

  .price-label { font-size: 13px; }

  .price-value { font-size: 22px; }

  .rent-value { font-size: 15px; }

  .rent-table {
    width: calc(100% - 32px);
    margin: 10px 16px;
    font-size: 13px;
  }

  .rent-table th,
  .rent-table td {
    padding: 6px 8px;
  }

  .warn {
    margin: 0 16px 6px;
    font-size: 12px;
  }

  .actions {
    padding: 6px 16px 16px;
  }

  .btn {
    font-size: 14px;
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal {
    animation: none;
  }

  .fade-enter-active, .fade-leave-active { transition: none; }
}
</style>
