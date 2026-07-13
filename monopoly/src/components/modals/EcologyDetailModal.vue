<script setup lang="ts">
// 生态指数详情弹窗（点击 TopBar 生态徽章时弹出）
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const index = computed(() => store.ecologyIndex)
const tier = computed(() => store.ecologyStatus)

function close() {
  emit('update:show', false)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="overlay" @click.self="close">
      <div class="modal">
        <div class="modal-header" :style="{ background: `linear-gradient(135deg, ${tier.color}, ${tier.color}dd)` }">
          <h3>🌿 海洋生态指数</h3>
          <button class="close-btn" @click="close" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <div class="index-display">
            <div class="index-number" :style="{ color: tier.color }">{{ index }}</div>
            <div class="index-status" :style="{ background: tier.color }">{{ tier.label }}</div>
          </div>

          <div class="bar-container">
            <div class="bar-fill" :style="{ width: `${index}%`, background: tier.color }" />
          </div>

          <div class="effects">
            <div class="effect-title">当前全局效果：</div>
            <ul>
              <li v-if="tier.subsidyPerTurn > 0">环保补贴：每回合 +{{ tier.subsidyPerTurn }} 元</li>
              <li v-if="tier.aquaculturePenalty > 0">养殖场收益 -{{ Math.round(tier.aquaculturePenalty * 100) }}%</li>
              <li v-if="tier.nuclearDividendPenalty < 1">核电分红 -{{ Math.round((1 - tier.nuclearDividendPenalty) * 100) }}%</li>
              <li v-if="tier.subsidyPerTurn === 0 && tier.aquaculturePenalty === 0 && tier.nuclearDividendPenalty === 1" class="neutral">无加成无减益</li>
            </ul>
          </div>

          <div class="rules">
            <div class="rule-title">指数规则：</div>
            <ul>
              <li>初始值 50，范围 0~100</li>
              <li>每抽 1 张正面生态卡 +5，负面生态卡 -5</li>
              <li>每 5 回合未抽到生态卡，自然恢复 +2</li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ok" @click="close">我已知晓</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1100; backdrop-filter: blur(4px); }
.modal { width: 400px; max-width: calc(100vw - 32px); background: #fff; border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; animation: popIn 0.25s ease; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; color: #fff; }
.modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.close-btn { width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(255,255,255,0.25); color: #fff; font-size: 18px; cursor: pointer; }
.modal-body { padding: 18px; }
.index-display { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.index-number { font-size: 42px; font-weight: 800; line-height: 1; }
.index-status { color: #fff; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 12px; }
.bar-container { width: 100%; height: 12px; background: #e0e0e0; border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
.bar-fill { height: 100%; border-radius: 6px; transition: width 0.4s ease, background 0.4s ease; }
.effects, .rules { margin-bottom: 12px; }
.effect-title, .rule-title { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 4px; }
ul { margin: 0; padding-left: 18px; }
li { font-size: 12px; color: #555; line-height: 1.8; }
li.neutral { color: #888; }
.modal-footer { padding: 12px 18px 16px; border-top: 1px solid #eee; display: flex; justify-content: center; }
.btn-ok { padding: 8px 32px; background: #43A047; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
@keyframes popIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 480px) { .modal { width: calc(100vw - 16px); } }
</style>
