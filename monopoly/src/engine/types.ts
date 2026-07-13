// 引擎层类型定义

export type CellType = 'start' | 'property' | 'chance' | 'destiny' | 'teleport' | 'move' | 'rest'

export type BuildingLevel = 0 | 1 | 2 | 3 | 4 // 0=空地, 1~3=房屋, 4=旅馆

export type GameMode = 'pvp' | 'pve'

export type AILevel = 'easy' | 'normal' | 'hard'

export type GamePhase = 'idle' | 'rolling' | 'moving' | 'event' | 'ended'

export interface TeleportConfig {
  mode: 'fixed' | 'anyEmpty' | 'anyCell'
  target?: number
  passStart: boolean
}

export interface BoardCell {
  index: number
  name: string
  type: CellType
  icon?: string
  colorGroup?: string
  propertyRef?: string
  teleport?: TeleportConfig
  effect?: 'reroll' | 'skipNextTurn' | 'anyCell'
}

export interface Property {
  id: string
  name: string
  colorGroup: string
  price: number
  baseRent: number
  buildCost: number
  rentByLevel: {
    empty: number
    house1: number
    house2: number
    house3: number
    hotel: number
  }
  /** 海产养殖配置（仅 4 处养殖地产有） */
  aquaculture?: AquacultureConfig
}

/** 养殖场静态配置（写在 properties.json 中） */
export interface AquacultureConfig {
  enabled: boolean
  specialty: string // 特产（海参/扇贝/海带/鲍鱼）
  levels: AquacultureLevelConfig[]
}

export interface AquacultureLevelConfig {
  name: string // 育苗场 / 养殖场 / 深海牧场
  cost: number
  income: number // 每经过起点收益
}

export interface ColorGroup {
  id: string
  name: string
  color: string
  icon: string
  propertyIds: string[]
  bonusRule: {
    type: 'all' | 'count'
    requiredCount: number
    rentMultiplier: number
  }
}

export interface CardEffect {
  action: 'cash' | 'move' | 'moveRel' | 'teleport' | 'jail' | 'collectFood'
  amount?: number
  target?: number
  steps?: number
}

/** 卡牌附带的生态/养殖/核电等扩展效果 */
export interface CardExtraEffect {
  type: 'aquacultureDebuff' | 'aquacultureDowngrade' | 'nuclearAccident'
  turns?: number // 减益持续回合（aquacultureDebuff / nuclearAccident 的 stopTurns）
  factor?: number // 收益系数（如 0.5 = -50%）
  count?: number // 降级数量（aquacultureDowngrade）
  fee?: number // 救援费（nuclearAccident）
  stopTurns?: number // 停发分红回合（nuclearAccident）
}

/** 卡牌的生态指数影响（生态卡专用） */
export interface CardEcologyEffect {
  delta: number
}

export interface Card {
  id: string
  type: 'chance' | 'destiny'
  text: string
  effect: CardEffect
  icon: string
  /** 生态主题卡的分类标记 */
  category?: 'ecology'
  /** 生态指数变化 */
  ecology?: CardEcologyEffect
  /** 附加效果（赤潮减益 / 台风降级 / 核事故） */
  extraEffect?: CardExtraEffect
}

// ---------- 四大海洋板块类型 ----------

/** 装备定义（equipment.json） */
export interface EquipmentData {
  id: string
  name: string
  icon: string
  description: string
  price: number
  sellPrice: number
  effect:
    | { type: 'rentBoost'; target: 'property'; colorGroup: string; multiplier: number }
    | { type: 'immuneCard'; cardKeywords: string[] }
    | { type: 'passiveIncome'; amount: number; perTurn: boolean }
  /** 该装备在哪个格子（地标）出售 */
  soldAtCell: number
}

/** 玩家持有的装备实例 */
export interface OwnedEquipment {
  equipId: string
  /** 装配到的地产 id（rentBoost 类必填）；immuneCard/passiveIncome 类为 null（全局生效） */
  boundPropertyId: string | null
}

/** 养殖场运行时状态（挂在玩家名下的某地产上） */
export interface AquacultureState {
  propertyId: string
  level: number // 0=未建, 1=育苗场, 2=养殖场, 3=深海牧场
  incomeDebuffTurns: number // 赤潮减益剩余回合
  debuffFactor: number // 减益系数（1=正常，0.5=-50%）
}

