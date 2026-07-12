// 地产管理模块：购买 / 建房 / 升级旅馆 / 抵押 / 赎回

import type {
  BuildingLevel,
  ColorGroup,
  GameConfig,
  Player,
  Property
} from './types'

/**
 * PropertyManager 负责对单个玩家地产状态的查询与变更。
 * 注意：所有变更方法直接修改传入的 player 对象。
 */
export class PropertyManager {
  private propertyMap: Map<string, Property>
  private colorGroupMap: Map<string, ColorGroup>
  private config: GameConfig

  constructor(properties: Property[], colorGroups: ColorGroup[], config: GameConfig) {
    this.propertyMap = new Map(properties.map((p) => [p.id, p]))
    this.colorGroupMap = new Map(colorGroups.map((g) => [g.id, g]))
    this.config = config
  }

  /** 查询某地产被哪个玩家拥有；未被任何玩家拥有时返回 null */
  getOwner(propertyId: string, players: Player[]): Player | null {
    for (const p of players) {
      if (p.properties.includes(propertyId)) return p
    }
    return null
  }

  /** 获取地产静态数据 */
  getPropertyData(propertyId: string): Property | undefined {
    return this.propertyMap.get(propertyId)
  }

  /** 获取某玩家在该地产上的建筑等级 */
  getBuildingLevel(propertyId: string, player: Player): BuildingLevel {
    return player.buildings[propertyId] ?? 0
  }

  /** 该地产是否已被该玩家抵押 */
  isMortgaged(propertyId: string, player: Player): boolean {
    return player.mortgaged.includes(propertyId)
  }

  /**
   * 购买地产：扣减现金、加入玩家地产列表、初始化建筑等级为 0。
   * 返回是否购买成功（现金不足或已拥有则失败）。
   */
  buy(propertyId: string, player: Player): boolean {
    const data = this.propertyMap.get(propertyId)
    if (!data) return false
    if (player.properties.includes(propertyId)) return false
    if (player.cash < data.price) return false

    player.cash -= data.price
    player.properties.push(propertyId)
    player.buildings[propertyId] = 0
    return true
  }

  /**
   * 建房：扣减 buildCost，building level +1，最大到 3。
   * 若已达到 3，则需调用 upgradeHotel 升级为旅馆。
   * 返回是否成功。
   */
  buildHouse(propertyId: string, player: Player): boolean {
    const data = this.propertyMap.get(propertyId)
    if (!data) return false
    if (!player.properties.includes(propertyId)) return false
    if (this.isMortgaged(propertyId, player)) return false

    const level = this.getBuildingLevel(propertyId, player)
    if (level >= 3) return false // 已达 3 级，需走 upgradeHotel

    const cost = data.buildCost
    if (player.cash < cost) return false

    player.cash -= cost
    player.buildings[propertyId] = (level + 1) as BuildingLevel
    return true
  }

  /**
   * 升级旅馆：仅当当前等级为 3 时可升级，扣减 buildCost 后置为 4。
   * 返回是否成功。
   */
  upgradeHotel(propertyId: string, player: Player): boolean {
    const data = this.propertyMap.get(propertyId)
    if (!data) return false
    if (!player.properties.includes(propertyId)) return false
    if (this.isMortgaged(propertyId, player)) return false

    const level = this.getBuildingLevel(propertyId, player)
    if (level !== 3) return false

    const cost = data.buildCost
    if (player.cash < cost) return false

    player.cash -= cost
    player.buildings[propertyId] = 4
    return true
  }

  /**
   * 拆房/卖房：降低一级建筑等级，返还 buildCost / 2 的现金。
   * 旅馆（等级4）降为3级，3级降为2级，依此类推。
   * 返回是否成功。
   */
  sellBuilding(propertyId: string, player: Player): boolean {
    const data = this.propertyMap.get(propertyId)
    if (!data) return false
    if (!player.properties.includes(propertyId)) return false
    if (this.isMortgaged(propertyId, player)) return false

    const level = this.getBuildingLevel(propertyId, player)
    if (level === 0) return false

    const refund = Math.floor(data.buildCost / 2)
    player.cash += refund
    player.buildings[propertyId] = (level - 1) as BuildingLevel
    return true
  }

  /**
   * 抵押地产：获得 price × mortgageRatio 的现金，加入 mortgaged 列表。
   * 抵押前不能有建筑（应由 liquidate 先卖建筑）。
   * 返回是否成功。
   */
  mortgage(propertyId: string, player: Player): boolean {
    const data = this.propertyMap.get(propertyId)
    if (!data) return false
    if (!player.properties.includes(propertyId)) return false
    if (this.isMortgaged(propertyId, player)) return false
    if (this.getBuildingLevel(propertyId, player) > 0) return false

    const amount = Math.floor(data.price * this.config.economy.mortgageRatio)
    player.cash += amount
    player.mortgaged.push(propertyId)
    return true
  }

  /**
   * 赎回地产：扣减 price × mortgageRatio × redeemMultiplier。
   * 返回是否成功。
   */
  redeem(propertyId: string, player: Player): boolean {
    const data = this.propertyMap.get(propertyId)
    if (!data) return false
    if (!this.isMortgaged(propertyId, player)) return false

    const cost = Math.floor(
      data.price * this.config.economy.mortgageRatio * this.config.economy.redeemMultiplier
    )
    if (player.cash < cost) return false

    player.cash -= cost
    player.mortgaged = player.mortgaged.filter((id) => id !== propertyId)
    return true
  }

  /**
   * 出售建筑：按 sellBuildingRatio × buildCost 折价回收，等级归 0。
   * 用于破产清算。返回实际回收金额。
   */
  sellBuildings(propertyId: string, player: Player): number {
    const data = this.propertyMap.get(propertyId)
    if (!data) return 0
    if (!player.properties.includes(propertyId)) return 0

    const level = this.getBuildingLevel(propertyId, player)
    if (level <= 0) return 0

    // 旅馆按 3 栋房屋 + 1 次升级成本估算回收
    const effectiveLevels = level === 4 ? 4 : level
    const refund = Math.floor(
      data.buildCost * effectiveLevels * this.config.economy.sellBuildingRatio
    )
    player.cash += refund
    player.buildings[propertyId] = 0
    return refund
  }

  /** 获取颜色组数据 */
  getColorGroup(groupId: string): ColorGroup | undefined {
    return this.colorGroupMap.get(groupId)
  }

  /** 获取所有颜色组 */
  getAllColorGroups(): ColorGroup[] {
    return Array.from(this.colorGroupMap.values())
  }
}
