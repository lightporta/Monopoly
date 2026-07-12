<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

// 3×3 pip layout positions (1-indexed reading order)
// 1 2 3
// 4 5 6
// 7 8 9
const PIP_MAP: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}

const dice = computed(() => store.state.lastDice ?? [1, 1])
const animating = computed(() => store.diceAnimating)

function pips(value: number): boolean[] {
  const active = PIP_MAP[value] ?? []
  return Array.from({ length: 9 }, (_, i) => active.includes(i + 1))
}

const total = computed(() => dice.value[0] + dice.value[1])
</script>

<template>
  <div class="dice-widget">
    <div class="dice-pair" :class="{ rolling: animating }">
      <div class="die" v-for="(d, i) in [dice[0], dice[1]]" :key="i">
        <span
          v-for="(on, j) in pips(d)"
          :key="j"
          class="pip"
          :class="{ 'pip--on': on }"
        />
      </div>
    </div>
    <div class="dice-total">
      <span v-if="animating" class="rolling-text">掷骰中…</span>
      <span v-else>合计 <strong>{{ total }}</strong></span>
    </div>
  </div>
</template>

<style scoped>
.dice-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(227, 242, 253, 0.9));
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(30, 136, 229, 0.15);
}

.dice-pair {
  display: flex;
  gap: 14px;
}

.die {
  width: 52px;
  height: 52px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 3px;
  padding: 7px;
  background: linear-gradient(145deg, #ffffff, #f0f0f0);
  border-radius: 10px;
  box-shadow: inset 0 -2px 4px rgba(0, 0, 0, 0.1), 0 3px 8px rgba(0, 0, 0, 0.18);
}

.pip {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: transparent;
  transition: background 0.2s ease;
}

.pip--on {
  background: radial-gradient(circle at 35% 35%, #444, #111);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
}

.dice-pair.rolling .die {
  animation: diceRoll 0.5s linear infinite;
}

.dice-pair.rolling .die:nth-child(2) {
  animation-delay: 0.12s;
}

.dice-pair.rolling .pip--on {
  background: radial-gradient(circle at 35% 35%, #888, #555);
}

.dice-total {
  font-size: 14px;
  color: var(--color-text-secondary);
  letter-spacing: 0.5px;
}

.dice-total strong {
  color: var(--color-ocean);
  font-size: 20px;
  margin-left: 2px;
}

.rolling-text {
  color: var(--color-ocean);
  font-weight: 600;
  font-size: 15px;
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes diceRoll {
  0% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(90deg) scale(1.08); }
  50% { transform: rotate(180deg) scale(1); }
  75% { transform: rotate(270deg) scale(1.08); }
  100% { transform: rotate(360deg) scale(1); }
}
</style>
