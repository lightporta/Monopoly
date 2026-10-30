<script setup>
import { computed } from 'vue';
import { BOARD, PROPERTIES, GROUPS, RULES, getRent } from '../../../shared/index.js';
import { t, label, money } from '../i18n.js';
const props = defineProps({ game: Object, selected: Number, legal: Array, busy: Boolean });
defineEmits(['action']);
const cell = computed(() => BOARD[props.selected ?? 0]);
const property = computed(() => PROPERTIES.find((p) => p.id === cell.value.propertyId));
const asset = computed(() => (property.value ? props.game.properties[property.value.id] : null));
const actions = computed(() =>
  props.legal.filter((a) => a.propertyId === property.value?.id && !['buy'].includes(a.type)),
);
function cost(action) {
  if (action.type === 'build') return money(property.value.buildCost);
  if (action.type === 'equip') return money(RULES.equipmentCost);
  if (action.type === 'aquaculture') return money(RULES.aquacultureCost);
  if (action.type === 'redeem')
    return money(
      Math.ceil(
        (property.value.price * RULES.mortgageRatio * Math.round(RULES.redeemMultiplier * 100)) /
          100,
      ),
    );
  if (action.type === 'mortgage')
    return `+${money(Math.floor(property.value.price * RULES.mortgageRatio))}`;
  if (action.type === 'sellBuilding')
    return `+${money(Math.floor((asset.value.level ? property.value.buildCost : asset.value.aquaculture ? RULES.aquacultureCost : RULES.equipmentCost) * RULES.buildingSaleRatio))}`;
  return '';
}
</script>
<template>
  <section class="panel property-panel">
    <p class="eyebrow">{{ t('selected') }} · {{ String(cell.index + 1).padStart(2, '0') }}</p>
    <h3>{{ label(cell.name) }}</h3>
    <template v-if="property">
      <p class="group-label">
        <i :style="{ background: GROUPS[property.group].color }"></i
        >{{ label(GROUPS[property.group].name) }}
      </p>
      <dl class="property-stats">
        <div>
          <dt>{{ t('price') }}</dt>
          <dd>{{ money(property.price) }}</dd>
        </div>
        <div>
          <dt>{{ t('rent') }}</dt>
          <dd>{{ money(getRent(game, property.id)) }}</dd>
        </div>
        <div>
          <dt>{{ t('owner') }}</dt>
          <dd>{{ game.players.find((p) => p.id === asset.ownerId)?.name ?? t('unowned') }}</dd>
        </div>
        <div>
          <dt>{{ t('level') }} / {{ t('aquaLevel') }}</dt>
          <dd>{{ asset.level }} / {{ asset.aquaculture }}</dd>
        </div>
      </dl>
      <p v-if="asset.equipped || asset.mortgaged" class="muted">
        {{ asset.mortgaged ? t('mortgaged') : t('equipped') }}
      </p>
      <div class="asset-actions">
        <button
          v-for="action in actions"
          :key="action.type"
          class="button small secondary"
          :disabled="busy"
          @click="$emit('action', action)"
        >
          {{ t(action.type) }} <span>{{ cost(action) }}</span>
        </button>
      </div>
    </template>
    <p v-else class="muted">
      {{
        cell.type === 'teleport'
          ? `↗ ${label(BOARD[cell.target].name)}`
          : cell.type === 'start'
            ? `${t('cash')} +${money(RULES.passReward)}`
            : cell.type === 'bonus'
              ? '+¥300'
              : cell.type === 'rest'
                ? t('skip')
                : t('rules')
      }}
    </p>
  </section>
</template>
