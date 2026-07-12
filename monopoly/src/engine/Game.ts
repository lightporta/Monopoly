// 游戏主控制器：整合所有子系统，管理游戏状态与流程

import type {
  BoardCell,
  Card,
  ColorGroup,
  GameConfig,
  GameEvent,
  GameState,
  GameMode,
  Player,
  PlayerConfig,
  Property
} from './types'
import { Dice } from './Dice'
import { Movement } from './Movement'
import { CardDeck } from './CardDeck'
import { PropertyManager } from './Property'
import { RentCalculator } from './RentCalculator'
import { FoodCollector } from './FoodCollector'
import type { FoodData, RedeemOption } from './FoodCollector'
import { BankruptcyHandler } from './Bankruptcy'
import { VictoryChecker } from './VictoryChecker'
import { AIPlayer } from './AIPlayer'

import gameConfigData from '../data/game-config.json'
import boardData from '../data/board.json'
import propertiesData from '../data/properties.json'
import colorGroupsData from '../data/color-groups.json'
import cardsChanceData from '../data/cards-chance.json'
import cardsDestinyData from '../data/cards-destiny.json'
import cardsFoodData from '../data/cards-food.json'

export class Game {
  // 静态数据
  private config: GameConfig
  private board: BoardCell[]
  private properties: Property[]
  private colorGroups: ColorGroup[]
  private propertyMap: Map<string, Property>
  private cellByIndex: Map<number, BoardCell>

  // 子系统
  private dice: Dice
  private movement: Movement
  private chanceDeck: CardDeck
  private destinyDeck: CardDeck
  private propertyManager: PropertyManager
  private rentCalculator: RentCalculator
  private foodCollector: FoodCollector
  private bankruptcyHandler: BankruptcyHandler
  private victoryChecker: VictoryChecker
  private aiPlayer: AIPlayer

  // 游戏状态
  private state: GameState
  private extraTurnPending: boolean = false

  constructor() {
    this.config = gameConfigData as unknown as GameConfig
    this.board = boardData as unknown as BoardCell[]
    this.properties = propertiesData as unknown as Property[]
    this.colorGroups = colorGroupsData as unknown as ColorGroup[]
    this.propertyMap = new Map(this.properties.map((p) => [p.id, p]))
    this.cellByIndex = new Map(this.board.map((c) => [c.index, c]))

    this.dice = new Dice()
    this.movement = new Movement()
    this.chanceDeck = new CardDeck(cardsChanceData as unknown as Card[])
    this.destinyDeck = new CardDeck(cardsDestinyData as unknown as Card[])
    this.propertyManager = new PropertyManager(
      this.properties,
      this.colorGroups,
      this.config
    )
    this.rentCalculator = new RentCalculator(
      this.properties,
      this.colorGroups,
      this.config,
      this.propertyManager
    )
    this.foodCollector = new FoodCollector(cardsFoodData as unknown as FoodData)
    this.bankruptcyHandler = new BankruptcyHandler(this.config, this.propertyManager)
    this.victoryChecker = new VictoryChecker(this.properties, this.config)
    this.aiPlayer = new AIPlayer('normal', this.propertyManager)

    this.chanceDeck.shuffle()
    this.destinyDeck.shuffle()

    this.state = this.createInitialState()
  }

  // ---------- 初始化 ----------

  private createInitialState(): GameState {
    return {
      players: [],
      currentPlayerIndex: 0,
      turnCount: 0,
      phase: 'idle',
      mode: 'pvp',
      lastDice: [0, 0],
      pendingEvent: null,
      winner: null,
      winReason: null,
      log: []
    }
  }

