<script setup>
import { BOARD, PROPERTIES, GROUPS } from '../../../shared/index.js';
import { label, money, t } from '../i18n.js';
defineProps({ game: Object, selected: Number });
defineEmits(['select']);
const colors = ['#0e9188', '#df7853', '#7562bf', '#ba922c'];
const icons = { start: '⚓', chance: '?', destiny: '✦', teleport: '↗', bonus: '◈', rest: '☾' };
function position(index) {
  if (index <= 9) return { gridColumn: index + 1, gridRow: 1 };
  if (index <= 18) return { gridColumn: 10, gridRow: index - 8 };
  if (index <= 27) return { gridColumn: 28 - index, gridRow: 10 };
  return { gridColumn: 1, gridRow: 37 - index };
}
const property = (cell) => PROPERTIES.find((p) => p.id === cell.propertyId);
</script>

<template>
  <div class="board" :aria-label="t('subtitle')">
    <div class="board-sea">
      <div class="sea-orbit orbit-one"></div>
      <div class="sea-orbit orbit-two"></div>
      <span class="sea-caption">YANTAI · 37°N 121°E</span>
      <div class="compass">✳</div>
      <h2>{{ t('title') }}</h2>
      <p>{{ t('tagline') }}</p>
      <div class="sea-wave">∿ ∿ ∿</div>
      <span class="sea-caption bottom-caption">{{ t('selectCell') }}</span>
    </div>
    <button
      v-for="cell in BOARD"
      :key="cell.index"
      class="board-cell"
      :class="{
        selected: selected === cell.index,
        occupied: game.players.some((p) => !p.bankrupt && p.position === cell.index),
      }"
      :style="{
        ...position(cell.index),
        '--group-color': property(cell) ? GROUPS[property(cell).group].color : 'transparent',
      }"
      @click="$emit('select', cell.index)"
      :aria-label="`${cell.index + 1}. ${label(cell.name)}`"
      :aria-pressed="selected === cell.index"
    >
      <span class="cell-number">{{ String(cell.index + 1).padStart(2, '0') }}</span>
      <span v-if="!cell.propertyId" class="cell-icon">{{ icons[cell.type] }}</span>
      <span class="cell-name">{{ label(cell.name) }}</span>
      <span v-if="cell.propertyId" class="cell-price">{{ money(property(cell).price) }}</span>
      <span
        v-if="cell.propertyId && game.properties[cell.propertyId].ownerId"
        class="owner-line"
        :style="{
          background:
            colors[
              game.players.findIndex((p) => p.id === game.properties[cell.propertyId].ownerId)
            ],
        }"
      >
        {{
          game.properties[cell.propertyId].mortgaged
            ? '⊘'
            : '▰'.repeat(game.properties[cell.propertyId].level) ||
              (game.properties[cell.propertyId].aquaculture
                ? '≈'.repeat(game.properties[cell.propertyId].aquaculture)
                : '•')
        }}
      </span>
      <span class="tokens"
        ><span
          v-for="(player, index) in game.players.filter(
            (p) => !p.bankrupt && p.position === cell.index,
          )"
          :key="player.id"
          class="token"
          :style="{
            background: colors[game.players.findIndex((p) => p.id === player.id)],
            zIndex: index + 1,
          }"
          :title="player.name"
          >{{ game.players.findIndex((p) => p.id === player.id) + 1 }}</span
        ></span
      >
    </button>
  </div>
</template>
