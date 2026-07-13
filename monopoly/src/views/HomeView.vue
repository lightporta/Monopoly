<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import type { GameMode, AILevel, PlayerConfig } from '@/engine/types'
import tokensData from '@/data/tokens.json'

const router = useRouter()
const store = useGameStore()

// 棋子从 tokens.json 读取（6 种：灯塔/鲸鱼/葡萄酒桶/海鸥/蓬莱阁/帆船）
const tokens = (tokensData as { icon: string }[]).map((t) => t.icon)
const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#C9B1FF', '#FFA07A']
const aiNames = ['新手导游', '本地商人', '仙境霸主']
const aiLevelLabels: Record<AILevel, string> = { easy: '简单', normal: '普通', hard: '困难' }

const step = ref(1)
const mode = ref<GameMode | null>(null)
const showRulesModal = ref(false)
const playerCount = ref(2)
const humanCount = ref(1)
const aiCount = ref(1)
const playerNames = reactive(['玩家1', '玩家2', '玩家3', '玩家4'])
const aiLevels = reactive<AILevel[]>(['easy', 'normal', 'hard'])

function selectMode(m: GameMode) {
  if (m === 'pvp') {
    step.value = 3
  } else {
    mode.value = m
    step.value = 2
  }
}

function selectPvpMode(type: 'online' | 'local') {
  if (type === 'online') {
    router.push('/online-lobby')
  } else {
    mode.value = 'pvp'
    step.value = 2
  }
}

function backToStep1() {
  step.value = 1
  mode.value = null
}

function startGame() {
  if (!mode.value) return
  const configs: PlayerConfig[] = []
  if (mode.value === 'pvp') {
    for (let i = 0; i < playerCount.value; i++)
      configs.push({ name: playerNames[i] || `玩家${i + 1}`, isAI: false, token: tokens[i], color: colors[i] })
  } else {
    for (let i = 0; i < humanCount.value; i++)
      configs.push({ name: playerNames[i] || `玩家${i + 1}`, isAI: false, token: tokens[i], color: colors[i] })
    for (let i = 0; i < aiCount.value; i++) {
      const idx = humanCount.value + i
      configs.push({ name: aiNames[i], isAI: true, aiLevel: aiLevels[i], token: tokens[idx], color: colors[idx] })
    }
  }
  store.initGame(mode.value, configs)
  router.push('/game')
}
</script>