  /** 初始化新游戏 */
  init(mode: GameMode, playerConfigs: PlayerConfig[]): void {
    const players: Player[] = playerConfigs.map((cfg, i) => ({
      id: i,
      name: cfg.name,
      isAI: cfg.isAI,
      aiLevel: cfg.aiLevel,
      token: cfg.token,
      color: cfg.color,
      cash: this.config.player.initialCash,
      position: this.config.start.cellIndex,
      properties: [],
      buildings: {},
      mortgaged: [],
      foodCards: [],
      skipNextTurn: false,
      doublesStreak: 0,
      bankrupt: false,
      freeRentTickets: 0
    }))

    this.state = {
      players,
      currentPlayerIndex: 0,
      turnCount: 1,
      phase: 'idle',
      mode,
      lastDice: [0, 0],
      pendingEvent: null,
      winner: null,
      winReason: null,
      log: []
    }
    this.extraTurnPending = false
    this.dice.resetStreak()
    this.chanceDeck.shuffle()
    this.destinyDeck.shuffle()
    this.addLog(`游戏开始，共 ${players.length} 名玩家`)
  }

  // ---------- 公共属性访问 ----------

  getSnapshot(): GameState {
    return this.state
  }

  getBoard(): BoardCell[] {
    return this.board
  }

  getProperties(): Property[] {
    return this.properties
  }

  getColorGroups(): ColorGroup[] {
    return this.colorGroups
  }

  getPropertyManager(): PropertyManager {
    return this.propertyManager
  }

  getFoodCollector(): FoodCollector {
    return this.foodCollector
  }

  // ---------- 日志 ----------

  addLog(message: string): void {
    this.state.log.push(message)
    if (this.state.log.length > 300) {
      this.state.log.shift()
    }
  }

  // ---------- 内部辅助 ----------

  private currentPlayer(): Player | null {
    return this.state.players[this.state.currentPlayerIndex] ?? null
  }

  private getCell(index: number): BoardCell | undefined {
    return this.cellByIndex.get(index)
  }

  /** 处理经过起点：+现金 + 抽美食卡 */
  private handlePassStart(player: Player): GameEvent {
    player.cash += this.config.start.passReward
    const food = this.foodCollector.drawOnPassStart(player)
    const event: GameEvent = {
      type: 'passStart',
      playerId: player.id,
      cellIndex: player.position,
      amount: this.config.start.passReward,
      message: `${player.name} 经过起点，获得 ${this.config.start.passReward}${
        food ? `，并抽取美食卡：${food.name}` : ''
      }`
    }
    this.addLog(event.message)
    return event
  }

  // ---------- 掷骰子 ----------

  /**
   * 当前玩家掷骰子并移动。
   * - 双数：累加连击，连击 < limit 时本回合结束后可再掷
   * - 连击达到 limit：直接送至休息格，下回合跳过，无起点奖励
   * - 经过起点：+2000 + 抽美食卡
   */
  rollDice(): GameEvent {
    const player = this.currentPlayer()
    if (!player || player.bankrupt) {
      throw new Error('无可掷骰子的玩家')
    }
    if (this.state.phase === 'ended') {
      throw new Error('游戏已结束')
    }

    this.state.phase = 'rolling'
    this.state.pendingEvent = null

    const dice = this.dice.roll()
    this.state.lastDice = dice
    const isDoubles = Dice.isDoubles(dice)
    const steps = dice[0] + dice[1]

    if (isDoubles) {
      player.doublesStreak = this.dice.getStreak()
    } else {
      player.doublesStreak = 0
    }

    // 连续 3 次双数 → 送至休息格
    if (player.doublesStreak >= this.config.dice.doublesLimit) {
      const restCell = this.config.dice.doublesPenaltyCell
      player.position = restCell
      player.skipNextTurn = true
      player.doublesStreak = 0
      this.dice.resetStreak()
      this.extraTurnPending = false
      this.state.phase = 'event'
      const event: GameEvent = {
        type: 'skipNextTurn',
        playerId: player.id,
        cellIndex: restCell,
        message: `${player.name} 连掷 ${this.config.dice.doublesLimit} 次双数，被送至 ${
          this.getCell(restCell)?.name
        }，下回合跳过`
      }
      this.addLog(event.message)
      this.state.pendingEvent = event
      return event
    }

    // 正常移动
    const moveResult = this.movement.move(player.position, steps, this.board.length)
    player.position = moveResult.newPos

    let event: GameEvent
    if (moveResult.passedStart) {
      event = this.handlePassStart(player)
    } else {
      event = {
        type: 'passStart', // 复用作为"移动"事件标识（amount=0 表示无奖励）
        playerId: player.id,
        cellIndex: player.position,
        amount: 0,
        message: `${player.name} 掷出 ${dice[0]}+${dice[1]}=${steps}，移动到 ${
          this.getCell(player.position)?.name
        }`
      }
      this.addLog(event.message)
    }

    // 双数：标记可再掷一次（在 endTurn 时不切换玩家）
    this.extraTurnPending = isDoubles
    this.state.phase = 'moving'
    return event
  }

