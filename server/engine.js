// 服务端游戏引擎 V3 — 游戏规则权威（含四大海洋板块）
// 与前端 monopoly/src/engine/ 逻辑一致，移植四板块 + 玩家间交易 + 重掷券 + 生态指数。
import { gameConfig, board, properties, colorGroups, chanceCards, destinyCards, foodItems, equipmentData, investmentProjects, createPlayer, shuffleArray } from './data.js';

export class GameEngine {
  constructor() {
    this.state = null;
    this.chanceDeck = [];
    this.destinyDeck = [];
    this.chanceIndex = 0;
    this.destinyIndex = 0;
    this.log = [];
    // 四大海洋板块运行时
    this.soldEquipmentIds = new Set();
    this.soldInvestmentCopies = {};
    this.extraTurnPending = false;
  }

  initGame(playersConfig) {
    const players = playersConfig.map((p, i) => createPlayer(i, p.name, false, 'normal'));
    this.state = {
      players,
      currentPlayerIndex: 0,
      turnCount: 1,
      phase: 'idle',
      mode: 'pvp',
      lastDice: [0, 0],
      pendingEvent: null,
      winner: null,
      winReason: null,
      log: [],
      // 四大海洋板块全局状态
      ecology: { index: gameConfig.ecology.initial, turnsSinceLastEcoCard: 0 },
      soldEquipmentIds: [],
      soldInvestmentCopies: {}
    };
    this.chanceDeck = shuffleArray(chanceCards);
    this.destinyDeck = shuffleArray(destinyCards);
    this.chanceIndex = 0;
    this.destinyIndex = 0;
    this.log = [];
    this.soldEquipmentIds = new Set();
    this.soldInvestmentCopies = {};
    this.extraTurnPending = false;
    this.addLog(`游戏开始！${players.length} 位玩家，生态指数初始 ${gameConfig.ecology.initial}`);
    return this.getState();
  }

  getState() {
    // 同步四板块全局状态到 state（供前端读取）
    if (this.state) {
      this.state.soldEquipmentIds = Array.from(this.soldEquipmentIds);
      this.state.soldInvestmentCopies = { ...this.soldInvestmentCopies };
    }
    return JSON.parse(JSON.stringify(this.state));
  }

  addLog(msg) {
    this.log.push(msg);
    if (this.state) this.state.log = [...this.log];
  }

  // ============ 回合开始结算（四板块） ============
  settleTurnStart(playerIndex) {
    const player = this.state.players[playerIndex];
    if (!player || player.bankrupt) return;
    const tier = this.getEcologyTier();

    // 1. 核电/风电分红
    if (player.investments.length > 0) {
      let total = 0;
      const details = [];
      for (const inv of player.investments) {
        const proj = investmentProjects.find(p => p.id === inv.projectId);
        if (!proj || inv.stopDividendTurns > 0) continue;
        let amount = Math.floor(proj.dividendPerTurn * tier.nuclearDividendPenalty);
        player.cash += amount;
        total += amount;
        details.push(`${proj.name}+${amount}`);
      }
      if (total > 0) this.addLog(`💼 ${player.name} 回合开始收投资分红 +${total}（${details.join('，')}）`);
    }

    // 2. 海上风电塔被动收入
    let passive = 0;
    for (const eq of player.equipment) {
      const data = equipmentData.find(e => e.id === eq.equipId);
      if (data && data.effect.type === 'passiveIncome' && data.effect.perTurn) passive += data.effect.amount;
    }
    if (passive > 0) {
      player.cash += passive;
      this.addLog(`⚡ ${player.name} 海上风电塔发电 +${passive}`);
    }

    // 3. 生态优良补贴
    if (tier.subsidyPerTurn > 0) {
      player.cash += tier.subsidyPerTurn;
      this.addLog(`🌿 ${player.name} 生态优良，收环保补贴 +${tier.subsidyPerTurn}`);
    }

    // 4. 维护：核电停发递减、养殖赤潮递减、生态自然恢复
    for (const inv of player.investments) {
      if (inv.stopDividendTurns > 0) inv.stopDividendTurns--;
    }
    for (const propId of Object.keys(player.aquaculture)) {
      const aq = player.aquaculture[propId];
      if (aq.incomeDebuffTurns > 0) {
        aq.incomeDebuffTurns--;
        if (aq.incomeDebuffTurns === 0) aq.debuffFactor = 1;
      }
    }
    this.state.ecology.turnsSinceLastEcoCard++;
    if (this.state.ecology.turnsSinceLastEcoCard >= gameConfig.ecology.naturalRecoveryTurns) {
      const before = this.state.ecology.index;
      this.state.ecology.index = Math.min(gameConfig.ecology.max, this.state.ecology.index + gameConfig.ecology.naturalRecoveryAmount);
      if (this.state.ecology.index > before) {
        this.addLog(`🌿 生态自然恢复 +${this.state.ecology.index - before}（当前 ${this.state.ecology.index}）`);
      }
      this.state.ecology.turnsSinceLastEcoCard = 0;
    }

    // 资产胜利是独立条件，分红/补贴/被动收入增加资产后需检查
    this.checkAllVictory();
  }

  getEcologyTier() {
    const idx = this.state.ecology.index;
    if (idx >= 80) return { status: 'good', label: '生态优良', subsidyPerTurn: 200, aquaculturePenalty: 0, nuclearDividendPenalty: 1.0 };
    if (idx >= 50) return { status: 'normal', label: '生态正常', subsidyPerTurn: 0, aquaculturePenalty: 0, nuclearDividendPenalty: 1.0 };
    if (idx >= 20) return { status: 'warning', label: '生态预警', subsidyPerTurn: 0, aquaculturePenalty: 0.3, nuclearDividendPenalty: 1.0 };
    return { status: 'crisis', label: '生态危机', subsidyPerTurn: 0, aquaculturePenalty: 0.6, nuclearDividendPenalty: 0.5 };
  }

