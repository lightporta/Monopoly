import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Game } from '@/engine/Game'
import type { GameMode, PlayerConfig, GameEvent, Player, BoardCell, Property, ColorGroup, GameState } from '@/engine/types'
import type { RedeemOption } from '@/engine/FoodCollector'

const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3']
const PLAYER_TOKENS = ['🗼', '🐳', '🍷', '🐦']

export const useGameStore = defineStore('game', () => {
  const engine = new Game()

  const state = ref(engine.getSnapshot())
  const board = ref<BoardCell[]>(engine.getBoard())
  const properties = ref<Property[]>(engine.getProperties())
  const colorGroups = ref<ColorGroup[]>(engine.getColorGroups())

  const isOnlineMode = ref(false)
  const onlineGameState = ref<any>(null)

  const pendingModal = ref<GameEvent | null>(null)
  const showTurnHandoff = ref(false)
  const showExitConfirm = ref(false)
  const showVictory = ref(false)
  const diceAnimating = ref(false)
  const lastEventMessage = ref('')

  // 计算属性
  const currentPlayer = computed<Player | null>(() => {
    return state.value.players[state.value.currentPlayerIndex] ?? null
  })

  const isCurrentPlayerAI = computed(() => currentPlayer.value?.isAI ?? false)

  const canRollDice = computed(() => {
    const p = currentPlayer.value
    return p && !p.isAI && !p.bankrupt && !pendingModal.value && (state.value.phase === 'idle' || state.value.phase === 'event')
  })

  const canManageAssets = computed(() => {
    const p = currentPlayer.value
    return p && !p.isAI && !p.bankrupt && state.value.phase === 'idle' && !pendingModal.value
  })

  const canSkipTurn = computed(() => {
    const p = currentPlayer.value
    return p && !p.isAI && !p.bankrupt && !pendingModal.value && (state.value.phase === 'idle' || state.value.phase === 'event')
  })

  function setOnlineMode(online: boolean) {
    isOnlineMode.value = online
  }

  function setOnlineGameState(gs: any) {
    onlineGameState.value = gs
  }

  // 同步引擎状态（深拷贝确保 Vue 响应式更新）
  function syncState() {
    state.value = JSON.parse(JSON.stringify(engine.getSnapshot()))
  }

  // 初始化游戏
  function initGame(mode: GameMode, playerConfigs: PlayerConfig[]) {
    engine.init(mode, playerConfigs)
    syncState()
    pendingModal.value = null
    showTurnHandoff.value = false
    showExitConfirm.value = false
    showVictory.value = false
    lastEventMessage.value = '游戏开始！'

    // 如果先手是 AI，触发 AI 回合
    if (isCurrentPlayerAI.value) {
      setTimeout(() => runAITurn(), 800)
    }
  }

  // 掷骰子
  function rollDice() {
    if (!canRollDice.value) return
    diceAnimating.value = true

    setTimeout(() => {
      const event = engine.rollDice()
      syncState()
      lastEventMessage.value = event.message
      diceAnimating.value = false

      // 触发落格事件
      const cellEvent = engine.handleCellEvent()
      syncState()
      lastEventMessage.value = cellEvent.message

      // 处理事件
      handleGameEvent(cellEvent)
    }, 900)
  }

  // 处理游戏事件
  function handleGameEvent(event: GameEvent) {
    if (event.type === 'victory') {
      showVictory.value = true
      return
    }

    if (event.type === 'bankrupt') {
      syncState()
      checkVictoryAfterEvent()
      if (state.value.phase !== 'ended') {
        endTurn()
      }
      return
    }

    // 需要玩家交互的事件
    if (event.type === 'buyProperty' || event.type === 'teleportAnyEmpty' || event.type === 'moveAnyCell' || event.type === 'landOpponentProperty') {
      pendingModal.value = event
      // AI 自动处理
      if (isCurrentPlayerAI.value) {
        setTimeout(() => handleAIEvent(event), 600)
      }
      return
    }

    // 抽卡事件：展示卡牌弹窗，玩家确认后结束回合
    if (event.type === 'drawChance' || event.type === 'drawDestiny') {
      if (isCurrentPlayerAI.value) {
        // AI 无需展示弹窗，直接结束回合
        endTurn()
      } else {
        pendingModal.value = event
      }
      return
    }

    // 自动处理的事件（付租、再玩、休息等）
    if (event.type === 'reroll') {
      // 再玩一次：不结束回合，玩家可再次掷骰
      if (isCurrentPlayerAI.value) {
        setTimeout(() => rollDice(), 800)
      }
      return
    }

    // 其他事件完成后结束回合
    endTurn()
  }

  // 购买地产
  function buyProperty() {
    const event = pendingModal.value
    if (!event?.propertyId) return
    engine.buyProperty(event.propertyId)
    syncState()
    pendingModal.value = null
    checkVictoryAfterEvent()
    endTurn()
  }

  // 放弃购买
  function declineBuy() {
    engine.declineBuy()
    pendingModal.value = null
    endTurn()
  }

  // 传送/移动到目标
  function teleportTo(targetIndex: number) {
    const event = engine.teleportTo(targetIndex)
    syncState()
    pendingModal.value = null
    lastEventMessage.value = event.message
    handleGameEvent(event)
  }

  // 建房
  function buildHouse(propertyId: string) {
    const ok = engine.buildHouse(propertyId)
    if (ok) syncState()
    return ok
  }

  // 拆房
  function sellBuilding(propertyId: string) {
    const ok = engine.sellBuilding(propertyId)
    if (ok) syncState()
    return ok
  }

  // 抵押
  function mortgage(propertyId: string) {
    const ok = engine.mortgage(propertyId)
    if (ok) syncState()
    return ok
  }

  // 赎回
  function redeem(propertyId: string) {
    const ok = engine.redeem(propertyId)
    if (ok) syncState()
    return ok
  }

  // 玩家间交易：买地皮
  function buyPropertyFromPlayer(propertyId: string, buyerId: number, sellerId: number) {
    const ok = engine.buyPropertyFromPlayer(propertyId, buyerId, sellerId)
    if (ok) syncState()
    return ok
  }

  // 玩家间交易：买房屋
  function buyBuildingFromPlayer(propertyId: string, buyerId: number, sellerId: number) {
    const ok = engine.buyBuildingFromPlayer(propertyId, buyerId, sellerId)
    if (ok) syncState()
    return ok
  }

  // 玩家间交易：租房
  function payRentToPlayer(propertyId: string, visitorId: number, ownerId: number) {
    const ok = engine.payRentToPlayer(propertyId, visitorId, ownerId)
    if (ok) syncState()
    return ok
  }

  // 交易价格计算
  function getBuyPropertyPrice(propertyId: string, ownerId: number): number {
    return engine.getBuyPropertyPrice(propertyId, ownerId)
  }
  function getBuyBuildingPrice(propertyId: string, ownerId: number): number {
    return engine.getBuyBuildingPrice(propertyId, ownerId)
  }
  function getRentPrice(propertyId: string, ownerId: number, visitorId: number): number {
    return engine.getRentPrice(propertyId, ownerId, visitorId)
  }

  // 兑换美食卡
  function redeemFood(option: RedeemOption) {
    const ok = engine.redeemFood(option)
    if (ok) syncState()
    return ok
  }

  // 结束回合
  function endTurn() {
    if (state.value.phase === 'ended') {
      showVictory.value = true
      return
    }

    const prevPlayerIndex = state.value.currentPlayerIndex

    engine.endTurn()
    syncState()

    if (state.value.winner) {
      showVictory.value = true
      return
    }

    // 真人对战：仅在玩家切换时显示回合交接提示
    if (state.value.mode === 'pvp' && !isCurrentPlayerAI.value && state.value.currentPlayerIndex !== prevPlayerIndex) {
      showTurnHandoff.value = true
    }

    // AI 回合
    if (isCurrentPlayerAI.value) {
      setTimeout(() => runAITurn(), 1000)
    }
  }

  // 放弃本轮（跳过当前回合，状态不变）
  function skipTurn() {
    const p = currentPlayer.value
    if (!p || p.isAI) return
    if (state.value.phase === 'ended') {
      showVictory.value = true
      return
    }
    const prevPlayerIndex = state.value.currentPlayerIndex
    lastEventMessage.value = `${p.name} 放弃了本轮`
    engine.endTurn()
    syncState()
    if (state.value.winner) {
      showVictory.value = true
      return
    }
    if (state.value.mode === 'pvp' && !isCurrentPlayerAI.value && state.value.currentPlayerIndex !== prevPlayerIndex) {
      showTurnHandoff.value = true
    }
    if (isCurrentPlayerAI.value) {
      setTimeout(() => runAITurn(), 1000)
    }
  }

  function confirmTurnHandoff() {
    showTurnHandoff.value = false
  }

  function requestExit() {
    showExitConfirm.value = true
  }

  function cancelExit() {
    showExitConfirm.value = false
  }

  function clearPendingEvent() {
    pendingModal.value = null
  }

  function confirmExit() {
    showExitConfirm.value = false
    showVictory.value = false
    pendingModal.value = null
  }

  // 胜利检查
  function checkVictoryAfterEvent() {
    if (state.value.phase === 'ended' || state.value.winner) {
      showVictory.value = true
    }
  }

  // AI 回合执行
  function runAITurn() {
    if (!isCurrentPlayerAI.value || state.value.phase === 'ended') return

    // AI 资产管理（建造/抵押）
    const ai = engine.getAIPlayer()
    const player = currentPlayer.value
    if (!player) return

    // 尝试建造
    for (const propId of player.properties) {
      if (ai.decideBuild(player, properties.value, colorGroups.value) === propId) {
        engine.buildHouse(propId)
        break
      }
    }
    syncState()

    // 掷骰
    diceAnimating.value = true
    setTimeout(() => {
      const event = engine.rollDice()
      syncState()
      lastEventMessage.value = event.message
      diceAnimating.value = false

      const cellEvent = engine.handleCellEvent()
      syncState()
      lastEventMessage.value = cellEvent.message
      handleAIEvent(cellEvent)
    }, 900)
  }

  // AI 处理事件
  function handleAIEvent(event: GameEvent) {
    if (event.type === 'victory') {
      showVictory.value = true
      return
    }

    if (event.type === 'buyProperty' && event.propertyId) {
      const player = currentPlayer.value
      const prop = properties.value.find(p => p.id === event.propertyId)
      if (player && prop) {
        const ai = engine.getAIPlayer()
        if (ai.decideBuy(player, prop)) {
          engine.buyProperty(event.propertyId)
          syncState()
        } else {
          engine.declineBuy()
        }
      }
      pendingModal.value = null
      checkVictoryAfterEvent()
      endTurn()
      return
    }

    if (event.type === 'teleportAnyEmpty') {
      const ai = engine.getAIPlayer()
      const player = currentPlayer.value
      if (player) {
        const emptyProps = getEmptyProperties()
        const target = ai.decideTeleportTarget(emptyProps, player)
        if (target) {
          const prop = properties.value.find(p => p.id === target)
          const cell = board.value.find(c => c.propertyRef === target)
          if (cell) {
            const tpEvent = engine.teleportTo(cell.index)
            syncState()
            lastEventMessage.value = tpEvent.message
            handleAIEvent(tpEvent)
            return
          }
        }
      }
      endTurn()
      return
    }

    if (event.type === 'moveAnyCell') {
      // AI 随机选一个格子
      const targetIdx = Math.floor(Math.random() * 36)
      const tpEvent = engine.teleportTo(targetIdx)
      syncState()
      lastEventMessage.value = tpEvent.message
      handleAIEvent(tpEvent)
      return
    }

    if (event.type === 'landOpponentProperty') {
      // AI 落到对手地产：根据现金决定行为
      const aiPlayer = currentPlayer.value
      if (aiPlayer && event.propertyId && event.ownerId) {
        // AI 策略：70% 概率租房，20% 概率买地皮（如果有钱），10% 不操作
        const rent = engine.getRentPrice(event.propertyId, event.ownerId, aiPlayer.id)
        const prop = properties.value.find(p => p.id === event.propertyId)
        const level = getBuildingLevel(event.propertyId, event.ownerId)
        const buyPrice = prop ? prop.price + prop.buildCost * level : 0
        const roll = Math.random()
        if (roll < 0.2 && aiPlayer.cash >= buyPrice + 2000) {
          // 买地皮
          engine.buyPropertyFromPlayer(event.propertyId, aiPlayer.id, event.ownerId)
          syncState()
          lastEventMessage.value = `${aiPlayer.name} 向 ${event.ownerName} 购买了 ${prop?.name}`
        } else if (roll < 0.9 && aiPlayer.cash >= rent) {
          // 租房
          engine.payRentToPlayer(event.propertyId, aiPlayer.id, event.ownerId)
          syncState()
          lastEventMessage.value = `${aiPlayer.name} 向 ${event.ownerName} 支付了 ${prop?.name} 租金 ¥${rent}`
        }
        // else: 不操作
      }
      pendingModal.value = null
      checkVictoryAfterEvent()
      endTurn()
      return
    }

    if (event.type === 'reroll') {
      setTimeout(() => runAITurn(), 800)
      return
    }

    endTurn()
  }

  // 辅助：获取空地列表
  function getEmptyProperties(): Property[] {
    return properties.value.filter(p => {
      return !state.value.players.some(player =>
        player.properties.includes(p.id)
      )
    })
  }

  // 辅助：获取玩家拥有的地产
  function getPlayerProperties(playerId: number): Property[] {
    const player = state.value.players.find(p => p.id === playerId)
    if (!player) return []
    return properties.value.filter(p => player.properties.includes(p.id))
  }

  // 辅助：获取地产归属
  function getPropertyOwner(propertyId: string): Player | null {
    return state.value.players.find(p => p.properties.includes(propertyId)) ?? null
  }

  // 辅助：获取建筑等级
  function getBuildingLevel(propertyId: string, playerId: number): number {
    const player = state.value.players.find(p => p.id === playerId)
    if (!player) return 0
    return player.buildings[propertyId] ?? 0
  }

  // 辅助：获取色块组
  function getColorGroup(groupId: string): ColorGroup | undefined {
    return colorGroups.value.find(g => g.id === groupId)
  }

  // 辅助：检查玩家是否集齐色块
  function hasColorGroupBonus(playerId: number, groupId: string): boolean {
    const group = getColorGroup(groupId)
    if (!group) return false
    const player = state.value.players.find(p => p.id === playerId)
    if (!player) return false
    const owned = group.propertyIds.filter(id => player.properties.includes(id))
    if (group.bonusRule.type === 'all') {
      return owned.length === group.bonusRule.requiredCount
    }
    return owned.length >= group.bonusRule.requiredCount
  }

  return {
    state,
    board,
    properties,
    colorGroups,
    isOnlineMode,
    onlineGameState,
    pendingModal,
    showTurnHandoff,
    showExitConfirm,
    showVictory,
    diceAnimating,
    lastEventMessage,
    currentPlayer,
    isCurrentPlayerAI,
    canRollDice,
    canManageAssets,
    canSkipTurn,
    setOnlineMode,
    setOnlineGameState,
    initGame,
    rollDice,
    buyProperty,
    declineBuy,
    teleportTo,
    buildHouse,
    sellBuilding,
    mortgage,
    redeem,
    buyPropertyFromPlayer,
    buyBuildingFromPlayer,
    payRentToPlayer,
    getBuyPropertyPrice,
    getBuyBuildingPrice,
    getRentPrice,
    redeemFood,
    endTurn,
    skipTurn,
    confirmTurnHandoff,
    requestExit,
    cancelExit,
    clearPendingEvent,
    confirmExit,
    getEmptyProperties,
    getPlayerProperties,
    getPropertyOwner,
    getBuildingLevel,
    getColorGroup,
    hasColorGroupBonus,
    PLAYER_COLORS,
    PLAYER_TOKENS,
  }
})