  // ---------- 落格事件处理 ----------

  /**
   * 处理当前玩家所在格子的事件。
   * 根据格子类型触发不同效果，返回对应 GameEvent。
   * 对于需要玩家选择的格子（anyEmpty/anyCell），设置 pendingEvent 等待 UI 调用 teleportTo。
   */
  handleCellEvent(): GameEvent {
    const player = this.currentPlayer()
    if (!player) throw new Error('无活跃玩家')
    const cell = this.getCell(player.position)
    if (!cell) throw new Error(`无效格子索引: ${player.position}`)

    this.state.phase = 'event'

    switch (cell.type) {
      case 'start':
        return this.eventLandStart(player, cell)
      case 'property':
        return this.eventProperty(player, cell)
      case 'chance':
        return this.eventChance(player, cell)
      case 'destiny':
        return this.eventDestiny(player, cell)
      case 'teleport':
        return this.eventTeleport(player, cell)
      case 'move':
        return this.eventMove(player, cell)
      case 'rest':
        return this.eventRest(player, cell)
      default:
        return {
          type: 'passStart',
          playerId: player.id,
          cellIndex: cell.index,
          amount: 0,
          message: `${player.name} 停在 ${cell.name}`
        }
    }
  }

  private eventLandStart(player: Player, cell: BoardCell): GameEvent {
    const event: GameEvent = {
      type: 'landStart',
      playerId: player.id,
      cellIndex: cell.index,
      message: `${player.name} 抵达起点 ${cell.name}`
    }
    this.addLog(event.message)
    return event
  }

  private eventProperty(player: Player, cell: BoardCell): GameEvent {
    const propertyId = cell.propertyRef
    if (!propertyId) {
      return {
        type: 'passStart',
        playerId: player.id,
        cellIndex: cell.index,
        amount: 0,
        message: `${cell.name} 无地产数据`
      }
    }

    const owner = this.propertyManager.getOwner(propertyId, this.state.players)

    // 无主：触发购买选项
    if (!owner) {
      const data = this.propertyManager.getPropertyData(propertyId)
      const event: GameEvent = {
        type: 'buyProperty',
        playerId: player.id,
        cellIndex: cell.index,
        propertyId,
        amount: data?.price,
        message: `${cell.name} 无主，可购买（价格 ${data?.price ?? '?'}）`
      }
      this.state.pendingEvent = event
      this.addLog(event.message)
      return event
    }

    // 自己的地产：无事件
    if (owner.id === player.id) {
      const event: GameEvent = {
        type: 'passStart',
        playerId: player.id,
        cellIndex: cell.index,
        amount: 0,
        message: `${player.name} 回到自己的地产 ${cell.name}`
      }
      this.addLog(event.message)
      return event
    }

    // 他人地产：付租金
    return this.payRent(player, owner, propertyId, cell)
  }

