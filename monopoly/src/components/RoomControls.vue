<script setup>
import { computed, ref } from 'vue';
import { t } from '../i18n.js';
const props = defineProps({ room: Object, myId: String, busy: Boolean, rounds: Number });
const emit = defineEmits(['command', 'leave', 'update:rounds']);
const isHost = computed(() => props.room.hostId === props.myId);
const botLevel = ref('normal');
const colors = ['#0e9188', '#df7853', '#7562bf', '#ba922c'];
</script>
<template>
  <div class="lobby-seats">
    <div v-for="(player, index) in room.players" :key="player.id" class="panel lobby-player">
      <span class="player-dot large" :style="{ background: colors[index] }">{{ index + 1 }}</span>
      <h3>{{ player.name }}</h3>
      <p>
        {{ player.isAI ? t(player.difficulty) : player.connected ? t('connected') : t('offline') }}
      </p>
      <span class="badge">{{
        player.id === room.hostId ? t('host') : player.ready ? t('ready') : t('notReady')
      }}</span>
      <button
        v-if="isHost && (player.isAI || !player.connected)"
        class="text-button"
        @click="
          emit('command', player.isAI ? 'removeBot' : 'removePlayer', { playerId: player.id })
        "
        :disabled="busy"
      >
        {{ t('remove') }}
      </button>
    </div>
  </div>
  <div class="lobby-controls panel">
    <button
      v-if="!isHost"
      class="button secondary"
      @click="emit('command', 'ready', { ready: !room.players.find((p) => p.id === myId)?.ready })"
      :disabled="busy"
    >
      {{ t('toggleReady') }}
    </button>
    <template v-if="isHost">
      <select v-if="room.players.length < 4" v-model="botLevel" :aria-label="t('addBot')">
        <option v-for="level in ['easy', 'normal', 'hard']" :value="level" :key="level">
          {{ t(level) }}
        </option>
      </select>
      <button
        v-if="room.players.length < 4"
        class="button secondary"
        @click="emit('command', 'addBot', { difficulty: botLevel })"
        :disabled="busy"
      >
        + {{ t('addBot') }}
      </button>
      <label
        >{{ t('rounds')
        }}<select :value="rounds" @change="emit('update:rounds', Number($event.target.value))">
          <option v-for="count in [10, 20, 40, 60, 100]" :key="count" :value="count">
            {{ count }}
          </option>
        </select></label
      >
      <button
        class="button primary"
        @click="emit('command', 'start', { maxRounds: rounds })"
        :disabled="busy"
      >
        {{ t(room.status === 'finished' ? 'restart' : 'startOnline') }} ↗
      </button>
    </template>
    <button class="text-button danger" @click="emit('leave')">{{ t('leave') }}</button>
  </div>
</template>