  // ============ 掷骰子 ============
  rollDice(playerIndex) {
    if (playerIndex !== this.state.currentPlayerIndex) return { error: '不是你的回合' };
    const player = this.state.players[playerIndex];
    if (player.bankrupt) return { error: '已破产' };

    // 先结算回合开始（四板块）
    this.settleTurnStart(playerIndex);

    if (player.skipNextTurn) {
      player.skipNextTurn = false;
      this.addLog(`${player.name} 跳过本回合`);
      this.nextTurn();
      return { state: this.getState(), skipped: true };
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    this.state.lastDice = [d1, d2];
    const isDouble = d1 === d2;

    if (isDouble) {
      player.doublesStreak++;
      if (player.doublesStreak >= gameConfig.dice.doublesLimit) {
        player.doublesStreak = 0;
        player.position = gameConfig.dice.doublesPenaltyCell;
        player.skipNextTurn = true;
        this.addLog(`${player.name} 连续三次双数，送至养马岛跨海大桥！`);
        this.nextTurn();
        return { state: this.getState(), tripleDoubles: true };
      }
    } else {
      player.doublesStreak = 0;
    }

    const steps = d1 + d2;
    this.movePlayer(playerIndex, steps);
    const cell = board[player.position];
    const event = this.handleCellLanding(playerIndex, cell);

    // 双数可再掷（不切回合）；重掷券在 useReRollTicket action 处理
    this.extraTurnPending = isDouble && this.state.phase !== 'ended';
    // 仅在没有待处理交互事件且非双数时才切换回合（与单机 Game.ts 一致）
    // 若落格产生了 pendingEvent（购买/租房/传送/抽卡），需等玩家通过 buy/decline/payRent 解决后
    // 由 endTurn 触发 nextTurn，避免 currentPlayerIndex 已切换但 pendingEvent 还引用旧玩家
    if (!isDouble && !this.state.pendingEvent && this.state.phase !== 'ended') {
      this.nextTurn();
    }

    // V3.4：过起点奖励/养殖收益/收租/卡牌都可能触发资产胜利，统一检查
    this.checkAllVictory();

    return { state: this.getState(), dice: [d1, d2], isDouble, event };
  }

  movePlayer(playerIndex, steps) {
    const player = this.state.players[playerIndex];
    const oldPos = player.position;
    const newPos = (oldPos + steps + board.length) % board.length;
    const passStart = steps > 0 && newPos <= oldPos && oldPos + steps >= board.length;

    if (passStart) {
      player.cash += gameConfig.start.passReward;
      this.addLog(`${player.name} 经过起点，获得 ¥${gameConfig.start.passReward}`);
      this.drawFoodCard(playerIndex);
      // 四板块：养殖场收益结算
      this.settleAquacultureIncome(playerIndex);
    }
    player.position = newPos;
  }

  // 养殖场收益结算（过起点时）
  settleAquacultureIncome(playerIndex) {
    const player = this.state.players[playerIndex];
    const tier = this.getEcologyTier();
    let total = 0;
    for (const propId of Object.keys(player.aquaculture)) {
      const aq = player.aquaculture[propId];
      if (!aq || aq.level === 0) continue;
      const prop = properties[propId];
      if (!prop || !prop.aquaculture) continue;
      let income = prop.aquaculture.levels[aq.level - 1].income;
      income = Math.floor(income * (1 - tier.aquaculturePenalty));
      if (aq.incomeDebuffTurns > 0) income = Math.floor(income * aq.debuffFactor);
      player.cash += income;
      total += income;
    }
    if (total > 0) this.addLog(`🐚 ${player.name} 经过起点，养殖场收益 +${total}`);
  }

  drawFoodCard(playerIndex) {
    const foodIds = Object.keys(foodItems);
    const randomFood = foodIds[Math.floor(Math.random() * foodIds.length)];
    const player = this.state.players[playerIndex];
    if (!player.foodCards.includes(randomFood)) {
      player.foodCards.push(randomFood);
      this.addLog(`${player.name} 抽到美食卡：${foodItems[randomFood].name}`);
    }
  }

  handleCellLanding(playerIndex, cell) {
    const player = this.state.players[playerIndex];
    this.addLog(`${player.name} 到达 ${cell.name}`);

    switch (cell.type) {
      case 'property':
        return this.handlePropertyCell(playerIndex, cell);
      case 'chance':
        return this.handleChanceCell(playerIndex);
      case 'destiny':
        return this.handleDestinyCell(playerIndex);
      case 'teleport':
        return this.handleTeleportCell(playerIndex, cell);
      case 'move':
        return this.handleMoveCell(playerIndex, cell);
      case 'rest':
        return this.handleRestCell(playerIndex, cell);
      case 'start':
        return { type: 'start', cellIndex: cell.index };
      default:
        return null;
    }
  }

  handlePropertyCell(playerIndex, cell) {
    const prop = properties[cell.propertyRef];
    if (!prop) return null;
    const player = this.state.players[playerIndex];
    const owner = this.findPropertyOwner(prop.id);

    if (!owner) {
      // 无主：设置 pendingEvent 等待玩家决定买/放弃
      this.state.phase = 'event';
      this.state.pendingEvent = { type: 'buyProperty', playerId: playerIndex, propertyId: prop.id, price: prop.price };
      return { type: 'buyProperty', playerId: playerIndex, propertyId: prop.id, price: prop.price };
    }
    if (owner.id === playerIndex) {
      return { type: 'ownProperty', playerId: playerIndex, propertyId: prop.id };
    }
    // 他人地产：设置 pendingEvent 等待玩家决定（租房/买地皮/买房屋）
    this.state.phase = 'event';
    const level = owner.buildings[prop.id] || 0;
    const rent = this.calculateRent(prop.id, owner.id);
    this.state.pendingEvent = { type: 'landOpponentProperty', playerId: playerIndex, ownerId: owner.id, propertyId: prop.id, rent, level };
    return { type: 'landOpponentProperty', playerId: playerIndex, ownerId: owner.id, propertyId: prop.id, rent, level };
  }

  handleChanceCell(playerIndex) {
    const card = this.chanceDeck[this.chanceIndex % this.chanceDeck.length];
    this.chanceIndex++;
    this.applyCardEffect(playerIndex, card);
    // 设置 pendingEvent 供前端展示卡牌弹窗（联机模式）
    this.state.phase = 'event';
    this.state.pendingEvent = { type: 'drawChance', playerId: playerIndex, card };
    return { type: 'drawChance', playerId: playerIndex, card };
  }

  handleDestinyCell(playerIndex) {
    const card = this.destinyDeck[this.destinyIndex % this.destinyDeck.length];
    this.destinyIndex++;
    this.applyCardEffect(playerIndex, card);
    // 设置 pendingEvent 供前端展示卡牌弹窗（联机模式）
    this.state.phase = 'event';
    this.state.pendingEvent = { type: 'drawDestiny', playerId: playerIndex, card };
    return { type: 'drawDestiny', playerId: playerIndex, card };
  }

  handleTeleportCell(playerIndex, cell) {
    const player = this.state.players[playerIndex];
    const tp = cell.teleport;
    if (!tp) return null;

    if (tp.mode === 'fixed' && tp.target !== undefined) {
      player.position = tp.target;
      this.addLog(`${player.name} 从 ${cell.name} 传送至 ${board[tp.target].name}`);
      return this.handleCellLanding(playerIndex, board[tp.target]);
    }
    if (tp.mode === 'anyEmpty') {
      this.state.phase = 'event';
      this.state.pendingEvent = { type: 'teleportAnyEmpty', playerId: playerIndex };
      return { type: 'teleportAnyEmpty', playerId: playerIndex };
    }
    // anyCell
    this.state.phase = 'event';
    this.state.pendingEvent = { type: 'moveAnyCell', playerId: playerIndex };
    return { type: 'moveAnyCell', playerId: playerIndex };
  }

  handleMoveCell(playerIndex, cell) {
    const player = this.state.players[playerIndex];
    if (cell.effect === 'reroll') {
      this.extraTurnPending = true;
      this.addLog(`${player.name} 在 ${cell.name} 可以再掷一次！`);
      return { type: 'reroll', playerId: playerIndex };
    }
    if (cell.effect === 'anyCell') {
      this.state.phase = 'event';
      this.state.pendingEvent = { type: 'moveAnyCell', playerId: playerIndex };
      return { type: 'moveAnyCell', playerId: playerIndex };
    }
    return null;
  }

  handleRestCell(playerIndex, cell) {
    const player = this.state.players[playerIndex];
    player.skipNextTurn = true;
    this.addLog(`${player.name} 在 ${cell.name} 休息，下回合跳过`);
    return { type: 'skipNextTurn', playerId: playerIndex };
  }

  applyCardEffect(playerIndex, card) {
    const player = this.state.players[playerIndex];
    const effect = card.effect;
    this.addLog(`${player.name} ${card.text}`);

    switch (effect.action) {
      case 'cash': {
        // 扣款（负数）按惩罚倍数加大；奖励（正数）保持不变
        const penalty = gameConfig.economy.penaltyMultiplier ?? 1;
        const amount = effect.amount < 0 ? Math.floor(effect.amount * penalty) : effect.amount;
        player.cash += amount;
        if (player.cash < 0) this.checkBankruptcy(playerIndex);
        break;
      }
      case 'move':
        this.movePlayerTo(playerIndex, effect.target);
        break;
      case 'moveRel':
        this.movePlayer(playerIndex, effect.steps);
        break;
      case 'collectFood':
        if (!player.foodCards.includes(effect.foodId)) player.foodCards.push(effect.foodId);
        break;
    }

    // 四大板块：生态卡处理
    if (card.category === 'ecology') {
      if (card.ecology) {
        const delta = card.ecology.delta;
        const newIndex = Math.max(gameConfig.ecology.min, Math.min(gameConfig.ecology.max, this.state.ecology.index + delta));
        const actual = newIndex - this.state.ecology.index;
        this.state.ecology.index = newIndex;
        this.state.ecology.turnsSinceLastEcoCard = 0;
        const tier = this.getEcologyTier();
        this.addLog(`🌿 生态指数 ${actual > 0 ? '+' : ''}${actual}（当前 ${newIndex}，${tier.label}）`);
      }
      if (card.extraEffect) {
        const hasMonitorShip = player.equipment.some(e => e.equipId === 'EQ03');
        switch (card.extraEffect.type) {
          case 'aquacultureDebuff':
            if (hasMonitorShip) {
              this.addLog(`🛳️ ${player.name} 海洋监测船生效，免疫赤潮`);
            } else {
              for (const propId of Object.keys(player.aquaculture)) {
                const aq = player.aquaculture[propId];
                if (aq && aq.level > 0) {
                  aq.incomeDebuffTurns = card.extraEffect.turns;
                  aq.debuffFactor = card.extraEffect.factor;
                }
              }
              this.addLog(`⚠️ ${player.name} 养殖场因赤潮收益减半 ${card.extraEffect.turns} 回合`);
            }
            break;
          case 'aquacultureDowngrade':
            if (hasMonitorShip) {
              this.addLog(`🛳️ ${player.name} 海洋监测船生效，免疫台风`);
            } else {
              const candidates = Object.keys(player.aquaculture).filter(id => player.aquaculture[id] && player.aquaculture[id].level > 0);
              if (candidates.length > 0) {
                const target = candidates[Math.floor(Math.random() * candidates.length)];
                player.aquaculture[target].level--;
                this.addLog(`⚠️ ${player.name} 的 ${properties[target].name} 养殖场因台风降级`);
              }
            }
            break;
          case 'nuclearAccident':
            const triggered = investmentProjects.find(p => p.id === 'NUC1');
            if (triggered) {
              const accidentIds = new Set(['NUC1', ...triggered.chainEffect]);
              for (const p of this.state.players) {
                if (p.bankrupt) continue;
                for (const inv of p.investments) {
                  if (!accidentIds.has(inv.projectId)) continue;
                  const proj = investmentProjects.find(pp => pp.id === inv.projectId);
                  if (!proj) continue;
                  const rawFee = inv.projectId === 'NUC1' ? triggered.accidentFee : 0;
                  // 救援费为扣款，按惩罚倍数加大
                  const penalty = gameConfig.economy.penaltyMultiplier ?? 1;
                  const fee = rawFee > 0 ? Math.floor(rawFee * penalty) : 0;
                  if (fee > 0) p.cash -= fee;
                  inv.stopDividendTurns = Math.max(inv.stopDividendTurns, proj.accidentStopTurns);
                  this.addLog(`☢️ 核事故！${p.name}${fee > 0 ? ` 付 ${fee} 救援费，` : ' 连锁'}${proj.name} 停发分红 ${proj.accidentStopTurns} 回合`);
                }
              }
            }
            break;
        }
      }
    }
  }

  movePlayerTo(playerIndex, target) {
    const player = this.state.players[playerIndex];
    const oldPos = player.position;
    const passStart = target < oldPos;
    if (passStart) {
      player.cash += gameConfig.start.passReward;
      this.addLog(`${player.name} 经过起点，获得 ¥${gameConfig.start.passReward}`);
      this.drawFoodCard(playerIndex);
      this.settleAquacultureIncome(playerIndex);
    }
    player.position = target;
    this.handleCellLanding(playerIndex, board[target]);
  }

  findPropertyOwner(propId) {
    for (const p of this.state.players) {
      if (p.properties.includes(propId) && !p.bankrupt) return p;
    }
    return null;
  }

  // 四板块：装备加成系数（取最高，不累乘）
  getEquipmentRentBoost(propId, owner) {
    const prop = properties[propId];
    if (!prop) return 1.0;
    let best = 1.0;
    for (const eq of owner.equipment) {
      if (eq.boundPropertyId !== propId) continue;
      const data = equipmentData.find(e => e.id === eq.equipId);
      if (data && data.effect.type === 'rentBoost' && data.effect.colorGroup === prop.colorGroup) {
        if (data.effect.multiplier > best) best = data.effect.multiplier;
      }
    }
    return best;
  }

  calculateRent(propId, ownerId) {
    const prop = properties[propId];
    const owner = this.state.players[ownerId];
    if (!prop || !owner) return 0;
    if (owner.mortgaged.includes(propId)) return 0;

    const level = owner.buildings[propId] || 0;
    let rent;
    if (level === 0) rent = prop.rentByLevel.empty;
    else if (level === 1) rent = prop.rentByLevel.house1;
    else if (level === 2) rent = prop.rentByLevel.house2;
    else if (level === 3) rent = prop.rentByLevel.house3;
    else rent = prop.rentByLevel.hotel;

    // 色块加成（仅空地）
    if (level === 0) {
      const group = colorGroups[prop.colorGroup];
      const ownedInGroup = owner.properties.filter(pid => properties[pid]?.colorGroup === prop.colorGroup && !owner.mortgaged.includes(pid)).length;
      if (group.bonusRule.type === 'all' && ownedInGroup === group.bonusRule.requiredCount) {
        rent = Math.floor(rent * group.bonusRule.rentMultiplier);
      } else if (group.bonusRule.type === 'count' && ownedInGroup >= group.bonusRule.requiredCount) {
        rent = Math.floor(rent * group.bonusRule.rentMultiplier);
      }
    }

    // 四板块：装备加成
    const equipBoost = this.getEquipmentRentBoost(propId, owner);
    if (equipBoost > 1) rent = Math.floor(rent * equipBoost);

    // 扣钱力度：租金统一乘惩罚倍数（盈利项不受影响），保证游戏可终结
    const penalty = gameConfig.economy.penaltyMultiplier ?? 1;
    if (penalty > 1) rent = Math.floor(rent * penalty);

    return rent;
  }

  // ============ 玩家操作 ============
  buyProperty(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || player.properties.includes(propId) || this.findPropertyOwner(propId)) return { error: '无法购买' };
    if (player.cash < prop.price) return { error: '资金不足' };
    player.cash -= prop.price;
    player.properties.push(propId);
    player.buildings[propId] = 0;
    this.addLog(`${player.name} 购买了 ${prop.name}，花费 ¥${prop.price}`);
    this.state.pendingEvent = null;
    this.state.phase = 'idle';

    // 四板块：色块集齐奖励重掷券
    this.checkColorGroupReward(player, prop.colorGroup);
    this.checkIronTriangle(playerIndex);
    // 购买完成，结束当前玩家回合（endTurn 内部处理双数重掷）
    this.endTurn(playerIndex);
    return { state: this.getState() };
  }