  private payRent(
    visitor: Player,
    owner: Player,
    propertyId: string,
    cell: BoardCell
  ): GameEvent {
    // 优先使用免租券
    if (visitor.freeRentTickets > 0) {
      visitor.freeRentTickets -= 1
      const event: GameEvent = {
        type: 'payRent',
        playerId: visitor.id,
        cellIndex: cell.index,
        propertyId,
        amount: 0,
        message: `${visitor.name} 使用免租券，免付 ${owner.name} 的租金`
      }
      this.addLog(event.message)
      return event
    }

    const rent = this.rentCalculator.calculate(propertyId, owner, visitor)
    if (rent <= 0) {
      const event: GameEvent = {
        type: 'payRent',
        playerId: visitor.id,
        cellIndex: cell.index,
        propertyId,
        amount: 0,
        message: `${owner.name} 的 ${cell.name} 已抵押，租金为 0`
      }
      this.addLog(event.message)
      return event
    }

    visitor.cash -= rent
    owner.cash += rent

    let message = `${visitor.name} 向 ${owner.name} 支付 ${cell.name} 租金 ${rent}`

    // 破产清算
    if (visitor.cash < 0) {
      const deficit = -visitor.cash
      this.bankruptcyHandler.liquidate(visitor, deficit)
      if (visitor.cash < 0) {
        this.bankruptcyHandler.declareBankrupt(visitor)
        message = `${visitor.name} 无法支付租金 ${rent}，宣告破产`
        const event: GameEvent = {
          type: 'bankrupt',
          playerId: visitor.id,
          cellIndex: cell.index,
          propertyId,
          amount: rent,
          message
        }
        this.addLog(message)
        this.checkVictory()
        return event
      }
      message = `${visitor.name} 变卖资产后支付 ${owner.name} 租金 ${rent}（剩余现金 ${visitor.cash}）`
    }

    const event: GameEvent = {
      type: 'payRent',
      playerId: visitor.id,
      cellIndex: cell.index,
      propertyId,
      amount: rent,
      message
    }
    this.addLog(message)
    return event
  }

  private eventChance(player: Player, cell: BoardCell): GameEvent {
    const card = this.chanceDeck.draw()
    if (!card) {
      return {
        type: 'drawChance',
        playerId: player.id,
        cellIndex: cell.index,
        message: '机会牌堆为空'
      }
    }
    this.applyCardEffect(player, card)
    const event: GameEvent = {
      type: 'drawChance',
      playerId: player.id,
      cellIndex: cell.index,
      card,
      amount: card.effect.amount,
      message: `${player.name} 抽取机会卡：${card.text}${
        card.effect.action === 'cash' && card.effect.amount
          ? `（${card.effect.amount > 0 ? '+' : ''}${card.effect.amount}）`
          : ''
      }`
    }
    this.addLog(event.message)

    // 现金变动可能触发破产
    if (player.cash < 0) {
      this.bankruptcyHandler.liquidate(player, -player.cash)
      if (player.cash < 0) {
        this.bankruptcyHandler.declareBankrupt(player)
        this.addLog(`${player.name} 因机会卡扣款破产`)
        this.checkVictory()
      }
    }
    return event
  }

  private eventDestiny(player: Player, cell: BoardCell): GameEvent {
    const card = this.destinyDeck.draw()
    if (!card) {
      return {
        type: 'drawDestiny',
        playerId: player.id,
        cellIndex: cell.index,
        message: '命运牌堆为空'
      }
    }
    this.applyCardEffect(player, card)
    const event: GameEvent = {
      type: 'drawDestiny',
      playerId: player.id,
      cellIndex: cell.index,
      card,
      amount: card.effect.amount,
      message: `${player.name} 抽取命运卡：${card.text}${
        card.effect.action === 'cash' && card.effect.amount
          ? `（${card.effect.amount > 0 ? '+' : ''}${card.effect.amount}）`
          : ''
      }`
    }
    this.addLog(event.message)

    if (player.cash < 0) {
      this.bankruptcyHandler.liquidate(player, -player.cash)
      if (player.cash < 0) {
        this.bankruptcyHandler.declareBankrupt(player)
        this.addLog(`${player.name} 因命运卡扣款破产`)
        this.checkVictory()
      }
    }
    return event
  }

  /** 应用卡牌效果（Demo 版仅实现现金效果） */
  private applyCardEffect(player: Player, card: Card): void {
    const effect = card.effect
    switch (effect.action) {
      case 'cash':
        if (effect.amount !== undefined) {
          player.cash += effect.amount
        }
        break
      case 'move':
      case 'moveRel':
      case 'teleport':
      case 'jail':
      case 'collectFood':
        // Demo 版暂不实现非现金效果
        break
    }
  }