/** 核电/风电投资项目定义（nuclear-investments.json） */
export interface InvestmentProject {
  id: string
  name: string
  icon: string
  description: string
  cost: number
  dividendPerTurn: number
  maxCopies: number
  accidentStopTurns: number
  accidentFee: number
  chainEffect: string[]
  riskEventId?: string | null
}

/** 玩家的投资持仓 */
export interface OwnedInvestment {
  projectId: string
  /** 停发分红的剩余回合（核事故后 > 0） */
  stopDividendTurns: number
}

/** 全局生态指数运行时状态 */
export interface EcologyState {
  index: number // 0~100
  /** 距上次生态卡抽取的回合数（用于自然恢复） */
  turnsSinceLastEcoCard: number
}

export interface FoodItem {
  id: string
  name: string
  icon: string
}

export interface Player {
  id: number
  name: string
  isAI: boolean
  aiLevel?: AILevel
  token: string
  color: string
  cash: number
  position: number
  properties: string[]
  buildings: Record<string, BuildingLevel>
  mortgaged: string[]
  foodCards: string[]
  skipNextTurn: boolean
  doublesStreak: number
  bankrupt: boolean
  freeRentTickets: number
  // ---- 四大海洋板块扩展 ----
  /** 海工装备（EQ01~EQ04），每件装备一条 */
  equipment: OwnedEquipment[]
  /** 养殖场状态：propertyId → 状态（仅建有养殖的地产） */
  aquaculture: Record<string, AquacultureState>
  /** 投资持仓（核电/风电） */
  investments: OwnedInvestment[]
  /** 重掷券（集齐色块奖励，最多 3 张） */
  reRollTickets: number
}

export interface PlayerConfig {
  name: string
  isAI: boolean
  aiLevel?: AILevel
  token: string
  color: string
}

export type EventType =
  | 'buyProperty'
  | 'payRent'
  | 'drawChance'
  | 'drawDestiny'
  | 'teleportFixed'
  | 'teleportAnyEmpty'
  | 'moveAnyCell'
  | 'reroll'
  | 'skipNextTurn'
  | 'passStart'
  | 'landStart'
  | 'foodRedeem'
  | 'landOpponentProperty'
  | 'auction'
  | 'bankrupt'
  | 'victory'
  // ---- 四大海洋板块事件 ----
  | 'buyEquipment'
  | 'unequip'
  | 'buildAquaculture'
  | 'demolishAquaculture'
  | 'aquacultureIncome'
  | 'investNuclear'
  | 'nuclearDividend'
  | 'nuclearAccident'
  | 'ecologyChange'
  | 'useReRollTicket'

export interface GameEvent {
  type: EventType
  playerId: number
  cellIndex: number
  propertyId?: string
  amount?: number
  card?: Card
  ownerId?: number
  ownerName?: string
  buildCost?: number
  buildingLevel?: number
  message: string
}

export interface GameState {
  players: Player[]
  currentPlayerIndex: number
  turnCount: number
  phase: GamePhase
  mode: GameMode
  lastDice: [number, number]
  pendingEvent: GameEvent | null
  winner: Player | null
  winReason: string | null
  log: string[]
  // ---- 四大海洋板块全局状态 ----
  /** 全局生态指数 */
  ecology: EcologyState
  /** 已售出的装备 id 集合（每装备每局限 1 件） */
  soldEquipmentIds: string[]
  /** 投资项目的已售份数：projectId → 已售数 */
  soldInvestmentCopies: Record<string, number>
}

export interface GameConfig {
  version: string
  theme: string
  player: {
    minCount: number
    maxCount: number
    initialCash: number
  }
  dice: {
    count: number
    doublesLimit: number
    doublesPenaltyCell: number
  }
  start: {
    cellIndex: number
    passReward: number
  }
  economy: {
    buildCostRatio: number
    mortgageRatio: number
    redeemMultiplier: number
    sellBuildingRatio: number
    auctionStartRatio: number
    auctionMinStep: number
  }
  rentMultipliers: {
    empty: number
    house1: number
    house2: number
    house3: number
    hotel: number
  }
  victory: {
    ironTriangle: string[]
  }
  ecology: {
    initial: number
    min: number
    max: number
    naturalRecoveryTurns: number
    naturalRecoveryAmount: number
  }
  equipment: {
    price: number
    sellRatio: number
    rentBoostMultiplier: number
  }
  aquaculture: {
    demolishRefundRatio: number
    debuffTurnsOnRedTide: number
    debuffFactor: number
  }
  nuclear: {
    reRollTicketsMax: number
    reRollTicketOnColorGroupComplete: number
  }
}
