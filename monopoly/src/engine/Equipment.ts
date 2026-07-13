// 海工装备系统：购买 / 拆卸 / 装备效果查询
// 装备绑定到玩家自己拥有的、且色块匹配的地产上，获得持续增益。
// 核心铁律：装备加成以乘法叠加到过路费公式末尾，不修改原色块/建筑系数。

import type { EquipmentData, OwnedEquipment, Player, Property } from './types'

export interface BuyResult {
  ok: boolean
  message: string
}

export class EquipmentManager {
  private equipmentData: EquipmentData[]
  private equipmentMap: Map<string, EquipmentData>
  private propertyMap: Map<string, Property>
  private soldEquipmentIds: Set<string>

  constructor(equipmentData: EquipmentData[], properties: Property[], soldEquipmentIds: Set<string>) {
    this.equipmentData = equipmentData
    this.equipmentMap = new Map(equipmentData.map((e) => [e.id, e]))
    this.propertyMap = new Map(properties.map((p) => [p.id, p]))
    this.soldEquipmentIds = soldEquipmentIds
  }

  getAll(): EquipmentData[] {
    return this.equipmentData
  }

  getData(equipId: string): EquipmentData | undefined {
    return this.equipmentMap.get(equipId)
  }

  /** 查询某格出售的装备 */
  getBySoldCell(cellIndex: number): EquipmentData | undefined {
    return this.equipmentData.find((e) => e.soldAtCell === cellIndex)
  }

  /** 该装备是否已被任一玩家购买（每装备每局限 1 件） */
  isSold(equipId: string): boolean {
    return this.soldEquipmentIds.has(equipId)
  }

  /**
   * 购买装备：
   * 1. 玩家必须拥有供应点地标
   * 2. 装备未售出
   * 3. 资金充足
   * 4. rentBoost 类必须装配到玩家拥有的同色块地产
   */
  buy(
    equipId: string,
    player: Player,
    soldAtPropertyId: string,
    boundPropertyId: string | null
  ): BuyResult {
    const data = this.equipmentMap.get(equipId)
    if (!data) return { ok: false, message: '装备不存在' }
    if (this.isSold(equipId)) return { ok: false, message: `${data.name} 已被购买` }

    // 必须拥有供应点地产
    if (!player.properties.includes(soldAtPropertyId)) {
      const p = this.propertyMap.get(soldAtPropertyId)
      return { ok: false, message: `需先拥有 ${p?.name ?? '该地标'} 才能购买 ${data.name}` }
    }

    if (player.cash < data.price) return { ok: false, message: '资金不足' }

    // rentBoost 类：必须装配到自己拥有的同色块地产
    if (data.effect.type === 'rentBoost') {
      if (!boundPropertyId) return { ok: false, message: '需选择装配目标地产' }
      const target = this.propertyMap.get(boundPropertyId)
      if (!target) return { ok: false, message: '目标地产不存在' }
      if (!player.properties.includes(boundPropertyId)) {
        return { ok: false, message: `只能装配到自己拥有的地产（${target.name} 不属于你）` }
      }
      if (target.colorGroup !== data.effect.colorGroup) {
        return {
          ok: false,
          message: `${data.name} 仅适用于 ${data.effect.colorGroup === 'coast' ? '海岸线' : '仙山'} 色块地产`,
        }
      }
    }

    player.cash -= data.price
    player.equipment.push({
      equipId,
      boundPropertyId: data.effect.type === 'rentBoost' ? boundPropertyId : null,
    })
    this.soldEquipmentIds.add(equipId)
    return { ok: true, message: '购买成功' }
  }

  /** 拆卸装备（免费），装备回到玩家手中暂存（仍归属该玩家，效果对全局/原地产生效） */
  unequip(equipId: string, player: Player): boolean {
    const idx = player.equipment.findIndex((e) => e.equipId === equipId)
    if (idx < 0) return false
    // 拆卸后保留装备，但解除地产绑定（rentBoost 类失去具体目标 → 视为暂存，不加成）
    player.equipment[idx].boundPropertyId = null
    return true
  }

  /**
   * 计算某地产的装备加成倍率（用于过路费公式末尾）。
   * 同一地产若被多件装备影响，取最高倍率（不累乘）。
   * 返回 1.0 表示无加成。
   */
  getRentBoostMultiplier(propertyId: string, owner: Player): number {
    const prop = this.propertyMap.get(propertyId)
    if (!prop) return 1.0
    let best = 1.0
    for (const owned of owner.equipment) {
      if (owned.boundPropertyId !== propertyId) continue
      const data = this.equipmentMap.get(owned.equipId)
      if (!data) continue
      if (data.effect.type === 'rentBoost' && data.effect.colorGroup === prop.colorGroup) {
        if (data.effect.multiplier > best) best = data.effect.multiplier
      }
    }
    return best
  }

  /** 玩家是否持有海洋监测船（免疫台风/赤潮） */
  hasMonitorShip(player: Player): boolean {
    return player.equipment.some((e) => e.equipId === 'EQ03')
  }

  /** 玩家每回合应得的电力分红（海上风电塔） */
  getPassiveIncome(player: Player): number {
    let total = 0
    for (const owned of player.equipment) {
      const data = this.equipmentMap.get(owned.equipId)
      if (data?.effect.type === 'passiveIncome' && data.effect.perTurn) {
        total += data.effect.amount
      }
    }
    return total
  }

  /** 破产清算：装备按 sellPrice（50%）卖回银行 */
  liquidateAll(player: Player): number {
    let refund = 0
    for (const owned of player.equipment) {
      const data = this.equipmentMap.get(owned.equipId)
      if (data) refund += data.sellPrice
    }
    player.equipment = []
    return refund
  }
}