  private eventTeleport(player: Player, cell: BoardCell): GameEvent {
    const tp = cell.teleport
    if (!tp) {
      return {
        type: 'passStart',
        playerId: player.id,
        cellIndex: cell.index,
        amount: 0,
        message: `${cell.name} 无传送配置`
      }
    }

    if (tp.mode === 'fixed' && tp.target !== undefined) {
      // 固定传送：直接移动，不触发起点奖励（按配置 passStart:false）
      player.position = tp.target
      this.addLog(`${player.name} 从 ${cell.name} 传送至 ${this.getCell(tp.target)?.name}`)
      // 递归处理目标格子事件
      return this.handleCellEvent()
    }

    if (tp.mode === 'anyEmpty') {
      const event: GameEvent = {
        type: 'teleportAnyEmpty',
        playerId: player.id,
        cellIndex: cell.index,
        message: `${player.name} 触发传送，请选择一个空地`
      }
      this.state.pendingEvent = event
      this.addLog(event.message)
      return event
    }

    // anyCell
    const event: GameEvent = {
      type: 'moveAnyCell',
      playerId: player.id,
      cellIndex: cell.index,
      message: `${player.name} 触发传送，请选择任意格子`
    }
    this.state.pendingEvent = event
    this.addLog(event.message)
    return event
  }

  private eventMove(player: Player, cell: BoardCell): GameEvent {
    if (cell.effect === 'reroll') {
      this.extraTurnPending = true
      const event: GameEvent = {
        type: 'reroll',
        playerId: player.id,
        cellIndex: cell.index,
        message: `${player.name} 在 ${cell.name} 触发再掷一次`
      }
      this.addLog(event.message)
      return event
    }

    if (cell.effect === 'anyCell') {
      const event: GameEvent = {
        type: 'moveAnyCell',
        playerId: player.id,
        cellIndex: cell.index,
        message: `${player.name} 在 ${cell.name} 可移动至任意格子`
      }
      this.state.pendingEvent = event
      this.addLog(event.message)
      return event
    }

    return {
      type: 'passStart',
      playerId: player.id,
      cellIndex: cell.index,
      amount: 0,
      message: `${player.name} 停在 ${cell.name}`
    }
  }

  private eventRest(player: Player, cell: BoardCell): GameEvent {
    player.skipNextTurn = true
    const event: GameEvent = {
      type: 'skipNextTurn',
      playerId: player.id,
      cellIndex: cell.index,
      message: `${player.name} 在 ${cell.name} 休息，下回合跳过`
    }
    this.addLog(event.message)
    return event
  }

  // ---------- 玩家操作 ----------

  /** 购买地产 */
  buyProperty(propertyId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return false

    const ok = this.propertyManager.buy(propertyId, player)
    if (ok) {
      this.addLog(`${player.name} 购买 ${data.name}，花费 ${data.price}（剩余 ${player.cash}）`)
      this.state.pendingEvent = null
      this.checkVictory() // 购买后可能触发铁三角胜利
    }
    return ok
  }

  /** 放弃购买（Demo 版不触发拍卖，直接继续） */
  declineBuy(): void {
    const player = this.currentPlayer()
    if (player) {
      this.addLog(`${player.name} 放弃购买`)
    }
    this.state.pendingEvent = null
  }

  /** 建房 / 升级旅馆 */
  buildHouse(propertyId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return false

    const level = this.propertyManager.getBuildingLevel(propertyId, player)
    let ok: boolean
    if (level >= 3) {
      ok = this.propertyManager.upgradeHotel(propertyId, player)
      if (ok) {
        this.addLog(`${player.name} 将 ${data.name} 升级为旅馆，花费 ${data.buildCost}`)
      }
    } else {
      ok = this.propertyManager.buildHouse(propertyId, player)
      if (ok) {
        this.addLog(
          `${player.name} 在 ${data.name} 建房至 ${level + 1} 级，花费 ${data.buildCost}`
        )
      }
    }
    return ok
  }

  /** 抵押地产 */
  mortgage(propertyId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return false

    const ok = this.propertyManager.mortgage(propertyId, player)
    if (ok) {
      const amount = Math.floor(data.price * this.config.economy.mortgageRatio)
      this.addLog(`${player.name} 抵押 ${data.name}，获得 ${amount}`)
    }
    return ok
  }