  checkColorGroupReward(player, groupId) {
    const group = colorGroups[groupId];
    if (!group) return;
    const owned = group.propertyIds.filter(id => player.properties.includes(id)).length;
    const required = group.bonusRule.type === 'all' ? group.propertyIds.length : group.bonusRule.requiredCount;
    if (owned === required) {
      const before = player.reRollTickets;
      player.reRollTickets = Math.min(gameConfig.nuclear.reRollTicketsMax, player.reRollTickets + gameConfig.nuclear.reRollTicketOnColorGroupComplete);
      if (player.reRollTickets > before) {
        this.addLog(`🎫 ${player.name} 集齐 ${group.name}，奖励重掷券（当前 ${player.reRollTickets}）`);
      }
    }
  }

  declineBuy(playerIndex) {
    this.state.pendingEvent = null;
    this.state.phase = 'idle';
    this.addLog(`${this.state.players[playerIndex].name} 放弃购买`);
    // 放弃购买，结束回合
    this.endTurn(playerIndex);
    return { state: this.getState() };
  }

  buildHouse(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || !player.properties.includes(propId)) return { error: '不拥有该地产' };
    if (player.mortgaged.includes(propId)) return { error: '已抵押' };
    // 互斥：已建养殖场不可建房
    if (player.aquaculture[propId] && player.aquaculture[propId].level > 0) return { error: '已建养殖场，与房屋互斥' };
    const currentLevel = player.buildings[propId] || 0;
    if (currentLevel >= 4) return { error: '已达最高等级' };
    if (player.cash < prop.buildCost) return { error: '资金不足' };
    player.cash -= prop.buildCost;
    player.buildings[propId] = currentLevel + 1;
    this.addLog(`${player.name} 在 ${prop.name} 建造（等级 ${currentLevel + 1}），花费 ¥${prop.buildCost}`);
    // 建房可能满足铁三角胜利条件（各地标建有房屋），需立即检查
    this.checkIronTriangle(playerIndex);
    return { state: this.getState() };
  }

  sellBuilding(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || !player.properties.includes(propId)) return { error: '不拥有该地产' };
    const level = player.buildings[propId] || 0;
    if (level === 0) return { error: '无建筑' };
    const refund = Math.floor(prop.buildCost / 2);
    player.cash += refund;
    player.buildings[propId] = level - 1;
    this.addLog(`${player.name} 拆除 ${prop.name} 建筑，回收 ¥${refund}`);
    return { state: this.getState() };
  }

  mortgageProperty(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || !player.properties.includes(propId)) return { error: '不拥有该地产' };
    if (player.mortgaged.includes(propId)) return { error: '已抵押' };
    if ((player.buildings[propId] || 0) > 0) return { error: '需先拆除建筑' };
    const amount = Math.floor(prop.price * gameConfig.economy.mortgageRatio);
    player.cash += amount;
    player.mortgaged.push(propId);
    this.addLog(`${player.name} 抵押了 ${prop.name}，获得 ¥${amount}`);
    return { state: this.getState() };
  }

  redeemProperty(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || !player.mortgaged.includes(propId)) return { error: '未抵押' };
    const amount = Math.floor(prop.price * gameConfig.economy.mortgageRatio * gameConfig.economy.redeemMultiplier);
    if (player.cash < amount) return { error: '资金不足' };
    player.cash -= amount;
    player.mortgaged = player.mortgaged.filter(id => id !== propId);
    this.addLog(`${player.name} 赎回了 ${prop.name}，花费 ¥${amount}`);
    return { state: this.getState() };
  }

  // 玩家间交易：买地皮（含建筑）
  buyPropertyFromPlayer(buyerIndex, propId, sellerIndex) {
    const buyer = this.state.players[buyerIndex];
    const seller = this.state.players[sellerIndex];
    const prop = properties[propId];
    if (!prop || !seller.properties.includes(propId)) return { error: '卖方不拥有该地产' };
    const level = seller.buildings[propId] || 0;
    const totalPrice = prop.price + prop.buildCost * level;
    if (buyer.cash < totalPrice) return { error: '资金不足' };
    buyer.cash -= totalPrice;
    seller.cash += totalPrice;
    seller.properties = seller.properties.filter(id => id !== propId);
    delete seller.buildings[propId];
    seller.mortgaged = seller.mortgaged.filter(id => id !== propId);
    buyer.properties.push(propId);
    buyer.buildings[propId] = level;
    this.state.pendingEvent = null;
    this.state.phase = 'idle';
    this.addLog(`${buyer.name} 以 ¥${totalPrice} 向 ${seller.name} 购买 ${prop.name}`);
    this.checkColorGroupReward(buyer, prop.colorGroup);
    this.checkIronTriangle(buyerIndex);
    // 交易完成，结束回合
    this.endTurn(buyerIndex);
    return { state: this.getState() };
  }

  // 玩家间交易：买房屋（不含地皮）
  buyBuildingFromPlayer(buyerIndex, propId, sellerIndex) {
    const buyer = this.state.players[buyerIndex];
    const seller = this.state.players[sellerIndex];
    const prop = properties[propId];
    if (!prop || !seller.properties.includes(propId)) return { error: '卖方不拥有该地产' };
    const level = seller.buildings[propId] || 0;
    if (level === 0) return { error: '无建筑可买' };
    const buildingPrice = prop.buildCost * level;
    if (buyer.cash < buildingPrice) return { error: '资金不足' };
    buyer.cash -= buildingPrice;
    seller.cash += buildingPrice;
    seller.buildings[propId] = 0;
    buyer.buildings[propId] = level;
    this.state.pendingEvent = null;
    this.state.phase = 'idle';
    this.addLog(`${buyer.name} 以 ¥${buildingPrice} 购买 ${prop.name} 上的${level}级建筑`);
    // 交易完成，结束回合
    this.endTurn(buyerIndex);
    return { state: this.getState() };
  }

  // 玩家间交易：租房（付租金）— 含免租券消耗
  payRentToPlayer(visitorIndex, propId, ownerIndex) {
    const visitor = this.state.players[visitorIndex];
    const owner = this.state.players[ownerIndex];
    const prop = properties[propId];
    if (!prop || !owner.properties.includes(propId)) return { error: '无效' };

    // 免租券消耗（与自动收租一致）
    if (visitor.freeRentTickets > 0) {
      visitor.freeRentTickets--;
      this.state.pendingEvent = null;
      this.state.phase = 'idle';
      this.addLog(`${visitor.name} 使用免租券，免付 ${owner.name} 的租金`);
      // 付租完成，结束回合
      this.endTurn(visitorIndex);
      return { state: this.getState() };
    }
    const rent = this.calculateRent(propId, ownerIndex);
    if (rent <= 0) return { error: '租金为0' };
    visitor.cash -= rent;
    owner.cash += rent;
    this.state.pendingEvent = null;
    this.state.phase = 'idle';
    this.addLog(`${visitor.name} 向 ${owner.name} 支付 ${prop.name} 租金 ¥${rent}`);
    if (visitor.cash < 0) this.checkBankruptcy(visitorIndex);
    // 收租方资产增加，可能触发资产胜利
    this.checkAllVictory();
    // 付租完成，结束回合
    this.endTurn(visitorIndex);
    return { state: this.getState() };
  }

  // 传送/移动到目标格
  teleportTo(playerIndex, targetIndex) {
    const player = this.state.players[playerIndex];
    if (targetIndex < 0 || targetIndex >= board.length) return { error: '无效目标' };
    player.position = targetIndex;
    this.state.pendingEvent = null;
    this.state.phase = 'idle';
    this.addLog(`${player.name} 移动至 ${board[targetIndex].name}`);
    const event = this.handleCellLanding(playerIndex, board[targetIndex]);
    // 若落格产生新的待处理交互事件，等玩家解决后再 endTurn；否则直接结束回合
    if (!this.state.pendingEvent && this.state.phase !== 'ended') {
      this.endTurn(playerIndex);
    }
    return { state: this.getState(), event };
  }

  // 兑换美食卡
  redeemFood(playerIndex, option) {
    const player = this.state.players[playerIndex];
    const uniqueTypes = [...new Set(player.foodCards)];
    if (uniqueTypes.length < 4) return { error: '美食卡不足4种' };
    const toRemove = uniqueTypes.slice(0, 4);
    for (const id of toRemove) {
      const idx = player.foodCards.indexOf(id);
      if (idx > -1) player.foodCards.splice(idx, 1);
    }
    if (option === 'cash') {
      player.cash += 2000;
      this.addLog(`${player.name} 兑换美食组合，获得 ¥2000`);
      // 兑换现金增加资产，可能触发资产胜利
      this.checkAllVictory();
    } else {
      player.freeRentTickets += 1;
      this.addLog(`${player.name} 兑换美食组合，获得 1 张免租券`);
    }
    return { state: this.getState() };
  }

  // ============ 四大海洋板块操作 ============
  buyEquipment(playerIndex, equipId, soldAtPropertyId, boundPropertyId) {
    const player = this.state.players[playerIndex];
    const data = equipmentData.find(e => e.id === equipId);
    if (!data) return { error: '装备不存在' };
    if (this.soldEquipmentIds.has(equipId)) return { error: '装备已售出' };
    if (!player.properties.includes(soldAtPropertyId)) return { error: '需拥有供应点地标' };
    if (player.cash < data.price) return { error: '资金不足' };
    if (data.effect.type === 'rentBoost') {
      if (!boundPropertyId) return { error: '需选择装配地产' };
      const target = properties[boundPropertyId];
      if (!target || !player.properties.includes(boundPropertyId)) return { error: '目标地产无效' };
      if (target.colorGroup !== data.effect.colorGroup) return { error: '色块不匹配' };
    }
    player.cash -= data.price;
    player.equipment.push({ equipId, boundPropertyId: data.effect.type === 'rentBoost' ? boundPropertyId : null });
    this.soldEquipmentIds.add(equipId);
    const boundName = boundPropertyId ? properties[boundPropertyId]?.name : null;
    this.addLog(`${data.icon} ${player.name} 购买装备：${data.name}${boundName ? `，装配到 ${boundName}` : ''}${data.effect.type === 'rentBoost' ? '，过路费 +30%' : ''}`);
    return { state: this.getState() };
  }

  buildAquaculture(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || !prop.aquaculture) return { error: '该地产不支持养殖' };
    if (!player.properties.includes(propId)) return { error: '不拥有该地产' };
    if ((player.buildings[propId] || 0) > 0) return { error: '已建房屋，与养殖互斥' };
    const cur = player.aquaculture[propId]?.level || 0;
    if (cur >= 3) return { error: '已达最高级' };
    const cost = prop.aquaculture.levels[cur].cost;
    if (player.cash < cost) return { error: '资金不足' };
    player.cash -= cost;
    player.aquaculture[propId] = { propertyId: propId, level: cur + 1, incomeDebuffTurns: 0, debuffFactor: 1 };
    this.addLog(`🐚 ${player.name} 在 ${prop.name} 建造养殖场至 ${prop.aquaculture.levels[cur].name}，花费 ¥${cost}`);
    return { state: this.getState() };
  }

  demolishAquaculture(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop?.aquaculture) return { error: '该地产不支持养殖' };
    const state = player.aquaculture[propId];
    if (!state || state.level === 0) return { error: '未建养殖场' };
    let invested = 0;
    for (let i = 0; i < state.level; i++) invested += prop.aquaculture.levels[i].cost;
    const refund = Math.floor(invested * gameConfig.aquaculture.demolishRefundRatio);
    player.cash += refund;
    delete player.aquaculture[propId];
    this.addLog(`🔧 ${player.name} 拆除 ${prop.name} 养殖场，回收 ¥${refund}`);
    return { state: this.getState() };
  }

  investNuclear(playerIndex, projectId) {
    const player = this.state.players[playerIndex];
    const proj = investmentProjects.find(p => p.id === projectId);
    if (!proj) return { error: '项目不存在' };
    const sold = this.soldInvestmentCopies[projectId] || 0;
    if (sold >= proj.maxCopies) return { error: '已售罄' };
    if (player.cash < proj.cost) return { error: '资金不足' };
    player.cash -= proj.cost;
    player.investments.push({ projectId, stopDividendTurns: 0 });
    this.soldInvestmentCopies[projectId] = sold + 1;
    this.addLog(`💼 ${player.name} 投资 ${proj.name}，花费 ¥${proj.cost}`);
    return { state: this.getState() };
  }

  useReRollTicket(playerIndex) {
    const player = this.state.players[playerIndex];
    if (player.reRollTickets <= 0) return { error: '无重掷券' };
    player.reRollTickets--;
    this.extraTurnPending = true;
    this.addLog(`🎫 ${player.name} 使用重掷券，可再掷一次`);
    return { state: this.getState() };
  }

  // ============ 破产清算 ============
  checkBankruptcy(playerIndex) {
    const player = this.state.players[playerIndex];
    if (player.cash < 0 && !player.bankrupt) {
      // 清算：卖建筑→卖装备→抵押地产
      this.liquidate(playerIndex);
      if (player.cash < 0) {
        player.bankrupt = true;
        player.properties = [];
        player.buildings = {};
        player.mortgaged = [];
        player.foodCards = [];
        player.freeRentTickets = 0;
        player.equipment = [];
        player.aquaculture = {};
        player.investments = [];
        player.reRollTickets = 0;
        this.addLog(`${player.name} 破产了！`);
        this.checkVictory();
      }
    }
  }

  liquidate(playerIndex) {
    const player = this.state.players[playerIndex];
    // 1. 卖建筑
    for (const propId of [...player.properties]) {
      if (player.cash >= 0) break;
      const level = player.buildings[propId] || 0;
      if (level > 0) {
        const prop = properties[propId];
        const refund = Math.floor(prop.buildCost * level * gameConfig.economy.sellBuildingRatio);
        player.cash += refund;
        player.buildings[propId] = 0;
      }
    }
    // 2. 卖装备
    if (player.cash < 0 && player.equipment.length > 0) {
      let refund = 0;
      for (const eq of player.equipment) {
        const data = equipmentData.find(e => e.id === eq.equipId);
        if (data) refund += data.sellPrice;
      }
      player.cash += refund;
      player.equipment = [];
    }
    // 3. 抵押地产
    for (const propId of [...player.properties]) {
      if (player.cash >= 0) break;
      if (!player.mortgaged.includes(propId) && (player.buildings[propId] || 0) === 0) {
        const prop = properties[propId];
        const amount = Math.floor(prop.price * gameConfig.economy.mortgageRatio);
        player.cash += amount;
        player.mortgaged.push(propId);
      }
    }
  }

  /**
   * 统一胜利检查（V3.4 三条独立条件，遍历所有存活玩家，任意达成即胜）：
   *   1. 破产胜利  2. 仙境铁三角（三地标+各地标≥3级房屋）  3. 资产胜利（>30000）
   * 优先级：破产 > 铁三角 > 资产。在所有资产/所有权变化后调用。
   */
  checkAllVictory() {
    if (this.state.winner) return;
    const alive = this.state.players.filter(p => !p.bankrupt);

    // 1. 破产胜利
    if (alive.length === 1) {
      this.state.winner = alive[0];
      this.state.winReason = '其他玩家全部破产';
      this.state.phase = 'ended';
      this.addLog(`🎉 ${alive[0].name} 获得胜利！${this.state.winReason}`);
      return;
    }

    const ironTriangle = gameConfig.victory.ironTriangle;
    const requiredIds = ironTriangle
      .map(name => {
        const prop = Object.values(properties).find(p => p.name === name);
        return prop ? prop.id : null;
      })
      .filter(id => !!id);
    const requiredLevel = gameConfig.victory.ironTriangleNeedHouses
      ? (gameConfig.victory.ironTriangleHouseLevel ?? 1)
      : 0;
    const minAssets = gameConfig.victory.ironTriangleMinAssets ?? 0;

    // 2 & 3. 遍历存活玩家查铁三角与资产
    for (const player of alive) {
      // 铁三角：拥有三地标 + 各地标建筑等级达标
      if (requiredIds.length > 0 && requiredIds.every(id => player.properties.includes(id))) {
        if (requiredLevel === 0 || requiredIds.every(id => (player.buildings[id] || 0) >= requiredLevel)) {
          this.state.winner = player;
          this.state.winReason = '仙境铁三角：集齐烟台山+蓬莱阁+养马岛，各地标均建有3座房屋';
          this.state.phase = 'ended';
          this.addLog(`🎉 ${player.name} 获得胜利！${this.state.winReason}`);
          return;
        }
      }
      // 资产胜利（独立条件）
      if (minAssets > 0 && this.estimatePlayerAssets(player) > minAssets) {
        this.state.winner = player;
        this.state.winReason = `总资产突破 ${minAssets}`;
        this.state.phase = 'ended';
        this.addLog(`🎉 ${player.name} 获得胜利！${this.state.winReason}`);
        return;
      }
    }
  }

  checkIronTriangle(playerIndex) {
    // 兼容旧调用点：统一走 checkAllVictory
    this.checkAllVictory();
  }

  /** 估算玩家总资产（含四大板块估值），与前端 estimatePlayerAssets 口径一致 */
  estimatePlayerAssets(player) {
    let total = player.cash;
    for (const propId of player.properties) {
      const p = properties[propId];
      if (!p) continue;
      const mortgaged = player.mortgaged.includes(propId);
      total += mortgaged ? Math.floor(p.price * gameConfig.economy.mortgageRatio) : p.price;
      const lvl = player.buildings[propId] || 0;
      total += p.buildCost * lvl;
    }
    // 养殖场估值
    for (const propId of Object.keys(player.aquaculture || {})) {
      const p = properties[propId];
      const lvl = player.aquaculture[propId]?.level || 0;
      if (p?.aquaculture && lvl > 0) {
        let cost = 0;
        for (let i = 0; i < lvl; i++) cost += p.aquaculture.levels[i].cost;
        total += Math.floor(cost * 0.5);
      }
    }
    // 装备估值
    for (const eq of player.equipment || []) {
      const d = equipmentData.find(e => e.id === eq.equipId);
      if (d) total += Math.floor(d.price * gameConfig.equipment.sellRatio);
    }
    // 投资估值
    for (const inv of player.investments || []) {
      const proj = investmentProjects.find(p => p.id === inv.projectId);
      if (proj) total += Math.floor(proj.cost * 0.5);
    }
    return total;
  }

  checkVictory() {
    // V3.4：统一走三条件检查（破产/铁三角/资产）
    this.checkAllVictory();
  }

  /**
   * 移除玩家（联机版：玩家中途退出房间时调用）。
   * - 该玩家所有地产/建筑/装备/养殖/投资归银行（变无主空地）
   * - 从 state.players 数组删除，修正 currentPlayerIndex
   * - 返回新状态（供调用方广播）
   */
  removePlayer(playerIndex) {
    if (playerIndex < 0 || playerIndex >= this.state.players.length) return { state: this.getState() };
    const player = this.state.players[playerIndex];
    this.addLog(`${player.name} 已退出房间，所有资产归银行`);

    // 该玩家持有的地产变为无主空地（无需显式清全局 owner 映射，findPropertyOwner 按遍历 players 判定）
    // 清空该玩家所有资产字段（防御性，即使数组被删也确保对象干净）
    player.properties = [];
    player.buildings = {};
    player.mortgaged = [];
    player.equipment = [];
    player.aquaculture = {};
    player.investments = [];
    player.foodCards = [];
    player.freeRentTickets = 0;
    player.reRollTickets = 0;
    player.cash = 0;

    // 从玩家数组删除，修正 currentPlayerIndex
    const wasCurrent = playerIndex === this.state.currentPlayerIndex;
    this.state.players.splice(playerIndex, 1);
    if (this.state.players.length === 0) {
      this.state.phase = 'ended';
      return { state: this.getState() };
    }
    if (wasCurrent) {
      // 删除的就是当前操作者：currentPlayerIndex 指向同一位置（现在已是下一玩家）
      // 若越界（删除的是末尾）则回绕到 0
      this.state.currentPlayerIndex = this.state.currentPlayerIndex % this.state.players.length;
      // 清除待处理事件（退出者的事件不再有效）
      this.state.pendingEvent = null;
    this.state.phase = 'idle';
    } else if (playerIndex < this.state.currentPlayerIndex) {
      // 删除的在当前操作者之前：当前索引前移
      this.state.currentPlayerIndex -= 1;
    }

    // 单人剩余：标记结束（调用方会处理回等待界面）
    const alive = this.state.players.filter(p => !p.bankrupt);
    if (alive.length <= 1 && this.state.phase !== 'ended') {
      this.state.phase = 'ended';
      this.state.winner = alive[0] || null;
      this.state.winReason = '其他玩家全部退出';
    }

    return { state: this.getState() };
  }

  nextTurn() {
    if (this.state.phase === 'ended') return;
    if (this.extraTurnPending) {
      this.extraTurnPending = false;
      return; // 不切换玩家
    }
    let next = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    let safety = 0;
    while (this.state.players[next].bankrupt && safety < this.state.players.length) {
      next = (next + 1) % this.state.players.length;
      safety++;
    }
    this.state.currentPlayerIndex = next;
    if (next === 0) this.state.turnCount++;
    this.addLog(`--- 第 ${this.state.turnCount} 回合，轮到 ${this.state.players[next].name} ---`);
  }

  endTurn(playerIndex) {
    if (playerIndex !== this.state.currentPlayerIndex) return { error: '不是你的回合' };
    this.state.pendingEvent = null;
    this.state.phase = 'idle';
    this.nextTurn();
    return { state: this.getState() };
  }

  // ============ 统一 action 入口 ============
  handleGameAction(playerIndex, action, params) {
    // 统一回合校验：游戏进行中时，所有游戏内 action 都必须是当前回合玩家发起
    // 这是联机回合隔离的服务端权威防线（前端 canRollDice/canManageAssets 是第一道）
    if (this.state.phase !== 'ended') {
      const isMyTurn = playerIndex === this.state.currentPlayerIndex;
      if (!isMyTurn) {
        return { error: '不是你的回合' };
      }
    }
    switch (action) {
      case 'roll':
        return this.rollDice(playerIndex);
      case 'buy':
        return this.buyProperty(playerIndex, params.propertyId);
      case 'declineBuy':
        return this.declineBuy(playerIndex);
      case 'build':
        return this.buildHouse(playerIndex, params.propertyId);
      case 'sellBuilding':
        return this.sellBuilding(playerIndex, params.propertyId);
      case 'mortgage':
        return this.mortgageProperty(playerIndex, params.propertyId);
      case 'redeem':
        return this.redeemProperty(playerIndex, params.propertyId);
      case 'buyPropertyFromPlayer':
        return this.buyPropertyFromPlayer(playerIndex, params.propertyId, params.sellerId);
      case 'buyBuildingFromPlayer':
        return this.buyBuildingFromPlayer(playerIndex, params.propertyId, params.sellerId);
      case 'payRent':
        return this.payRentToPlayer(playerIndex, params.propertyId, params.ownerId);
      case 'teleportTo':
        return this.teleportTo(playerIndex, params.targetIndex);
      case 'redeemFood':
        return this.redeemFood(playerIndex, params.option);
      case 'endTurn':
        return this.endTurn(playerIndex);
      // 四大海洋板块
      case 'buyEquipment':
        return this.buyEquipment(playerIndex, params.equipId, params.soldAtPropertyId, params.boundPropertyId);
      case 'buildAquaculture':
        return this.buildAquaculture(playerIndex, params.propertyId);
      case 'demolishAquaculture':
        return this.demolishAquaculture(playerIndex, params.propertyId);
      case 'investNuclear':
        return this.investNuclear(playerIndex, params.projectId);
      case 'useReRollTicket':
        return this.useReRollTicket(playerIndex);
      default:
        return { error: '未知操作' };
    }
  }
}
