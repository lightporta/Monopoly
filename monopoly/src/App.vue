<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import {
  BOARD,
  PROPERTIES,
  GROUPS,
  RULES,
  createGame,
  applyAction,
  chooseAIAction,
  getLegalActions,
  getNetWorth,
} from '../../shared/index.js';
import { t, label, money, locale, formatLog, readStorage, writeStorage } from './i18n.js';
import { OnlineClient } from './online/client.js';
import GameBoard from './components/GameBoard.vue';
import PropertyPanel from './components/PropertyPanel.vue';
import RoomControls from './components/RoomControls.vue';

const saveKey = 'monopoly-local-v4';
const page = ref('home');
const tab = ref('local');
const localGame = ref(null);
const snapshot = ref(null);
const onlineStatus = ref('offline');
const busy = ref(false);
const errorCode = ref('');
const rulesOpen = ref(false);
const confirmation = ref(null);
const selected = ref(0);
const name = ref(readStorage(localStorage, 'monopoly-name') || '');
const code = ref('');
const seed = ref('');
const rounds = ref(40);
const copied = ref(false);
const handoff = ref(false);
const dialogOpen = computed(() => rulesOpen.value || Boolean(confirmation.value) || handoff.value);
let previousFocus;
watch(dialogOpen, async (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) {
    previousFocus = document.activeElement;
    await nextTick();
    document.querySelector('.modal')?.focus();
  } else if (previousFocus?.isConnected) previousFocus.focus();
});
function dialogKey(event) {
  if (event.key === 'Escape' && !handoff.value) {
    rulesOpen.value = false;
    confirmation.value = null;
  }
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget;
  const controls = [
    ...dialog.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]'),
  ];
  if (!controls.length) {
    event.preventDefault();
    return;
  }
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && [first, dialog].includes(document.activeElement)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && [last, dialog].includes(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}
const now = ref(Date.now());
const session = ref(null);
const setupPlayers = ref([
  { name: '', type: 'human' },
  { name: '', type: 'normal' },
]);
let savedGame;
try {
  const candidate = JSON.parse(readStorage(localStorage, saveKey));
  if (
    candidate?.version === 4 &&
    candidate.players?.length >= 2 &&
    candidate.properties &&
    candidate.rngState &&
    candidate.status === 'playing'
  ) {
    getLegalActions(candidate, candidate.currentPlayerId);
    savedGame = candidate;
  }
} catch {
  /* Ignore incomplete or incompatible local saves. */
}
const hasSave = ref(Boolean(savedGame));
const client = new OnlineClient({
  onSnapshot: (value) => {
    snapshot.value = value;
    if (value) page.value = 'online';
    else if (page.value === 'online') page.value = 'home';
  },
  onStatus: (value) => {
    onlineStatus.value = value;
  },
  onSession: (value) => {
    session.value = value;
  },
  onError: (cause) => {
    errorCode.value = cause.code || 'genericError';
  },
});
session.value = client.session;
const online = computed(() => page.value === 'online');
const game = computed(() =>
  online.value ? snapshot.value?.game : page.value === 'local' ? localGame.value : null,
);
const room = computed(() => snapshot.value?.room);
const myId = computed(() => (online.value ? session.value?.playerId : game.value?.currentPlayerId));
const me = computed(() => game.value?.players.find((p) => p.id === myId.value));
const active = computed(() => game.value?.players.find((p) => p.id === game.value.currentPlayerId));
const ownTurn = computed(
  () => game.value?.status === 'playing' && active.value?.id === myId.value && !active.value?.isAI,
);
const available = computed(() =>
  game.value &&
  ownTurn.value &&
  !handoff.value &&
  (!online.value || onlineStatus.value === 'connected')
    ? getLegalActions(game.value, myId.value)
    : [],
);
const mainActions = computed(() =>
  available.value.filter((a) => ['roll', 'buy', 'decline', 'endTurn'].includes(a.type)),
);
const ownProperties = computed(() =>
  PROPERTIES.filter((p) => game.value?.properties[p.id].ownerId === myId.value),
);
const ranked = computed(() =>
  game.value
    ? [...game.value.players].sort(
        (a, b) => getNetWorth(game.value, b.id) - getNetWorth(game.value, a.id),
      )
    : [],
);
const remaining = computed(() =>
  Math.max(0, Math.ceil(((room.value?.turnDeadline ?? now.value) - now.value) / 1000)),
);
const colors = ['#0e9188', '#df7853', '#7562bf', '#ba922c'];
let aiTimer;
let errorTimer;
const clockTimer = setInterval(() => {
  now.value = Date.now();
}, 1000);
watch(errorCode, () => {
  clearTimeout(errorTimer);
  if (errorCode.value)
    errorTimer = setTimeout(() => {
      errorCode.value = '';
    }, 9000);
});
watch(localGame, (value) => {
  if (!value) return;
  writeStorage(localStorage, saveKey, JSON.stringify(value));
  hasSave.value = value.status === 'playing';
  savedGame = value;
});
watch(
  () => [page.value, localGame.value?.revision, handoff.value],
  () => {
    clearTimeout(aiTimer);
    const state = localGame.value;
    if (page.value !== 'local' || !state || state.status !== 'playing' || handoff.value) return;
    const player = state.players.find((p) => p.id === state.currentPlayerId);
    if (player.isAI)
      aiTimer = setTimeout(() => {
        try {
          localGame.value = applyAction(state, player.id, chooseAIAction(state, player.id));
        } catch (cause) {
          errorCode.value = cause.code;
        }
      }, 450);
  },
);
watch(
  () => game.value?.currentPlayerId,
  (id, previous) => {
    if (!game.value) return;
    const player = game.value.players.find((p) => p.id === id);
    selected.value = player?.position ?? 0;
    if (
      !online.value &&
      id !== previous &&
      previous &&
      game.value.status === 'playing' &&
      !player?.isAI &&
      game.value.players.filter((p) => !p.isAI).length > 1
    )
      handoff.value = true;
  },
);
watch(
  () => game.value?.revision,
  () => {
    if (game.value?.pendingPropertyId)
      selected.value =
        PROPERTIES.find((p) => p.id === game.value.pendingPropertyId)?.cellIndex ?? selected.value;
    else if (game.value?.log.at(-1)?.type === 'landed')
      selected.value = active.value?.position ?? 0;
  },
);
watch(
  () => active.value?.position,
  (position) => {
    if (position !== undefined) selected.value = position;
  },
);
function startLocal(resume = false) {
  handoff.value = false;
  try {
    localGame.value = resume
      ? savedGame
      : createGame({
          players: setupPlayers.value.map((p, i) => ({
            id: `local-${i}`,
            name:
              p.name.trim() || (locale.value === 'zh' ? `旅行者 ${i + 1}` : `Traveler ${i + 1}`),
            isAI: p.type !== 'human',
            difficulty: p.type === 'human' ? 'normal' : p.type,
          })),
          seed:
            seed.value.trim() ||
            (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
          maxRounds: Number(rounds.value),
        });
    page.value = 'local';
    selected.value = active.value?.position ?? 0;
  } catch (cause) {
    errorCode.value = cause.code || 'genericError';
  }
}
async function run(operation) {
  if (busy.value) return;
  busy.value = true;
  errorCode.value = '';
  try {
    await operation();
  } catch (cause) {
    errorCode.value = cause.code || 'genericError';
  } finally {
    busy.value = false;
  }
}
function enter(type) {
  if (!name.value.trim()) {
    errorCode.value = 'INVALID_NAME';
    return;
  }
  writeStorage(localStorage, 'monopoly-name', name.value.trim());
  run(() =>
    client.enter(type, {
      name: name.value.trim(),
      ...(type === 'join' ? { code: code.value.trim().toUpperCase() } : {}),
    }),
  );
}
function command(type, payload = {}) {
  return run(() => client.request(type, payload));
}
function act(action) {
  if (!ownTurn.value || handoff.value) return;
  if (online.value) command('action', { revision: game.value.revision, action });
  else {
    try {
      localGame.value = applyAction(localGame.value, myId.value, action);
    } catch (cause) {
      errorCode.value = cause.code || 'genericError';
    }
  }
}
function leave() {
  confirmation.value = onlineStatus.value === 'connected' ? 'leave' : 'forget';
}
function confirm() {
  const task = confirmation.value;
  confirmation.value = null;
  if (task === 'leave') run(() => client.leave());
  if (task === 'forget') {
    client.save(null);
    client.close();
    snapshot.value = null;
    page.value = 'home';
  }
  if (task === 'surrender') act({ type: 'surrender' });
}
async function copyCode() {
  try {
    await navigator.clipboard.writeText(room.value.code);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch {
    errorCode.value = 'genericError';
  }
}
onMounted(() => {
  if (client.session) run(() => client.restore());
});
onUnmounted(() => {
  clearTimeout(aiTimer);
  clearTimeout(errorTimer);
  clearInterval(clockTimer);
  client.close();
});
</script>

<template>
  <div class="app-shell">
    <header class="site-header" :inert="dialogOpen">
      <button class="brand" @click="page === 'online' ? leave() : (page = 'home')">
        <span class="brand-mark">✳</span
        ><span
          >{{ t('title') }}<small>{{ t('subtitle') }}</small></span
        >
      </button>
      <div class="header-actions">
        <span v-if="online" class="connection" :class="onlineStatus"
          ><i></i>{{ t(onlineStatus) }}</span
        ><button class="text-button" @click="rulesOpen = true">{{ t('rules') }}</button
        ><button
          class="language-button"
          @click="locale = locale === 'zh' ? 'en' : 'zh'"
          aria-label="Switch language"
        >
          {{ locale === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
    </header>
    <div v-if="errorCode" class="toast" role="alert">
      <span>{{ t(errorCode) }}</span
      ><button @click="errorCode = ''" :aria-label="t('close')">×</button>
    </div>

    <main :inert="dialogOpen" v-if="page === 'home'" class="home-layout">
      <section class="home-hero">
        <p class="eyebrow">A COAST WORTH EXPLORING</p>
        <h1>{{ t('tagline') }}</h1>
        <p class="hero-description">{{ t('introduction') }}</p>
        <div class="coast-art" aria-hidden="true">
          <div class="sun"></div>
          <div class="lighthouse">
            <div class="light-beam"></div>
            <div class="lamp"></div>
            <div class="tower"></div>
          </div>
          <div class="land land-one"></div>
          <div class="land land-two"></div>
          <div class="art-wave wave-one"></div>
          <div class="art-wave wave-two"></div>
          <span class="art-coordinate">37°32′ N &nbsp; 121°23′ E</span
          ><span class="art-number"
            >36<span>STOPS<br />ONE COAST</span></span
          >
        </div>
        <div class="hero-foot">
          <span>02 — 04 {{ t('players') }}</span
          ><span>YANTAI, CHINA</span>
        </div>
      </section>
      <section class="setup-panel panel">
        <div class="mode-tabs" role="tablist">
          <button
            role="tab"
            :aria-selected="tab === 'local'"
            :class="{ active: tab === 'local' }"
            @click="tab = 'local'"
          >
            {{ t('local') }}</button
          ><button
            role="tab"
            :aria-selected="tab === 'online'"
            :class="{ active: tab === 'online' }"
            @click="tab = 'online'"
          >
            {{ t('online') }}
          </button>
        </div>
        <template v-if="tab === 'local'">
          <h2>{{ t('local') }}</h2>
          <p class="muted">{{ t('localNote') }}</p>
          <div class="setup-players">
            <div v-for="(player, index) in setupPlayers" :key="index" class="setup-player">
              <span class="player-dot" :style="{ background: colors[index] }">{{ index + 1 }}</span
              ><input
                v-model="player.name"
                :aria-label="`${t('name')} ${index + 1}`"
                :placeholder="`${t('human')} ${index + 1}`"
                maxlength="20"
              /><select v-model="player.type" :aria-label="`${t('players')} ${index + 1}`">
                <option value="human">{{ t('human') }}</option>
                <option v-for="level in ['easy', 'normal', 'hard']" :key="level" :value="level">
                  {{ t(level) }}
                </option></select
              ><button
                v-if="setupPlayers.length > 2"
                class="icon-button"
                @click="setupPlayers.splice(index, 1)"
                :aria-label="t('remove')"
              >
                ×
              </button>
            </div>
          </div>
          <button
            v-if="setupPlayers.length < 4"
            class="text-button add-player"
            @click="setupPlayers.push({ name: '', type: 'normal' })"
          >
            + {{ t('add') }}
          </button>
          <div class="form-grid">
            <label
              >{{ t('rounds')
              }}<select v-model.number="rounds">
                <option v-for="count in [10, 20, 40, 60, 100]" :key="count" :value="count">
                  {{ count }}
                </option>
              </select></label
            ><label
              >{{ t('seed') }}<input v-model="seed" placeholder="Yantai 2026" maxlength="100"
            /></label>
          </div>
          <p class="microcopy">{{ t('seedNote') }}</p>
          <button class="button primary full" @click="startLocal()" data-testid="start-local">
            {{ t('start') }} <span>↗</span>
          </button>
          <button v-if="hasSave" class="button secondary full" @click="startLocal(true)">
            {{ t('continue') }}
          </button>
          <p class="microcopy centered">{{ t('offlineSaved') }}</p>
        </template>
        <template v-else>
          <h2>{{ t('online') }}</h2>
          <p class="muted">{{ t('onlineNote') }}</p>
          <label
            >{{ t('name') }}<input v-model="name" maxlength="20" autocomplete="nickname"
          /></label>
          <button class="button primary full" :disabled="busy" @click="enter('create')">
            {{ t('create') }} <span>↗</span>
          </button>
          <div class="or-divider">{{ t('join') }}</div>
          <label
            >{{ t('roomCode')
            }}<input
              v-model="code"
              class="code-input"
              maxlength="6"
              autocomplete="off"
              @keyup.enter="enter('join')"
          /></label>
          <button
            class="button secondary full"
            :disabled="busy || !code.trim()"
            @click="enter('join')"
          >
            {{ t('join') }}
          </button>
          <p class="microcopy">{{ t('serverNote') }}</p>
        </template>
      </section>
    </main>

    <main :inert="dialogOpen" v-else-if="online && room && !game" class="lobby-layout">
      <div class="section-heading">
        <div>
          <p class="eyebrow">{{ t('waiting') }}</p>
          <h1>
            {{ t('room') }} <span class="room-code">{{ room.code }}</span>
          </h1>
        </div>
        <button class="button secondary" @click="copyCode">
          {{ copied ? t('copied') : t('copy') }}
        </button>
      </div>
      <p class="muted">{{ t('startNote') }}</p>
      <RoomControls
        :room="room"
        :my-id="myId"
        :busy="busy || onlineStatus !== 'connected'"
        v-model:rounds="rounds"
        @command="command"
        @leave="leave"
      />
      <p class="microcopy">{{ t('reconnectNote') }}</p>
    </main>

    <main :inert="dialogOpen" v-else-if="game" class="game-layout">
      <div class="game-heading">
        <div>
          <p class="eyebrow">{{ online ? `${t('room')} ${room.code}` : t('local') }}</p>
          <h1>{{ t(game.status === 'finished' ? 'finished' : 'tagline') }}</h1>
        </div>
        <div class="game-metrics">
          <span
            >{{ t('round') }}
            <strong
              >{{ game.round }} <small>/ {{ game.maxRounds }}</small></strong
            ></span
          ><span
            >{{ t('ecology') }} <strong>{{ game.ecology }}<small>/100</small></strong></span
          ><button class="text-button" @click="online ? leave() : (page = 'home')">
            {{ online ? t('leave') : t('home') }}
          </button>
        </div>
      </div>
      <section v-if="game.status === 'finished'" class="results panel" data-testid="results">
        <p class="eyebrow">{{ t(game.winnerIds.length > 1 ? 'tied' : 'winner') }}</p>
        <h2>
          {{
            game.players
              .filter((p) => game.winnerIds.includes(p.id))
              .map((p) => p.name)
              .join(' & ')
          }}
          <span>✳</span>
        </h2>
        <p>{{ t(game.finishReason) }}</p>
        <div class="standings">
          <div v-for="(player, index) in ranked" :key="player.id">
            <span>{{ index + 1 }}. {{ player.name }}</span
            ><strong>{{ money(getNetWorth(game, player.id)) }}</strong>
          </div>
        </div>
        <RoomControls
          v-if="online"
          :room="room"
          :my-id="myId"
          :busy="busy || onlineStatus !== 'connected'"
          v-model:rounds="rounds"
          @command="command"
          @leave="leave"
        /><button v-else class="button primary" @click="page = 'home'">{{ t('home') }}</button>
      </section>
      <div class="play-columns">
        <div class="board-column">
          <section v-if="game.status === 'playing'" class="turn-panel panel">
            <div class="turn-title">
              <span
                class="player-dot"
                :style="{ background: colors[game.players.findIndex((p) => p.id === active.id)] }"
                >{{ game.players.findIndex((p) => p.id === active.id) + 1 }}</span
              >
              <div>
                <p class="eyebrow">{{ t('turn') }}</p>
                <h3>{{ active.name }}</h3>
              </div>
              <div class="dice-pair" :aria-label="t('dice')">
                <span v-for="(die, index) in game.lastDice" :key="index">{{ die || '·' }}</span>
              </div>
            </div>
            <p class="muted">
              {{
                !ownTurn ? (active.isAI ? t('aiThinking') : t('waitHint')) : t(`${game.phase}Hint`)
              }}
            </p>
            <p v-if="game.pendingPropertyId" class="purchase-name">
              {{ label(PROPERTIES.find((p) => p.id === game.pendingPropertyId).name) }}
              <strong>{{
                money(PROPERTIES.find((p) => p.id === game.pendingPropertyId).price)
              }}</strong>
            </p>
            <div class="turn-actions">
              <button
                v-for="action in mainActions"
                :key="action.type"
                class="button"
                :class="action.type === 'decline' ? 'secondary' : 'primary'"
                :disabled="busy"
                @click="act(action)"
                :data-testid="`action-${action.type}`"
              >
                {{ action.type === 'roll' && active.skipTurns ? t('skip') : t(action.type) }}
                <span>↗</span></button
              ><span v-if="online && room.turnDeadline" class="microcopy"
                >{{ t('timeout') }} {{ remaining }}{{ t('seconds') }}</span
              >
            </div>
          </section>
          <GameBoard :game="game" :selected="selected" @select="selected = $event" />
          <section class="panel journal">
            <h3>{{ t('log') }} <span>↙</span></h3>
            <ol>
              <li
                v-for="(event, index) in game.log.slice(-16).reverse()"
                :key="`${game.revision}-${index}`"
              >
                {{ formatLog(event, game) }}
              </li>
            </ol>
          </section>
        </div>
        <aside class="game-sidebar">
          <section class="players-list">
            <div
              v-for="(player, index) in game.players"
              :key="player.id"
              class="panel player-card"
              :class="{
                active: game.currentPlayerId === player.id && game.status === 'playing',
                eliminated: player.bankrupt,
              }"
            >
              <div class="player-card-heading">
                <span class="player-dot" :style="{ background: colors[index] }">{{
                  index + 1
                }}</span
                ><strong>{{ player.name }}</strong
                ><span class="badge">{{
                  player.bankrupt
                    ? t('bankrupt')
                    : player.isAI
                      ? 'AI'
                      : player.id === myId && online
                        ? t('you')
                        : t('human')
                }}</span>
              </div>
              <div class="player-money">
                <span
                  >{{ t('cash') }}<strong>{{ money(player.cash) }}</strong></span
                ><span
                  >{{ t('worth') }}<strong>{{ money(getNetWorth(game, player.id)) }}</strong></span
                >
              </div>
              <p class="microcopy">
                {{ t('food') }} {{ player.food }}/4 · {{ t('investments') }}
                {{ player.investments.length }}
              </p>
            </div>
          </section>
          <PropertyPanel
            :game="game"
            :selected="selected"
            :legal="available"
            :busy="busy"
            @action="act"
          />
          <section v-if="game.status === 'playing'" class="panel portfolio">
            <h3>{{ t('assets') }}</h3>
            <p v-if="!ownProperties.length" class="muted">{{ t('noAssets') }}</p>
            <button
              v-for="property in ownProperties"
              :key="property.id"
              class="property-link"
              @click="selected = property.cellIndex"
            >
              <i :style="{ background: GROUPS[property.group].color }"></i>{{ label(property.name)
              }}<span>↗</span>
            </button>
            <h3 class="invest-heading">{{ t('investments') }}</h3>
            <div v-for="project in RULES.investments" :key="project.id" class="investment">
              <strong>{{ label(project.name) }}</strong>
              <p class="microcopy">
                {{ money(project.cost) }} · {{ t('dividend') }} {{ money(project.income) }} ·
                {{ t('limited') }} {{ project.maxCopies }}
              </p>
              <button
                v-if="available.some((a) => a.type === 'invest' && a.projectId === project.id)"
                class="button secondary small"
                :disabled="busy"
                @click="act({ type: 'invest', projectId: project.id })"
              >
                {{ t('invest') }}
              </button>
            </div>
            <button
              v-if="ownTurn"
              class="text-button danger surrender"
              @click="confirmation = 'surrender'"
            >
              {{ t('surrender') }}
            </button>
          </section>
        </aside>
      </div>
    </main>
    <footer class="site-footer" :inert="dialogOpen">
      <span>FAIRY COAST · V4</span><span>36 STOPS. ENDLESS POSSIBILITIES.</span>
    </footer>
    <div
      v-if="rulesOpen || confirmation || handoff"
      class="modal-backdrop"
      @click.self="rulesOpen = false"
    >
      <section
        class="modal panel"
        role="dialog"
        aria-modal="true"
        :aria-label="rulesOpen ? t('rules') : handoff ? t('turnHandoff') : t('confirm')"
        tabindex="-1"
        @keydown="dialogKey"
      >
        <template v-if="rulesOpen"
          ><div class="modal-heading">
            <h2>{{ t('rules') }}</h2>
            <button class="icon-button" @click="rulesOpen = false" :aria-label="t('close')">
              ×
            </button>
          </div>
          <ol class="rules-list">
            <li v-for="index in 11" :key="index">{{ t(`rule${index}`) }}</li>
          </ol>
          <button class="button primary full" @click="rulesOpen = false">
            {{ t('close') }}
          </button></template
        >
        <template v-else-if="handoff"
          ><p class="eyebrow">{{ t('turnHandoff') }}</p>
          <h2>{{ active?.name }}</h2>
          <p class="muted">{{ t('handoffNote') }}</p>
          <button class="button primary full" @click="handoff = false">
            {{ t('playTurn') }}
          </button></template
        >
        <template v-else
          ><h2>{{ t(confirmation) }}</h2>
          <p class="muted">{{ t(`${confirmation}Note`) }}</p>
          <div class="turn-actions">
            <button class="button secondary" @click="confirmation = null">{{ t('cancel') }}</button
            ><button class="button primary" @click="confirm">{{ t('confirm') }}</button>
          </div></template
        >
      </section>
    </div>
  </div>
</template>