<template>
  <div class="home">
    <div class="waves"><div class="wave w1"></div><div class="wave w2"></div><div class="wave w3"></div></div>

    <transition name="slide" mode="out-in">
      <!-- 步骤1: 模式选择 -->
      <div v-if="step === 1" key="s1" class="step">
        <header class="title-block">
          <h1 class="title">仙境海岸·大富翁</h1>
          <p class="subtitle">烟台文旅主题大富翁</p>
        </header>
        <div class="mode-cards">
          <div class="mode-card" @click="selectMode('pvp')">
            <div class="mode-icon">👥</div><h2>与真人玩</h2><p>2-4 位人类玩家</p>
          </div>
          <div class="mode-card" @click="selectMode('pve')">
            <div class="mode-icon">🤖</div><h2>与 AI 玩</h2><p>1-2 位人类 + 1-3 AI</p>
          </div>
        </div>
        <button class="rules-btn" @click="showRulesModal = true">📋 游戏规则</button>
      </div>

      <!-- 步骤3: 真人模式选择（联机版 / 同一设备版） -->
      <div v-else-if="step === 3" key="s3" class="step">
        <h2 class="config-title">选择真人对战模式</h2>
        <div class="mode-cards">
          <div class="mode-card pvp-online" @click="selectPvpMode('online')">
            <div class="mode-icon">🌐</div><h2>联机版</h2><p>不同设备、输入房间 Key 加入</p>
          </div>
          <div class="mode-card pvp-local" @click="selectPvpMode('local')">
            <div class="mode-icon">📱</div><h2>同一设备版</h2><p>多人轮流使用本设备</p>
          </div>
        </div>
        <button class="btn-back" @click="backToStep1">← 返回</button>
      </div>

      <!-- 步骤2: 玩家配置 -->
      <div v-else key="s2" class="step">
        <h2 class="config-title">{{ mode === 'pvp' ? '真人玩家配置' : '人机玩家配置' }}</h2>
        <div class="config-block">
          <div class="selector-row">
            <span class="selector-label">{{ mode === 'pvp' ? '玩家数量' : '人类玩家' }}</span>
            <div class="selector-btns">
              <button v-for="n in (mode === 'pvp' ? [2,3,4] : [1,2])" :key="n"
                :class="['count-btn', { active: (mode === 'pvp' ? playerCount : humanCount) === n }]"
                @click="mode === 'pvp' ? (playerCount = n) : (humanCount = n)">{{ n }} 人</button>
            </div>
          </div>
          <div class="player-list">
            <div v-for="i in (mode === 'pvp' ? playerCount : humanCount)" :key="'h'+i" class="player-row">
              <span class="token-badge" :style="{ background: colors[i - 1] }">{{ tokens[i - 1] }}</span>
              <input v-model="playerNames[i - 1]" class="name-input" :placeholder="`玩家${i}`" />
            </div>
          </div>
          <template v-if="mode === 'pve'">
            <div class="selector-row">
              <span class="selector-label">AI 数量</span>
              <div class="selector-btns">
                <button v-for="n in [1,2,3]" :key="n" :class="['count-btn', { active: aiCount === n }]" @click="aiCount = n">{{ n }} 个</button>
              </div>
            </div>
            <div class="player-list">
              <div v-for="i in aiCount" :key="'a'+i" class="player-row">
                <span class="token-badge" :style="{ background: colors[humanCount + i - 1] }">{{ tokens[humanCount + i - 1] }}</span>
                <span class="ai-name">{{ aiNames[i - 1] }}</span>
                <select v-model="aiLevels[i - 1]" class="level-select">
                  <option v-for="lv in (['easy','normal','hard'] as AILevel[])" :key="lv" :value="lv">{{ aiLevelLabels[lv] }}</option>
                </select>
              </div>
            </div>
          </template>
        </div>
        <div class="action-row">
          <button class="btn btn-secondary" @click="backToStep1">返回</button>
          <button class="btn btn-primary" @click="startGame">开始游戏</button>
        </div>
      </div>
    </transition>

    <transition name="modal">
      <div v-if="showRulesModal" class="rules-modal-overlay" @click.self="showRulesModal = false">
        <div class="rules-modal">
          <div class="modal-header">
            <h3>📋 游戏规则</h3>
            <button class="close-btn" @click="showRulesModal = false">×</button>
          </div>
          <div class="modal-content">
            <div class="rules-section">
              <h4>🎯 游戏目标</h4>
              <ul>
                <li>破产胜利：使其他所有玩家破产，成为最后存活者</li>
                <li>铁三角胜利：同时持有烟台山、蓬莱阁、养马岛三处地标</li>
              </ul>
            </div>
            <div class="rules-section">
              <h4>🎲 基本规则</h4>
              <ul>
                <li>掷骰移动，经过起点领¥2000并抽一张美食卡</li>
                <li>落到空地可购买，落到他人地产可选择买地皮/买房屋/租赁或跳过</li>
                <li>建造房屋收取过路费（最多3级房屋+1级旅馆）</li>
                <li>集齐同色块地产，空地过路费翻倍（建筑等级不叠加色块加成）</li>
                <li>机会卡获收益，命运卡遇风险</li>
                <li>连续三次掷出双数，送至休息格跳过下一回合</li>
                <li>掷出双数可再掷一次（额外回合）</li>
                <li>可点击"放弃"按钮跳过本轮</li>
              </ul>
            </div>
            <div class="rules-section">
              <h4>⚡ 特殊格子</h4>
              <ul>
                <li>烟台山灯塔：固定传送至蓬莱阁</li>
                <li>八仙渡海口：传送至任意空地</li>
                <li>海昌鲸鲨馆：再掷一次骰子</li>
                <li>机场：传送至任意格子</li>
                <li>养马岛跨海大桥：跳过下一回合</li>
              </ul>
            </div>
            <div class="rules-section">
              <h4>🍱 美食卡系统</h4>
              <ul>
                <li>四种美食：烟台焖子、蓬莱小面、海鲜疙瘩汤、鲅鱼水饺</li>
                <li>每次经过起点抽一张美食卡</li>
                <li>集齐四种可兑换：¥2000 或 1张免租券</li>
                <li>免租券：经过他人地产时自动消耗，免除一次租金</li>
              </ul>
            </div>
            <div class="rules-section">
              <h4>🤝 对方资产交易</h4>
              <ul>
                <li>落到他人地产时可选择：买地皮（含建筑）/ 买房屋 / 租赁</li>
                <li>买地皮：获得整块地产及建筑所有权</li>
                <li>买房屋：购买对方一套房屋，地产归属不变</li>
                <li>租赁：支付租金，地产仍归对方所有</li>
                <li>交易需对方同意（AI自动决策，70%同意率）</li>
              </ul>
            </div>
            <div class="rules-section">
              <h4>🏠 色块分组</h4>
              <ul>
                <li>🔴 历史街区（4块）：全部集齐 ×2.0</li>
                <li>🔵 海岸线（8块）：集齐4块 ×1.5</li>
                <li>🟢 仙山（5块）：全部集齐 ×2.0</li>
                <li>🟠 温泉（4块）：全部集齐 ×2.0</li>
                <li>注：色块加成仅对空地生效，建筑租金已含等级倍率</li>
              </ul>
            </div>
            <div class="rules-section">
              <h4>💸 经济规则</h4>
              <ul>
                <li>初始资金：¥15000</li>
                <li>建造费用 = 地价 × 0.4</li>
                <li>卖房回收 = 建造费 × 0.5（半价）</li>
                <li>抵押可得 = 地价 × 0.5</li>
                <li>赎回费用 = 抵押金 × 1.1</li>
                <li>租金等级：空地→1级→2级→3级→旅馆，逐级递增</li>
                <li>现金不足时自动清算（先卖房后抵押），仍不足则破产</li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="showRulesModal = false">我已知晓</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.home { position: relative; width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(160deg, #0D47A1, #1565C0 30%, #1E88E5 60%, #42A5F5); }
.waves { position: absolute; bottom: 0; left: 0; width: 100%; height: 40%; pointer-events: none; }
.wave { position: absolute; bottom: 0; left: -50%; width: 200%; height: 100%; transform-origin: center bottom; }
.w1 { background: radial-gradient(ellipse at center bottom, rgba(255,255,255,.12), transparent 70%); animation: waveFloat 8s ease-in-out infinite; }
.w2 { background: radial-gradient(ellipse at center bottom, rgba(78,205,196,.15), transparent 70%); animation: waveFloat 6s ease-in-out infinite reverse; }
.w3 { background: radial-gradient(ellipse at center bottom, rgba(251,192,45,.08), transparent 70%); animation: waveFloat 10s ease-in-out infinite; }
@keyframes waveFloat { 0%,100% { transform: translateX(0) scaleY(1); } 50% { transform: translateX(-25px) scaleY(1.05); } }
.step { position: relative; z-index: 1; width: 90%; max-width: 560px; padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 28px; }
.title-block { text-align: center; }
.title { font-size: clamp(28px, 6vw, 44px); font-weight: 800; color: var(--color-gold); text-shadow: 0 2px 12px rgba(251,192,45,.4), 0 0 30px rgba(251,192,45,.2); letter-spacing: 2px; }
.subtitle { margin-top: 8px; font-size: 16px; color: rgba(255,255,255,.8); letter-spacing: 1px; }
.mode-cards { display: flex; gap: 20px; width: 100%; flex-wrap: wrap; justify-content: center; }
.mode-card { flex: 1; min-width: 160px; padding: 28px 20px; background: rgba(255,255,255,.12); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,.25); border-radius: 20px; text-align: center; cursor: pointer; transition: var(--transition-base); }
.mode-card:hover { background: rgba(255,255,255,.2); transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,.25); }
.mode-icon { font-size: 48px; margin-bottom: 12px; }
.mode-card h2 { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 6px; }
.mode-card p { font-size: 13px; color: rgba(255,255,255,.7); }
.rules-section { width: 100%; max-width: 480px; }
.rules-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: rgba(255,255,255,.1); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.2); border-radius: 12px; color: #fff; font-size: 15px; font-weight: 600; transition: var(--transition-base); }
.rules-toggle:hover { background: rgba(255,255,255,.18); }
.arrow { transition: transform .3s ease; } .arrow.open { transform: rotate(180deg); }
.rules-list { margin-top: 12px; padding: 16px 20px 16px 36px; background: rgba(255,255,255,.08); backdrop-filter: blur(8px); border-radius: 12px; list-style: decimal; }
.rules-list li { color: rgba(255,255,255,.85); font-size: 14px; line-height: 2; }
.rules-btn { width: 100%; max-width: 480px; padding: 14px 24px; background: rgba(251,192,45,.15); backdrop-filter: blur(8px); border: 2px solid rgba(251,192,45,.4); border-radius: 14px; color: var(--color-gold); font-size: 16px; font-weight: 700; transition: var(--transition-base); }
.rules-btn:hover { background: rgba(251,192,45,.25); border-color: var(--color-gold); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(251,192,45,.25); }
.config-title { font-size: 24px; font-weight: 700; color: var(--color-gold); text-shadow: 0 1px 8px rgba(0,0,0,.3); }
.config-block { width: 100%; display: flex; flex-direction: column; gap: 16px; }
.selector-row { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
.selector-label { color: rgba(255,255,255,.9); font-weight: 600; font-size: 15px; }
.selector-btns { display: flex; gap: 8px; }
.count-btn { padding: 8px 18px; border-radius: var(--radius-pill); background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25); color: rgba(255,255,255,.8); font-weight: 600; font-size: 14px; transition: var(--transition-base); }
.count-btn.active { background: var(--color-gold); border-color: var(--color-gold); color: #3E2723; }
.player-list { display: flex; flex-direction: column; gap: 10px; }
.player-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,.1); backdrop-filter: blur(8px); border-radius: 12px; }
.token-badge { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 20px; box-shadow: 0 2px 6px rgba(0,0,0,.2); flex-shrink: 0; }
.name-input { flex: 1; padding: 8px 12px; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25); border-radius: 8px; color: #fff; font-size: 15px; outline: none; }
.name-input::placeholder { color: rgba(255,255,255,.5); }
.name-input:focus { border-color: var(--color-gold); background: rgba(255,255,255,.2); }
.ai-name { flex: 1; color: rgba(255,255,255,.9); font-weight: 600; }
.level-select { padding: 6px 12px; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25); border-radius: 8px; color: #fff; font-size: 14px; outline: none; }
.level-select option { color: #212121; }
.action-row { display: flex; gap: 16px; margin-top: 8px; }
.btn-back { padding: 12px 28px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25); border-radius: 14px; color: rgba(255,255,255,.85); font-size: 14px; font-weight: 600; cursor: pointer; transition: var(--transition-base); }
.btn-back:hover { background: rgba(255,255,255,.2); }
.pvp-online { background: rgba(78,205,196,.15); border-color: rgba(78,205,196,.4); }
.pvp-online:hover { background: rgba(78,205,196,.25); }
.pvp-local { background: rgba(251,192,45,.12); border-color: rgba(251,192,45,.35); }
.pvp-local:hover { background: rgba(251,192,45,.22); }
.slide-enter-active, .slide-leave-active { transition: all .35s ease; }
.slide-enter-from { opacity: 0; transform: translateX(30px); }
.slide-leave-to { opacity: 0; transform: translateX(-30px); }
.collapse-enter-active, .collapse-leave-active { transition: all .3s ease; overflow: hidden; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; max-height: 0; margin-top: 0; }
.collapse-enter-to, .collapse-leave-from { opacity: 1; max-height: 400px; }
@media (max-width: 480px) { .mode-cards { flex-direction: column; } .mode-card { min-width: 100%; } }