  /** 赎回地产 */
  redeem(propertyId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return false

    const ok = this.propertyManager.redeem(propertyId, player)
    if (ok) {
      const cost = Math.floor(
        data.price * this.config.economy.mortgageRatio * this.config.economy.redeemMultiplier
      )
      this.addLog(`${player.name} 赎回 ${data.name}，花费 ${cost}`)
    }
    return ok
  }

  /** 兑换美食卡组合 */
  redeemFood(option: RedeemOption): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const ok = this.foodCollector.redeem(player, option)
    if (ok) {
      if (option === 'cash') {
        this.addLog(`${player.name} 兑换美食组合，获得 2000 现金`)
      } else {
        this.addLog(`${player.name} 兑换美食组合，获得 1 张免租券`)
      }
    }
    return ok
  }

  /** 传送 / 移动至目标格子（用于 anyEmpty / anyCell 事件） */
  teleportTo(targetIndex: number): GameEvent {
    const player = this.currentPlayer()
    if (!player) throw new Error('无活跃玩家')
    if (targetIndex < 0 || targetIndex >= this.board.length) {
      throw new Error(`无效目标格子: ${targetIndex}`)
    }
    player.position = targetIndex
    this.state.pendingEvent = null
    this.addLog(`${player.name} 移动至 ${this.getCell(targetIndex)?.name}`)
    // 处理目标格子事件
    return this.handleCellEvent()
  }

  // ---------- 回合管理 ----------

  /** 结束当前玩家回合，切换至下一名玩家 */
  endTurn(): void {
    const player = this.currentPlayer()
    if (!player) return

    // 若游戏已结束，不再切换
    if (this.state.phase === 'ended') return

    // 若当前玩家可再掷一次（双数 / reroll 格），不切换
    if (this.extraTurnPending) {
      this.extraTurnPending = false
      this.state.phase = 'idle'
      this.state.pendingEvent = null
      return
    }

    // 重置连击
    this.dice.resetStreak()
    player.doublesStreak = 0

    // 切换至下一名玩家
    this.nextPlayer()
    this.state.phase = 'idle'
    this.state.pendingEvent = null
  }

  /** 切换至下一名非破产、非跳过玩家 */
  private nextPlayer(): void {
    const players = this.state.players
    if (players.length === 0) return

    let nextIdx = this.state.currentPlayerIndex
    for (let i = 0; i < players.length; i++) {
      nextIdx = (nextIdx + 1) % players.length
      const candidate = players[nextIdx]
      if (candidate.bankrupt) continue
      if (candidate.skipNextTurn) {
        candidate.skipNextTurn = false
        this.addLog(`${candidate.name} 跳过本回合`)
        continue
      }
      this.state.currentPlayerIndex = nextIdx
      this.state.turnCount++
      this.addLog(`轮到 ${candidate.name} 的回合（第 ${this.state.turnCount} 回合）`)
      return
    }

    // 全部玩家都跳过 / 破产的极端情况
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % players.length
  }

  // ---------- 胜利判定 ----------

  /** 检查胜利条件（铁三角 / 最后存活） */
  private checkVictory(): void {
    if (this.state.phase === 'ended') return

    const player = this.currentPlayer()
    if (player && this.victoryChecker.checkIronTriangle(player)) {
      this.state.winner = player
      this.state.winReason = '集齐铁三角：烟台山 + 蓬莱阁 + 养马岛'
      this.state.phase = 'ended'
      const event: GameEvent = {
        type: 'victory',
        playerId: player.id,
        cellIndex: player.position,
        message: `${player.name} 集齐铁三角，获得胜利！`
      }
      this.addLog(event.message)
      this.state.pendingEvent = event
      return
    }

    const winner = this.victoryChecker.checkBankruptcy(this.state.players)
    if (winner) {
      this.state.winner = winner
      this.state.winReason = '其他玩家全部破产'
      this.state.phase = 'ended'
      const event: GameEvent = {
        type: 'victory',
        playerId: winner.id,
        cellIndex: winner.position,
        message: `${winner.name} 成为最后存活的玩家，获得胜利！`
      }
      this.addLog(event.message)
      this.state.pendingEvent = event
    }
  }

  // ---------- AI 辅助 ----------

  /** 获取 AI 决策器 */
  getAIPlayer(): AIPlayer {
    return this.aiPlayer
  }
}
