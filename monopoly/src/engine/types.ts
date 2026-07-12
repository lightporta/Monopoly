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

export interface Card {
  id: string
  type: 'chance' | 'destiny'
  text: string
  effect: CardEffect
  icon: string
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
  | 'auction'
  | 'bankrupt'
  | 'victory'

export interface GameEvent {
  type: EventType
  playerId: number
  cellIndex: number
  propertyId?: string
  amount?: number
  card?: Card
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
}
