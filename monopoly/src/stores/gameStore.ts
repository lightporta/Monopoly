import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Game } from '@/engine/Game'
import type { GameMode, PlayerConfig, GameEvent, Player, BoardCell, Property, ColorGroup, GameState, EquipmentData, InvestmentProject } from '@/engine/types'
import type { RedeemOption } from '@/engine/FoodCollector'
import tokensData from '@/data/tokens.json'

const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3']
// 棋子从 tokens.json 读取（6 种：灯塔/鲸鱼/葡萄酒桶/海鸥/蓬莱阁/帆船）
const PLAYER_TOKENS: string[] = (tokensData as { icon: string }[]).map((t) => t.icon)

export const useGameStore = defineStore('game', () => {
  const engine = new Game()

  const state = ref(engine.getSnapshot())
  const board = ref<BoardCell[]>(engine.getBoard())
  const properties = ref<Property[]>(engine.getProperties())
  const colorGroups = ref<ColorGroup[]>(engine.getColorGroups())

  const isOnlineMode = ref(false)
  const onlineGameState = ref<any>(null)
  // 联机模式：自己的座位号（seatIndex）
  const myPlayerId = ref<number>(0)
  // 记录上一局配置，供"再玩一局"使用
  const lastGameMode = ref<GameMode>('pvp')
  const lastGameConfigs = ref<PlayerConfig[]>([])
  // 联机房间解散提示
  const showRoomDisbanded = ref(false)
  const roomDisbandedMessage = ref('')

  const pendingModal = ref<GameEvent | null>(null)
  const showTurnHandoff = ref(false)
  const showExitConfirm = ref(false)
  const showVictory = ref(false)
  const diceAnimating = ref(false)
  const lastEventMessage = ref('')

  // ---- 四大海洋板块 UI 状态 ----
  const showEquipmentModal = ref(false)
  const showAquacultureModal = ref(false)
  const showInvestModal = ref(false)
  const showEcologyDetail = ref(false)
  const activeEquipmentPropertyId = ref<string | null>(null)
  const activeAquaculturePropertyId = ref<string | null>(null)

  // 计算属性
  const currentPlayer = computed<Player | null>(() => {
    return state.value.players[state.value.currentPlayerIndex] ?? null
  })

  // 当前游戏模式（pvp 同设备 / pve 人机）；联机模式叠加在 pvp 之上
  const gameMode = computed<GameMode>(() => state.value.mode)

  const isCurrentPlayerAI = computed(() => currentPlayer.value?.isAI ?? false)

  // 联机模式：是否轮到我操作
  const isMyTurn = computed(() => {
    if (!isOnlineMode.value) return true // 单机模式总是返回 true（由 canRollDice 进一步控制）
    return state.value.currentPlayerIndex === myPlayerId.value && state.value.phase !== 'ended'
  })

  // 联机模式：当前待处理事件是否该我操作（弹窗隔离核心）
  const isMyPendingEvent = computed(() => {
    if (!isOnlineMode.value) return true // 单机模式：所有事件都是我的
    const pe = pendingModal.value
    if (!pe) return false
    // pendingEvent.playerId 是座位号（引擎内 playerIndex），与 myPlayerId 对齐
    return pe.playerId === myPlayerId.value
  })

  // 仅在自己的待处理事件时返回 modal（用于触发可交互弹窗）
  const interactivePendingModal = computed(() => {
    if (!isOnlineMode.value) return pendingModal.value
    return isMyPendingEvent.value ? pendingModal.value : null
  })

  // 联机模式：玩家退出提示（"{昵称}已退出房间"，1s 自动关闭）
  const playerLeftNotice = ref('')

  // 联机模式：没有待处理事件，或待处理事件是我的时，才允许操作
  // （别人的 pendingEvent 不应锁住我的按钮）
  const noBlockingModal = computed(() => {
    if (!isOnlineMode.value) return !pendingModal.value
    return !pendingModal.value || isMyPendingEvent.value
  })

  const canRollDice = computed(() => {
    if (isOnlineMode.value) {
      // 联机模式：轮到自己且无阻塞弹窗时可掷骰
      return isMyTurn.value && noBlockingModal.value && (state.value.phase === 'idle' || state.value.phase === 'event')
    }
    const p = currentPlayer.value
    return p && !p.isAI && !p.bankrupt && !pendingModal.value && (state.value.phase === 'idle' || state.value.phase === 'event')
  })

  const canManageAssets = computed(() => {
    if (isOnlineMode.value) {
      return isMyTurn.value && noBlockingModal.value
    }
    const p = currentPlayer.value
    return p && !p.isAI && !p.bankrupt && state.value.phase === 'idle' && !pendingModal.value
  })

  const canSkipTurn = computed(() => {
    if (isOnlineMode.value) {
      return isMyTurn.value && noBlockingModal.value
    }
    const p = currentPlayer.value
    return p && !p.isAI && !p.bankrupt && !pendingModal.value && (state.value.phase === 'idle' || state.value.phase === 'event')
  })

  function setOnlineMode(online: boolean) {
    isOnlineMode.value = online
  }

  function setOnlineGameState(gs: any) {
    onlineGameState.value = gs
  }

  function setMyPlayerId(id: number) {
    myPlayerId.value = id
  }

  // 联机模式：应用服务端广播的完整游戏状态（覆盖本地 state）
  function applyOnlineState(gs: any) {
    if (!gs) return
    state.value = JSON.parse(JSON.stringify(gs))
    onlineGameState.value = gs
    diceAnimating.value = false

    // 根据服务端 pendingEvent 设置弹窗
    const pe = gs.pendingEvent
    if (pe) {
      pendingModal.value = pe as GameEvent
    } else {
      pendingModal.value = null
    }

    // 胜利判定
    if (gs.phase === 'ended' && gs.winner) {
      showVictory.value = true
    }
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

    // 记录本局配置，供"再玩一局"使用（联机模式不使用本地重开）
    lastGameMode.value = mode
    lastGameConfigs.value = playerConfigs.map((c) => ({ ...c }))

    // 如果先手是 AI，触发 AI 回合
    if (isCurrentPlayerAI.value) {
      setTimeout(() => runAITurn(), 800)
    }
  }

  /** 再玩一局：用上一局相同的模式与玩家配置重开（仅单机模式） */
  function playAgain() {
    initGame(lastGameMode.value, lastGameConfigs.value)
    showVictory.value = false
  }

  /** 显示联机房间解散提示 */
  function notifyRoomDisbanded(msg: string) {
    showRoomDisbanded.value = true
    roomDisbandedMessage.value = msg
  }

  function dismissRoomDisbanded() {
    showRoomDisbanded.value = false
    roomDisbandedMessage.value = ''
  }

  /** 显示玩家退出提示（1s 后自动清除） */
  function showPlayerLeftNotice(name: string) {
    playerLeftNotice.value = `${name} 已退出房间`
    setTimeout(() => { playerLeftNotice.value = '' }, 1000)
  }

  // 掷骰子
  function rollDice() {
    if (!canRollDice.value) return
    // 联机模式：发 action 到服务端，状态由 game:state 广播回来
    if (isOnlineMode.value) {
      // 防御性校验：只有轮到自己才能掷骰（canRollDice 已检查，这里显式兜底）
      if (!isMyTurn.value) {
        diceAnimating.value = false
        return
      }
      diceAnimating.value = true
      sendOnlineAction('roll')
      return
    }
    diceAnimating.value = true

    setTimeout(() => {
      // ---- 四大海洋板块：回合开始结算（核电分红/风电塔/生态补贴）----
      engine.settleTurnStart()
      syncState()
      // 分红/补贴可能触发资产胜利，若已结束则显示弹窗并中止
      if (state.value.winner) {
        diceAnimating.value = false
        checkVictoryAfterEvent()
        return
      }

      const event = engine.rollDice()
      syncState()
      lastEventMessage.value = event.message
      diceAnimating.value = false
      // 过起点奖励可能触发资产胜利
      if (state.value.winner) {
        checkVictoryAfterEvent()
        return
      }

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
    if (isOnlineMode.value) {
      sendOnlineAction('buy', { propertyId: event.propertyId })
      return
    }
    engine.buyProperty(event.propertyId)
    syncState()
    pendingModal.value = null
    checkVictoryAfterEvent()
    endTurn()
  }

  // 放弃购买
  function declineBuy() {
    if (isOnlineMode.value) {
      sendOnlineAction('declineBuy')
      return
    }
    engine.declineBuy()
    pendingModal.value = null
    endTurn()
  }

  // 传送/移动到目标
  function teleportTo(targetIndex: number) {
    if (isOnlineMode.value) {
      sendOnlineAction('teleportTo', { targetIndex })
      return
    }
    const event = engine.teleportTo(targetIndex)
    syncState()
    pendingModal.value = null
    lastEventMessage.value = event.message
    handleGameEvent(event)
  }

  // 建房
  function buildHouse(propertyId: string) {
    if (isOnlineMode.value) {
      sendOnlineAction('build', { propertyId })
      return true
    }
    const ok = engine.buildHouse(propertyId)
    if (ok) {
      syncState()
      // 建房可能满足铁三角胜利条件（各地标建有房屋）
      checkVictoryAfterEvent()
    }
    return ok
  }

  // 拆房
  function sellBuilding(propertyId: string) {
    if (isOnlineMode.value) {
      sendOnlineAction('sellBuilding', { propertyId })
      return true
    }
    const ok = engine.sellBuilding(propertyId)
    if (ok) syncState()
    return ok
  }

  // 抵押
  function mortgage(propertyId: string) {
    if (isOnlineMode.value) {
      sendOnlineAction('mortgage', { propertyId })
      return true
    }
    const ok = engine.mortgage(propertyId)
    if (ok) syncState()
    return ok
  }

  // 赎回
  function redeem(propertyId: string) {
    if (isOnlineMode.value) {
      sendOnlineAction('redeem', { propertyId })
      return true
    }
    const ok = engine.redeem(propertyId)
    if (ok) syncState()
    return ok
  }

  // 玩家间交易：买地皮
  function buyPropertyFromPlayer(propertyId: string, buyerId: number, sellerId: number) {
    if (isOnlineMode.value) {
      sendOnlineAction('buyPropertyFromPlayer', { propertyId, sellerId })
      return true
    }
    const ok = engine.buyPropertyFromPlayer(propertyId, buyerId, sellerId)
    if (ok) syncState()
    return ok
  }

  // 玩家间交易：买房屋
  function buyBuildingFromPlayer(propertyId: string, buyerId: number, sellerId: number) {
    if (isOnlineMode.value) {
      sendOnlineAction('buyBuildingFromPlayer', { propertyId, sellerId })
      return true
    }
    const ok = engine.buyBuildingFromPlayer(propertyId, buyerId, sellerId)
    if (ok) syncState()
    return ok
  }

  // 玩家间交易：租房
  function payRentToPlayer(propertyId: string, visitorId: number, ownerId: number) {
    if (isOnlineMode.value) {
      sendOnlineAction('payRent', { propertyId, ownerId })
      return true
    }
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
    if (isOnlineMode.value) {
      sendOnlineAction('redeemFood', { option })
      return true
    }
    const ok = engine.redeemFood(option)
    if (ok) syncState()
    return ok
  }

  // 结束回合
  function endTurn() {
    if (isOnlineMode.value) {
      sendOnlineAction('endTurn')
      return
    }
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
    if (isOnlineMode.value) {
      sendOnlineAction('endTurn')
      return
    }
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

    const player = currentPlayer.value
    if (!player) return
    // 按当前 AI 玩家的难度取决策器
    const ai = engine.getAIPlayer(player.aiLevel ?? 'normal')

    // ---- 四大海洋板块：AI 简单决策 ----
    aiOceanDecisions(player, ai)

    // 尝试建造
    for (const propId of player.properties) {
      if (ai.decideBuild(player, properties.value, colorGroups.value) === propId) {
        engine.buildHouse(propId)
        break
      }
    }
    syncState()
    // 建房可能触发铁三角胜利，若已结束则显示弹窗并中止 AI 回合
    checkVictoryAfterEvent()
    if (state.value.winner) return

    // 掷骰
    diceAnimating.value = true
    setTimeout(() => {
      // ---- 四大海洋板块：回合开始结算 ----
      engine.settleTurnStart()
      syncState()
      // 分红/补贴可能触发资产胜利
      if (state.value.winner) {
        diceAnimating.value = false
        checkVictoryAfterEvent()
        return
      }

      const event = engine.rollDice()
      syncState()
      lastEventMessage.value = event.message
      diceAnimating.value = false
      // 过起点奖励可能触发资产胜利
      if (state.value.winner) {
        checkVictoryAfterEvent()
        return
      }

      const cellEvent = engine.handleCellEvent()
      syncState()
      lastEventMessage.value = cellEvent.message
      handleAIEvent(cellEvent)
    }, 900)
  }

  /** AI 对四大海洋板块的简单决策（购买装备/建养殖/投资） */
  function aiOceanDecisions(player: Player, ai: ReturnType<typeof engine.getAIPlayer>) {
    // 装备决策
    const eqMgr = engine.getEquipmentManager()
    const availableEquip = eqMgr.getAll()
      .filter((e) => !eqMgr.isSold(e.id))
      .map((e) => ({
        equipId: e.id,
        soldAtPropertyId: board.value.find((c) => c.index === e.soldAtCell)?.propertyRef ?? '',
        price: e.price,
        effectColorGroup: e.effect.type === 'rentBoost' ? e.effect.colorGroup : undefined,
      }))
      .filter((e) => e.soldAtPropertyId)
    const eqDecision = ai.decideBuyEquipment(player, availableEquip)
    if (eqDecision) {
      engine.buyEquipment(eqDecision.equipId, eqDecision.soldAtPropertyId, eqDecision.boundPropertyId)
    }

    // 养殖决策
    const aquaProps = properties.value
      .filter((p) => p.aquaculture?.enabled)
      .map((p) => {
        const lvl = player.aquaculture[p.id]?.level ?? 0
        const cost = lvl < 3 ? p.aquaculture!.levels[lvl].cost : 0
        return { propertyId: p.id, cost }
      })
      .filter((p) => p.cost > 0)
    const aquaDecision = ai.decideBuildAquaculture(player, aquaProps)
    if (aquaDecision) {
      engine.buildAquaculture(aquaDecision)
    }

    // 投资决策
    const invMgr = engine.getNuclearInvestManager()
    const availableInv = invMgr.getAll()
      .filter((p) => invMgr.remainingCopies(p.id) > 0)
      .map((p) => ({
        projectId: p.id,
        cost: p.cost,
        riskLevel: (p.id.startsWith('NUC') ? 'high' : 'low') as 'low' | 'high',
      }))
    const invDecision = ai.decideInvest(player, availableInv)
    if (invDecision) {
      engine.investNuclear(invDecision)
    }
    syncState()
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
        const ai = engine.getAIPlayer(player.aiLevel ?? 'normal')
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
      const player = currentPlayer.value
      const ai = engine.getAIPlayer(player?.aiLevel ?? 'normal')
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
      // AI 落到对手地产：按难度分档决定行为
      const aiPlayer = currentPlayer.value
      if (aiPlayer && event.propertyId && event.ownerId) {
        const ai = engine.getAIPlayer(aiPlayer.aiLevel ?? 'normal')
        const w = ai.getLandOpponentWeights()
        const rent = engine.getRentPrice(event.propertyId, event.ownerId, aiPlayer.id)
        const prop = properties.value.find(p => p.id === event.propertyId)
        const level = getBuildingLevel(event.propertyId, event.ownerId)
        const buyPrice = prop ? prop.price + prop.buildCost * level : 0
        const roll = Math.random()
        // hard 模式额外用 ROI 评估买地皮是否划算；easy/normal 仅按概率
        const shouldBuyLand = ai.getLevel() === 'hard' && prop
          ? ai.evaluateLandPurchase(prop, buyPrice, aiPlayer)
          : (roll < w.buyLand && aiPlayer.cash >= buyPrice + 2000)
        if (shouldBuyLand) {
          // 买地皮
          engine.buyPropertyFromPlayer(event.propertyId, aiPlayer.id, event.ownerId)
          syncState()
          lastEventMessage.value = `${aiPlayer.name} 向 ${event.ownerName} 购买了 ${prop?.name}`
        } else if (roll < w.buyLand + w.rent && aiPlayer.cash >= rent) {
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

  // ============ 四大海洋板块：计算属性 ============

  /** 生态指数状态 */
  const ecologyStatus = computed(() => {
    const ecoMgr = engine.getEcologyManager()
    return ecoMgr.getTier()
  })

  const ecologyIndex = computed(() => state.value.ecology.index)

  /** 装备列表 */
  const equipmentList = computed<EquipmentData[]>(() => engine.getEquipmentManager().getAll())

  /** 投资项目列表 */
  const investmentProjects = computed<InvestmentProject[]>(() => engine.getNuclearInvestManager().getAll())

  /** 获取装备已售状态 */
  function isEquipmentSold(equipId: string): boolean {
    return engine.getEquipmentManager().isSold(equipId)
  }

  /** 获取投资剩余份数 */
  function investmentRemaining(projectId: string): number {
    return engine.getNuclearInvestManager().remainingCopies(projectId)
  }

  /** 当前玩家重掷券数 */
  const reRollTickets = computed(() => currentPlayer.value?.reRollTickets ?? 0)

  /** 当前玩家是否能使用重掷券 */
  const canUseReRollTicket = computed(() => {
    const p = currentPlayer.value
    return p && !p.isAI && !p.bankrupt && (p.reRollTickets > 0) && state.value.phase === 'idle' && !pendingModal.value
  })

  /** 检查地产是否支持养殖 */
  function isAquacultureProperty(propertyId: string): boolean {
    return engine.getAquacultureManager().isAquacultureProperty(propertyId)
  }

  /** 获取地产的养殖等级 */
  function getAquacultureLevel(propertyId: string, playerId: number): number {
    const player = state.value.players.find(p => p.id === playerId)
    if (!player) return 0
    return player.aquaculture[propertyId]?.level ?? 0
  }

  // ============ 四大海洋板块：玩家操作 ============

  /** 购买装备 */
  function buyEquipment(equipId: string, soldAtPropertyId: string, boundPropertyId: string | null) {
    if (isOnlineMode.value) {
      sendOnlineAction('buyEquipment', { equipId, soldAtPropertyId, boundPropertyId })
      return true
    }
    const ok = engine.buyEquipment(equipId, soldAtPropertyId, boundPropertyId)
    if (ok) syncState()
    return ok
  }

  /** 拆卸装备 */
  function unequip(equipId: string) {
    if (isOnlineMode.value) {
      sendOnlineAction('unequip', { equipId })
      return true
    }
    const ok = engine.unequip(equipId)
    if (ok) syncState()
    return ok
  }

  /** 建造/升级养殖场 */
  function buildAquaculture(propertyId: string) {
    if (isOnlineMode.value) {
      sendOnlineAction('buildAquaculture', { propertyId })
      return true
    }
    const ok = engine.buildAquaculture(propertyId)
    if (ok) syncState()
    return ok
  }

  /** 拆除养殖场 */
  function demolishAquaculture(propertyId: string) {
    if (isOnlineMode.value) {
      sendOnlineAction('demolishAquaculture', { propertyId })
      return true
    }
    const ok = engine.demolishAquaculture(propertyId)
    if (ok) syncState()
    return ok
  }

  /** 投资核电/风电 */
  function investNuclear(projectId: string) {
    if (isOnlineMode.value) {
      sendOnlineAction('investNuclear', { projectId })
      return true
    }
    const ok = engine.investNuclear(projectId)
    if (ok) syncState()
    return ok
  }

  /** 使用重掷券 */
  function useReRollTicket() {
    if (!canUseReRollTicket.value) return false
    if (isOnlineMode.value) {
      sendOnlineAction('useReRollTicket')
      return true
    }
    const ok = engine.useReRollTicket()
    if (ok) syncState()
    return ok
  }

  /** 估算玩家总资产（含四大板块） */
  function estimateAssets(playerId: number) {
    const player = state.value.players.find(p => p.id === playerId)
    if (!player) return null
    return engine.estimatePlayerAssets(player)
  }

  // ============ 联机模式：发送 action 到服务端 ============
  // 联机模式下所有按钮点击都改为发 game:action，服务端处理后广播 game:state
  async function sendOnlineAction(action: string, params: any = {}) {
    const { onlineSDK } = await import('@/online/onlineSdk.js')
    return onlineSDK.sendGameAction(action, params)
  }

  // 联机版掷骰
  function onlineRollDice() {
    if (!canRollDice.value) return
    diceAnimating.value = true
    sendOnlineAction('roll')
  }

  // 联机版结束回合
  function onlineEndTurn() {
    sendOnlineAction('endTurn')
  }

  // 联机版购买地产
  function onlineBuy() {
    const event = pendingModal.value
    if (!event?.propertyId) return
    sendOnlineAction('buy', { propertyId: event.propertyId })
  }

  // 联机版放弃购买
  function onlineDeclineBuy() {
    sendOnlineAction('declineBuy')
  }

  // 联机版传送/移动
  function onlineTeleportTo(targetIndex: number) {
    sendOnlineAction('teleportTo', { targetIndex })
  }

  return {
    state,
    board,
    properties,
    colorGroups,
    isOnlineMode,
    onlineGameState,
    myPlayerId,
    isMyTurn,
    isMyPendingEvent,
    interactivePendingModal,
    playerLeftNotice,
    showPlayerLeftNotice,
    pendingModal,
    showTurnHandoff,
    showExitConfirm,
    showVictory,
    diceAnimating,
    lastEventMessage,
    currentPlayer,
    gameMode,
    isCurrentPlayerAI,
    canRollDice,
    canManageAssets,
    canSkipTurn,
    setOnlineMode,
    setOnlineGameState,
    setMyPlayerId,
    showRoomDisbanded,
    roomDisbandedMessage,
    notifyRoomDisbanded,
    dismissRoomDisbanded,
    playAgain,
    applyOnlineState,
    sendOnlineAction,
    onlineRollDice,
    onlineEndTurn,
    onlineBuy,
    onlineDeclineBuy,
    onlineTeleportTo,
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
    // ---- 四大海洋板块 ----
    showEquipmentModal,
    showAquacultureModal,
    showInvestModal,
    showEcologyDetail,
    activeEquipmentPropertyId,
    activeAquaculturePropertyId,
    ecologyStatus,
    ecologyIndex,
    equipmentList,
    investmentProjects,
    reRollTickets,
    canUseReRollTicket,
    isEquipmentSold,
    investmentRemaining,
    isAquacultureProperty,
    getAquacultureLevel,
    buyEquipment,
    unequip,
    buildAquaculture,
    demolishAquaculture,
    investNuclear,
    useReRollTicket,
    estimateAssets,
  }
})