.rules-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.rules-modal { width: 100%; max-width: 560px; max-height: 85vh; background: #fff; border-radius: 24px; border: 2px solid rgba(251,192,45,.3); box-shadow: 0 20px 60px rgba(0,0,0,.5); display: flex; flex-direction: column; overflow: hidden; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid rgba(0,0,0,.1); }
.modal-header h3 { font-size: 20px; font-weight: 700; color: #333; margin: 0; }
.close-btn { width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,.1); border: none; color: #666; font-size: 24px; cursor: pointer; transition: var(--transition-base); display: flex; align-items: center; justify-content: center; }
.close-btn:hover { background: rgba(0,0,0,.2); color: #333; }
.modal-content { flex: 1; overflow-y: auto; padding: 20px 24px; }
.rules-section { margin-bottom: 20px; }
.rules-section:last-child { margin-bottom: 0; }
.rules-section h4 { font-size: 15px; font-weight: 700; color: #333; margin: 0 0 10px 0; }
.rules-section ul { margin: 0; padding-left: 20px; }
.rules-section li { color: #555; font-size: 14px; line-height: 1.8; margin-bottom: 6px; }
.rules-section li:last-child { margin-bottom: 0; }
.modal-footer { padding: 16px 24px; border-top: 1px solid rgba(0,0,0,.1); display: flex; justify-content: center; }
.modal-enter-active, .modal-leave-active { transition: all .3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .rules-modal, .modal-leave-to .rules-modal { transform: scale(0.9); }

.home { min-height: 100dvh; }

@media (max-width: 767px) {
  .home { padding-bottom: env(safe-area-inset-bottom); }
  .step { width: 100%; max-width: 360px; padding: 16px; gap: 20px; }
  .title { font-size: 22px; }
  .subtitle { font-size: 14px; }
  .config-title { font-size: 18px; }
  .mode-cards { flex-direction: column; gap: 12px; }
  .mode-card { width: 100%; min-width: 100%; padding: 20px 16px; }
  .mode-icon { font-size: 36px; margin-bottom: 8px; }
  .mode-card h2 { font-size: 16px; }
  .mode-card p { font-size: 12px; }
  .rules-btn { max-width: 360px; padding: 0 24px; height: 48px; font-size: 15px; }
  .selector-row { flex-direction: column; align-items: flex-start; gap: 10px; }
  .selector-btns { width: 100%; }
  .count-btn { flex: 1; height: 40px; font-size: 14px; }
  .player-row { padding: 10px 12px; gap: 10px; }
  .token-badge { width: 34px; height: 34px; font-size: 18px; }
  .name-input { height: 48px; font-size: 16px; padding: 0 12px; }
  .level-select { height: 40px; font-size: 14px; }
  .action-row { flex-direction: column; gap: 12px; width: 100%; }
  .action-row .btn { width: 100%; height: 48px; font-size: 15px; }
  .btn-back { height: 44px; font-size: 14px; }
  .rules-modal-overlay { align-items: flex-end; padding: 0; }
  .rules-modal { max-height: 85dvh; border-radius: 20px 20px 0 0; }
  .modal-header { padding: 16px 20px; }
  .modal-header h3 { font-size: 18px; }
  .modal-content { padding: 16px 20px; padding-bottom: calc(16px + env(safe-area-inset-bottom)); }
  .modal-footer { padding: 12px 20px; padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
  .modal-footer .btn { height: 48px; font-size: 15px; }
}

@media (max-width: 480px) {
  .step { padding: 12px; gap: 16px; }
  .title { font-size: 20px; letter-spacing: 1px; }
  .subtitle { font-size: 13px; }
  .config-title { font-size: 16px; }
  .mode-card { padding: 16px 12px; }
  .mode-icon { font-size: 32px; }
  .mode-card h2 { font-size: 15px; }
  .player-row { padding: 8px 10px; }
  .token-badge { width: 30px; height: 30px; font-size: 16px; }
  .name-input { height: 44px; font-size: 15px; }
  .rules-btn { height: 46px; font-size: 14px; }
  .modal-header { padding: 14px 16px; }
  .modal-content { padding: 14px 16px; }
  .modal-footer { padding: 10px 16px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
  .rules-section h4 { font-size: 14px; }
  .rules-section li { font-size: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  .w1, .w2, .w3 { animation: none; }
  .slide-enter-active, .slide-leave-active { transition: none; }
  .modal-enter-active, .modal-leave-active { transition: none; }
  .mode-card { transition: none; }
  .mode-card:hover { transform: none; }
  .rules-btn { transition: none; }
  .rules-btn:hover { transform: none; }
  .count-btn { transition: none; }
  .btn-back { transition: none; }
  .status-dot.waiting { animation: none; }
}
</style>
