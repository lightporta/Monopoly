<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const showRules = ref(false)

const turnInfo = computed(() => {
  const p = store.currentPlayer
  if (!p) return '准备开始'
  return `第 ${store.state.turnCount} 回合 · ${p.name}`
})

const currentToken = computed(() => store.currentPlayer?.token ?? '')

const ecologyIndex = computed(() => store.ecologyIndex)
const ecologyStatus = computed(() => store.ecologyStatus)
</script>

<template>
  <header class="top-bar">
    <div class="brand">
      <span class="brand-icon">🏝️</span>
      <span class="brand-text">仙境海岸·大富翁</span>
    </div>
    <div class="center-info">
      <div class="turn-info">
        <span v-if="currentToken" class="turn-token">{{ currentToken }}</span>
        <span>{{ turnInfo }}</span>
      </div>
      <button
        class="ecology-badge"
        :style="{ borderColor: ecologyStatus.color, color: ecologyStatus.color }"
        @click="store.showEcologyDetail = true"
        :title="`生态指数 ${ecologyIndex}（${ecologyStatus.label}）`"
      >
        🌿 {{ ecologyIndex }}
      </button>
    </div>
    <div class="top-actions">
      <button class="rules-btn" @click="showRules = true">📋 规则</button>
      <button class="exit-btn" @click="store.requestExit()">
        <span>🚪</span><span>退出</span>
      </button>
    </div>
  </header>

  <!-- 游戏规则弹窗 -->
  <Transition name="fade">
    <div v-if="showRules" class="rules-overlay" @click.self="showRules = false">
      <div class="rules-modal">
        <div class="rules-header">
          <h3>📋 游戏规则</h3>
          <button class="close-btn" @click="showRules = false">×</button>
        </div>
        <div class="rules-content">
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
            <h4>🌊 四大海洋板块（新增）</h4>
            <ul>
              <li>🛢️ <strong>海工装备</strong>：拥有芝罘湾/渔人码头/天马栈桥/机场地标，可在资产面板购买装备。海洋钻井平台(海岸线+30%)、深海机器人(仙山+30%)、海洋监测船(免疫台风赤潮)、海上风电塔(每回合+300)</li>
              <li>🐚 <strong>海产养殖</strong>：长岛/养马岛/万鸟岛/月亮湾可建造养殖场（与房屋互斥），3级被动收入，每经过起点结算</li>
              <li>💼 <strong>核电投资</strong>：左下方「投资核电」按钮，海阳核电(高回报有风险)/海上风电场(低回报零风险)，每回合开始分红</li>
              <li>🌿 <strong>海洋生态</strong>：全局生态指数0~100，生态卡影响指数。优良(+补贴)/预警(养殖-30%)/危机(养殖-60%+核电-50%)</li>
              <li>🎫 <strong>重掷券</strong>：集齐任一色块奖励1张重掷券（最多3张），可在自己回合使用</li>
            </ul>
          </div>
          <div class="rules-section">
            <h4>🏆 胜利条件</h4>
            <ul>
              <li><strong>破产胜利</strong>：其他所有玩家破产，成为最后存活者</li>
              <li><strong>仙境铁三角胜利</strong>：同时持有烟台山 + 蓬莱阁 + 养马岛三处地标（抵押不影响，仅看所有权）</li>
              <li>两种条件实时检测，破产胜利优先于铁三角</li>
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
        <div class="rules-footer">
          <button class="btn-ok" @click="showRules = false">我已知晓</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--color-ocean) 0%, #1565c0 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(30, 136, 229, 0.35);
  border-bottom: 3px solid var(--color-gold);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}

.brand-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3));
}

.brand-text {
  font-size: 20px;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
}

.turn-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  padding: 6px 18px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-pill);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  white-space: nowrap;
}

.turn-token {
  font-size: 18px;
}

.center-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
}

.ecology-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid #43A047;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: var(--transition-base);
  white-space: nowrap;
}

.ecology-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.exit-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: rgba(229, 57, 53, 0.85);
  border-radius: var(--radius-pill);
  transition: var(--transition-base);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.exit-btn:hover {
  background: var(--color-brick);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(229, 57, 53, 0.5);
}

.exit-btn:active {
  transform: translateY(0);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rules-btn {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-ocean);
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-pill);
  transition: var(--transition-base);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.rules-btn:hover {
  background: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.rules-btn:active {
  transform: translateY(0);
}

/* 规则弹窗 */
.rules-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.rules-modal {
  width: 480px;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 64px);
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popIn 0.3s ease;
}

.rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid #eee;
}

.rules-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #212121;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  color: #666;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #e0e0e0;
}

.rules-content {
  padding: 16px 22px;
  overflow-y: auto;
  flex: 1;
}

.rules-section {
  margin-bottom: 14px;
}

.rules-section h4 {
  font-size: 15px;
  font-weight: 700;
  color: #1E88E5;
  margin: 0 0 6px 0;
}

.rules-section ul {
  margin: 0;
  padding-left: 20px;
}

.rules-section li {
  font-size: 13px;
  color: #555;
  line-height: 1.8;
}

.rules-footer {
  padding: 12px 22px 18px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: center;
}

.btn-ok {
  padding: 10px 36px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: var(--color-ocean);
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: var(--transition-base);
}

.btn-ok:hover {
  background: #1565c0;
  transform: translateY(-1px);
}

@keyframes popIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .top-bar {
    padding: 10px 14px;
    gap: 8px;
  }
  .brand-text {
    font-size: 16px;
  }
  .turn-info {
    font-size: 12px;
    padding: 4px 12px;
  }
  .rules-btn {
    padding: 6px 12px;
    font-size: 13px;
  }
  .exit-btn {
    padding: 6px 12px;
    font-size: 13px;
  }
  .rules-modal {
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 32px);
    border-radius: 14px;
  }
  .rules-header {
    padding: 14px 16px;
  }
  .rules-header h3 {
    font-size: 16px;
  }
  .rules-content {
    padding: 12px 16px;
  }
  .rules-section h4 {
    font-size: 14px;
  }
  .rules-section li {
    font-size: 12px;
  }
}
</style>
