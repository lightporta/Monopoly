// 游戏主控制器：整合所有子系统，管理游戏状态与流程
// 四大海洋板块扩展：以"叠加"方式接入装备/养殖/核电/生态，不破坏原玩法逻辑。

import type {
  BoardCell,
  Card,
  ColorGroup,
  EcologyState,
  EquipmentData,
  GameConfig,
  GameEvent,
  GameState,
  GameMode,
  InvestmentProject,
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
import { EquipmentManager } from './Equipment'
import { AquacultureManager } from './Aquaculture'
import { NuclearInvestManager } from './NuclearInvest'
import { EcologyManager } from './Ecology'

import gameConfigData from '../data/game-config.json'
import boardData from '../data/board.json'
import propertiesData from '../data/properties.json'
import colorGroupsData from '../data/color-groups.json'
import cardsChanceData from '../data/cards-chance.json'
import cardsDestinyData from '../data/cards-destiny.json'
import cardsFoodData from '../data/cards-food.json'
import equipmentData from '../data/equipment.json'
import nuclearInvestmentsData from '../data/nuclear-investments.json'

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
  // ---- 四大海洋板块子系统 ----
  private equipmentManager: EquipmentManager
  private aquacultureManager: AquacultureManager
  private nuclearInvestManager: NuclearInvestManager
  private ecologyManager: EcologyManager
  private equipmentDataList: EquipmentData[]
  private investmentProjects: InvestmentProject[]

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

    // ---- 四大海洋板块子系统初始化 ----
    this.equipmentDataList = equipmentData as unknown as EquipmentData[]
    this.investmentProjects = (nuclearInvestmentsData as unknown as { projects: InvestmentProject[] }).projects

    this.state = this.createInitialState()
    this.equipmentManager = new EquipmentManager(
      this.equipmentDataList,
      this.properties,
      new Set(this.state.soldEquipmentIds)
    )
    this.aquacultureManager = new AquacultureManager(this.properties, this.config)
    this.nuclearInvestManager = new NuclearInvestManager(
      this.investmentProjects,
      this.state.soldInvestmentCopies
    )
    this.ecologyManager = new EcologyManager(this.config, this.state.ecology)
    // 回填装备管理器到租金计算器（避免循环依赖）
    this.rentCalculator.setEquipmentManager(this.equipmentManager)

    this.chanceDeck.shuffle()
    this.destinyDeck.shuffle()
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
      log: [],
      // ---- 四大海洋板块全局状态 ----
      ecology: { index: this.config.ecology.initial, turnsSinceLastEcoCard: 0 },
      soldEquipmentIds: [],
      soldInvestmentCopies: {}
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
      freeRentTickets: 0,
      // ---- 四大海洋板块玩家状态 ----
      equipment: [],
      aquaculture: {},
      investments: [],
      reRollTickets: 0
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
      log: [],
      ecology: { index: this.config.ecology.initial, turnsSinceLastEcoCard: 0 },
      soldEquipmentIds: [],
      soldInvestmentCopies: {}
    }
    this.extraTurnPending = false
    this.dice.resetStreak()
    this.chanceDeck.shuffle()
    this.destinyDeck.shuffle()

    // 重置四大海洋板块子系统状态
    this.ecologyManager.reset()
    this.equipmentManager = new EquipmentManager(
      this.equipmentDataList,
      this.properties,
      new Set(this.state.soldEquipmentIds)
    )
    this.nuclearInvestManager = new NuclearInvestManager(
      this.investmentProjects,
      this.state.soldInvestmentCopies
    )
    this.rentCalculator.setEquipmentManager(this.equipmentManager)

    this.addLog(`游戏开始，共 ${players.length} 名玩家，生态指数初始 ${this.config.ecology.initial}`)
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

  getEquipmentManager(): EquipmentManager {
    return this.equipmentManager
  }

  getAquacultureManager(): AquacultureManager {
    return this.aquacultureManager
  }

  getNuclearInvestManager(): NuclearInvestManager {
    return this.nuclearInvestManager
  }

  getEcologyManager(): EcologyManager {
    return this.ecologyManager
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

  /** 处理经过起点：+现金 + 抽美食卡 + 养殖场收益结算（四大板块） */
  private handlePassStart(player: Player): GameEvent {
    player.cash += this.config.start.passReward
    const food = this.foodCollector.drawOnPassStart(player)

    // ---- 四大板块：养殖场收益结算（受生态减益影响）----
    const tier = this.ecologyManager.getTier()
    const aquaResult = this.aquacultureManager.settleIncome(player, tier.aquaculturePenalty)
    let aquaLog = ''
    if (aquaResult.total > 0) {
      const detail = aquaResult.details.map((d) => `${d.name}+${d.income}`).join('，')
      aquaLog = `；🐚 养殖场收益 +${aquaResult.total}（${detail}）`
      this.addLog(`🐚 ${player.name} 经过起点，养殖场收益 +${aquaResult.total}`)
    }

    const event: GameEvent = {
      type: 'passStart',
      playerId: player.id,
      cellIndex: player.position,
      amount: this.config.start.passReward,
      message: `${player.name} 经过起点，获得 ${this.config.start.passReward}${
        food ? `，并抽取美食卡：${food.name}` : ''
      }${aquaLog}`
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

    // 他人地产：触发交易选择
    const data = this.propertyManager.getPropertyData(propertyId)
    const level = this.propertyManager.getBuildingLevel(propertyId, owner)
    const event: GameEvent = {
      type: 'landOpponentProperty',
      playerId: player.id,
      cellIndex: cell.index,
      propertyId,
      ownerId: owner.id,
      ownerName: owner.name,
      amount: data?.price ?? 0,
      buildCost: data?.buildCost ?? 0,
      buildingLevel: level,
      message: `${player.name} 到达 ${owner.name} 的地产 ${cell.name}`
    }
    this.state.pendingEvent = event
    this.addLog(event.message)
    return event
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
      // ---- 四大板块：清算装备卖回银行 ----
      if (visitor.cash < 0 && visitor.equipment.length > 0) {
        const refund = this.equipmentManager.liquidateAll(visitor)
        visitor.cash += refund
        if (refund > 0) this.addLog(`🛢️ ${visitor.name} 破产清算，装备卖回银行 +${refund}`)
      }
      if (visitor.cash < 0) {
        this.bankruptcyHandler.declareBankrupt(visitor)
        // 破产时投资归零、养殖场清除（由 declareBankrupt 处理）
        this.aquacultureManager.liquidateAll(visitor)
        this.nuclearInvestManager.liquidateAll(visitor)
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
      const bankrupt = this.liquidateForCardDebt(player)
      if (bankrupt) {
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
      const bankrupt = this.liquidateForCardDebt(player)
      if (bankrupt) {
        this.addLog(`${player.name} 因命运卡扣款破产`)
        this.checkVictory()
      }
    }
    return event
  }

  /**
   * 卡牌扣款触发的破产清算：先变卖建筑/抵押地产，再卖装备，仍不足则破产。
   * 返回 true 表示已宣告破产。
   */
  private liquidateForCardDebt(player: Player): boolean {
    if (player.cash >= 0) return false
    this.bankruptcyHandler.liquidate(player, -player.cash)
    // 四大板块：装备卖回银行
    if (player.cash < 0 && player.equipment.length > 0) {
      const refund = this.equipmentManager.liquidateAll(player)
      player.cash += refund
      if (refund > 0) this.addLog(`🛢️ ${player.name} 破产清算，装备卖回银行 +${refund}`)
    }
    if (player.cash < 0) {
      this.bankruptcyHandler.declareBankrupt(player)
      this.aquacultureManager.liquidateAll(player)
      this.nuclearInvestManager.liquidateAll(player)
      return true
    }
    return false
  }

  /**
   * 应用卡牌效果：
   * - cash：现金增减（原逻辑）
   * - 生态卡（category === 'ecology'）：触发生态指数变化 + 附加效果（赤潮/台风/核事故）
   * - 海洋监测船免疫：持有 EQ03 的玩家免疫台风/赤潮的负面效果
   */
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

    // ---- 四大板块：生态卡处理 ----
    if (card.category === 'ecology') {
      // 生态指数变化
      if (card.ecology) {
        const result = this.ecologyManager.applyCardDelta(card.ecology.delta)
        this.addLog(
          `🌿 生态指数 ${result.actualDelta > 0 ? '+' : ''}${result.actualDelta}（当前 ${result.newIndex}，${result.tier.label}）`
        )
      }

      // 附加效果（赤潮减益 / 台风降级 / 核事故）
      if (card.extraEffect) {
        const hasMonitorShip = this.equipmentManager.hasMonitorShip(player)
        switch (card.extraEffect.type) {
          case 'aquacultureDebuff': {
            // 赤潮：海洋监测船免疫
            if (hasMonitorShip) {
              this.addLog(`🛳️ ${player.name} 海洋监测船生效，免疫赤潮`)
            } else {
              const affected = this.aquacultureManager.applyRedTideDebuff(player)
              if (affected.length > 0) {
                this.addLog(`⚠️ ${player.name} 的养殖场（${affected.join('、')}）因赤潮收益减半 ${card.extraEffect.turns} 回合`)
              }
            }
            break
          }
          case 'aquacultureDowngrade': {
            // 台风：海洋监测船免疫
            if (hasMonitorShip) {
              this.addLog(`🛳️ ${player.name} 海洋监测船生效，免疫台风`)
            } else {
              const downgraded = this.aquacultureManager.applyTyphoonDowngrade(player)
              if (downgraded) {
                this.addLog(`⚠️ ${player.name} 的 ${downgraded} 养殖场因台风降级`)
              }
            }
            break
          }
          case 'nuclearAccident': {
            // 核事故：所有核电投资者付救援费 + 停发分红
            const results = this.nuclearInvestManager.triggerAccident(this.state.players, 'NUC1')
            for (const r of results) {
              if (r.fee > 0) {
                this.addLog(`☢️ 核事故！${r.player.name} 付 ${r.fee} 救援费，${r.projectName} 停发分红 ${r.stopTurns} 回合`)
              } else {
                this.addLog(`☢️ 核事故连锁！${r.player.name} 的 ${r.projectName} 停发分红 ${r.stopTurns} 回合`)
              }
            }
            break
          }
        }
      }
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

      // ---- 四大板块：集齐色块奖励重掷券 ----
      this.checkColorGroupCompleteAndReward(player, data.colorGroup)

      this.checkVictory() // 购买后可能触发铁三角胜利
    }
    return ok
  }

  /**
   * 检查玩家是否集齐某色块，若集齐则奖励重掷券（最多累积上限）。
   */
  private checkColorGroupCompleteAndReward(player: Player, groupId: string): void {
    const group = this.colorGroups.find((g) => g.id === groupId)
    if (!group) return
    const owned = group.propertyIds.filter((id) => player.properties.includes(id)).length
    const required = group.bonusRule.type === 'all'
      ? group.propertyIds.length
      : group.bonusRule.requiredCount
    if (owned === required) {
      const max = this.config.nuclear.reRollTicketsMax
      const reward = this.config.nuclear.reRollTicketOnColorGroupComplete
      const before = player.reRollTickets
      player.reRollTickets = Math.min(max, player.reRollTickets + reward)
      if (player.reRollTickets > before) {
        this.addLog(`🎫 ${player.name} 集齐 ${group.name}，奖励 ${player.reRollTickets - before} 张重掷券（当前 ${player.reRollTickets}）`)
      }
    }
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

  /** 拆房/卖房 */
  sellBuilding(propertyId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return false

    const ok = this.propertyManager.sellBuilding(propertyId, player)
    if (ok) {
      const refund = Math.floor(data.buildCost / 2)
      const level = this.propertyManager.getBuildingLevel(propertyId, player)
      this.addLog(`${player.name} 拆除 ${data.name} 的建筑，返还 ${refund}（当前${level}级）`)
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

  /** 计算购买他人地皮的总价（地价 + 建筑价值） */
  getBuyPropertyPrice(propertyId: string, ownerId: number): number {
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return 0
    const owner = this.state.players.find(p => p.id === ownerId)
    if (!owner) return 0
    const level = this.propertyManager.getBuildingLevel(propertyId, owner)
    return data.price + data.buildCost * level
  }

  /** 计算购买他人房屋的价格 */
  getBuyBuildingPrice(propertyId: string, ownerId: number): number {
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return 0
    const owner = this.state.players.find(p => p.id === ownerId)
    if (!owner) return 0
    const level = this.propertyManager.getBuildingLevel(propertyId, owner)
    return data.buildCost * level
  }

  /** 计算租赁价格（租金） */
  getRentPrice(propertyId: string, ownerId: number, visitorId: number): number {
    const owner = this.state.players.find(p => p.id === ownerId)
    const visitor = this.state.players.find(p => p.id === visitorId)
    if (!owner || !visitor) return 0
    return this.rentCalculator.calculate(propertyId, owner, visitor)
  }

  /** 玩家间购买地皮（含建筑） */
  buyPropertyFromPlayer(propertyId: string, buyerId: number, sellerId: number): boolean {
    const buyer = this.state.players.find(p => p.id === buyerId)
    const seller = this.state.players.find(p => p.id === sellerId)
    if (!buyer || !seller) return false
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return false
    if (!seller.properties.includes(propertyId)) return false

    const level = this.propertyManager.getBuildingLevel(propertyId, seller)
    const totalPrice = data.price + data.buildCost * level
    if (buyer.cash < totalPrice) return false

    buyer.cash -= totalPrice
    seller.cash += totalPrice
    seller.properties = seller.properties.filter(id => id !== propertyId)
    delete seller.buildings[propertyId]
    seller.mortgaged = seller.mortgaged.filter(id => id !== propertyId)
    buyer.properties.push(propertyId)
    buyer.buildings[propertyId] = level

    this.addLog(`${buyer.name} 以 ${totalPrice}（地价${data.price}+建筑${data.buildCost * level}）向 ${seller.name} 购买 ${data.name}`)
    return true
  }

  /** 玩家间购买房屋（不含地皮） */
  buyBuildingFromPlayer(propertyId: string, buyerId: number, sellerId: number): boolean {
    const buyer = this.state.players.find(p => p.id === buyerId)
    const seller = this.state.players.find(p => p.id === sellerId)
    if (!buyer || !seller) return false
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return false
    if (!seller.properties.includes(propertyId)) return false

    const level = this.propertyManager.getBuildingLevel(propertyId, seller)
    if (level === 0) return false

    const buildingPrice = data.buildCost * level
    if (buyer.cash < buildingPrice) return false

    buyer.cash -= buildingPrice
    seller.cash += buildingPrice
    seller.buildings[propertyId] = 0
    buyer.buildings[propertyId] = level

    this.addLog(`${buyer.name} 以 ${buildingPrice} 向 ${seller.name} 购买 ${data.name} 上的${level}级建筑`)
    return true
  }

  /** 玩家间租赁（付租金） — 含免租券消耗（与自动收租逻辑一致） */
  payRentToPlayer(propertyId: string, visitorId: number, ownerId: number): boolean {
    const visitor = this.state.players.find(p => p.id === visitorId)
    const owner = this.state.players.find(p => p.id === ownerId)
    if (!visitor || !owner) return false
    const data = this.propertyManager.getPropertyData(propertyId)
    if (!data) return false

    // 免租券优先消耗（与 payRent 自动收租一致）
    if (visitor.freeRentTickets > 0) {
      visitor.freeRentTickets -= 1
      this.addLog(`${visitor.name} 使用免租券，免付 ${owner.name} 的 ${data.name} 租金`)
      return true
    }

    const rent = this.rentCalculator.calculate(propertyId, owner, visitor)
    if (rent <= 0) return false
    if (visitor.cash < rent) return false

    visitor.cash -= rent
    owner.cash += rent

    this.addLog(`${visitor.name} 向 ${owner.name} 支付 ${data.name} 租金 ${rent}`)
    return true
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

  // ---------- 四大海洋板块：回合开始结算 ----------

  /**
   * 回合开始结算（在自己回合掷骰前调用）：
   * 1. 核电/风电分红入账（受生态危机减益）
   * 2. 海上风电塔被动收入（装备 EQ04）
   * 3. 生态优良补贴
   * 4. 维护：递减核电停发回合、养殖赤潮减益、生态自然恢复
   * 返回汇总日志条目数组。
   */
  settleTurnStart(): string[] {
    const logs: string[] = []
    const player = this.currentPlayer()
    if (!player || player.bankrupt) return logs

    const tier = this.ecologyManager.getTier()

    // 1. 核电/风电分红
    if (player.investments.length > 0) {
      const result = this.nuclearInvestManager.settleDividend(player, tier.nuclearDividendPenalty)
      if (result.total > 0) {
        player.cash += 0 // 已在 settleDividend 内入账
        const detail = result.details.map((d) => `${d.name}+${d.amount}`).join('，')
        const msg = `💼 ${player.name} 回合开始收投资分红 +${result.total}（${detail}）`
        logs.push(msg)
        this.addLog(msg)
      }
    }

    // 2. 海上风电塔被动收入（装备 EQ04）
    const passive = this.equipmentManager.getPassiveIncome(player)
    if (passive > 0) {
      player.cash += passive
      const msg = `⚡ ${player.name} 海上风电塔发电 +${passive}`
      logs.push(msg)
      this.addLog(msg)
    }

    // 3. 生态优良补贴（每回合所有玩家收，但此处只给当前玩家——按文档"每回合所有玩家"语义，
    //    实际上补贴应在每个玩家自己回合开始时收，所以这里正确）
    if (tier.subsidyPerTurn > 0) {
      player.cash += tier.subsidyPerTurn
      const msg = `🌿 ${player.name} 生态优良，收环保补贴 +${tier.subsidyPerTurn}`
      logs.push(msg)
      this.addLog(msg)
    }

    // 4. 维护
    this.nuclearInvestManager.tickStopTurns(player)
    this.aquacultureManager.tickDebuffs(player)
    const recovery = this.ecologyManager.tickNaturalRecovery()
    if (recovery.recovered > 0) {
      const msg = `🌿 生态自然恢复 +${recovery.recovered}（当前 ${recovery.newIndex}）`
      logs.push(msg)
      this.addLog(msg)
    }

    return logs
  }

  // ---------- 四大海洋板块：玩家操作 ----------

  /** 购买装备 */
  buyEquipment(equipId: string, soldAtPropertyId: string, boundPropertyId: string | null): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const result = this.equipmentManager.buy(equipId, player, soldAtPropertyId, boundPropertyId)
    if (result.ok) {
      const data = this.equipmentManager.getData(equipId)
      const boundName = boundPropertyId ? this.propertyMap.get(boundPropertyId)?.name : null
      const msg = `${data?.icon ?? '🛢️'} ${player.name} 购买装备：${data?.name}${
        boundName ? `，装配到 ${boundName}` : ''
      }${data?.effect.type === 'rentBoost' ? '，过路费 +30%' : ''}`
      this.addLog(msg)
      return true
    }
    this.addLog(`❌ ${result.message}`)
    return false
  }

  /** 拆卸装备 */
  unequip(equipId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const ok = this.equipmentManager.unequip(equipId, player)
    if (ok) {
      const data = this.equipmentManager.getData(equipId)
      this.addLog(`🔧 ${player.name} 拆卸装备：${data?.name ?? equipId}`)
    }
    return ok
  }

  /** 建造/升级养殖场 */
  buildAquaculture(propertyId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const result = this.aquacultureManager.buildOrUpgrade(propertyId, player)
    if (result.ok) {
      this.addLog(`🐚 ${player.name} ${result.message}，支付 ${result.cost}`)
      return true
    }
    this.addLog(`❌ ${result.message}`)
    return false
  }

  /** 拆除养殖场 */
  demolishAquaculture(propertyId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const result = this.aquacultureManager.demolish(propertyId, player)
    if (result.ok) {
      this.addLog(`🔧 ${player.name} ${result.message}`)
      return true
    }
    return false
  }

  /** 投资核电/风电 */
  investNuclear(projectId: string): boolean {
    const player = this.currentPlayer()
    if (!player) return false
    const result = this.nuclearInvestManager.invest(projectId, player)
    if (result.ok) {
      const data = this.nuclearInvestManager.getData(projectId)
      this.addLog(`💼 ${player.name} 投资 ${data?.name ?? projectId}，支付 ${data?.cost}`)
      return true
    }
    this.addLog(`❌ ${result.message}`)
    return false
  }

  /** 使用重掷券（标记本回合可再掷一次，不切换玩家） */
  useReRollTicket(): boolean {
    const player = this.currentPlayer()
    if (!player || player.reRollTickets <= 0) return false
    player.reRollTickets -= 1
    this.extraTurnPending = true
    this.addLog(`🎫 ${player.name} 使用重掷券，可再掷一次（剩余 ${player.reRollTickets} 张）`)
    return true
  }

  /** 获取玩家总资产（含四大板块估值） */
  estimatePlayerAssets(player: Player): {
    cash: number
    properties: number
    buildings: number
    aquaculture: number
    equipment: number
    investments: number
    total: number
  } {
    const propsValue = player.properties.reduce((sum, id) => {
      const p = this.propertyMap.get(id)
      return sum + (p?.price ?? 0)
    }, 0)
    const bldValue = player.properties.reduce((sum, id) => {
      const p = this.propertyMap.get(id)
      const lvl = player.buildings[id] ?? 0
      return sum + (p?.buildCost ?? 0) * lvl
    }, 0)
    const aquaValue = this.aquacultureManager.estimateValue(player)
    const equipValue = player.equipment.reduce((sum, e) => {
      const d = this.equipmentManager.getData(e.equipId)
      return sum + (d?.price ?? 0)
    }, 0)
    const invValue = this.nuclearInvestManager.estimateValue(player)
    const cash = player.cash
    const total = cash + propsValue + bldValue + aquaValue + equipValue + invValue
    return { cash, properties: propsValue, buildings: bldValue, aquaculture: aquaValue, equipment: equipValue, investments: invValue, total }
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
