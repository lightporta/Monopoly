// 服务端游戏引擎 - 游戏规则权威
import { gameConfig, board, properties, colorGroups, chanceCards, destinyCards, foodItems, createPlayer, shuffleArray } from './data.js';

export class GameEngine {
  constructor() {
    this.state = null;
    this.chanceDeck = [];
    this.destinyDeck = [];
    this.chanceIndex = 0;
    this.destinyIndex = 0;
    this.log = [];
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
      log: []
    };
    this.chanceDeck = shuffleArray(chanceCards);
    this.destinyDeck = shuffleArray(destinyCards);
    this.chanceIndex = 0;
    this.destinyIndex = 0;
    this.log = [];
    this.addLog(`游戏开始！${players.length} 位玩家`);
    return this.getState();
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  addLog(msg) {
    this.log.push(msg);
    if (this.state) this.state.log = [...this.log];
  }

  rollDice(playerIndex) {
    if (playerIndex !== this.state.currentPlayerIndex) {
      return { error: '不是你的回合' };
    }
    const player = this.state.players[playerIndex];
    if (player.bankrupt) return { error: '已破产' };
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
        this.addLog(`${player.name} 连续三次双数，送至休息区！`);
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

    if (!isDouble && this.state.phase !== 'ended') {
      this.nextTurn();
    }

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
    }

    player.position = newPos;
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
        return { type: 'teleport', cellIndex: cell.index, teleport: cell.teleport };
      case 'move':
        return this.handleMoveCell(playerIndex, cell);
      case 'rest':
        return { type: 'rest', cellIndex: cell.index };
      case 'start':
        return { type: 'start', cellIndex: cell.index };
      default:
        return null;
    }
  }

  handlePropertyCell(playerIndex, cell) {
    const prop = properties[cell.propertyRef];
    const player = this.state.players[playerIndex];
    const owner = this.findPropertyOwner(prop.id);

    if (!owner) {
      return { type: 'buyProperty', playerId: playerIndex, propertyId: prop.id, price: prop.price };
    } else if (owner.id !== playerIndex && !player.mortgaged.includes(prop.id)) {
      const rent = this.calculateRent(prop.id, owner.id);
      if (player.freeRentTickets > 0) {
        player.freeRentTickets--;
        this.addLog(`${player.name} 使用免租券，免付租金`);
        return { type: 'freeRentUsed', playerId: playerIndex, propertyId: prop.id };
      }
      player.cash -= rent;
      owner.cash += rent;
      this.addLog(`${player.name} 支付给 ${owner.name} 租金 ¥${rent}`);
      this.checkBankruptcy(playerIndex);
      return { type: 'payRent', playerId: playerIndex, ownerId: owner.id, propertyId: prop.id, amount: rent };
    }
    return { type: 'ownProperty', playerId: playerIndex, propertyId: prop.id };
  }

  handleChanceCell(playerIndex) {
    const card = this.chanceDeck[this.chanceIndex % this.chanceDeck.length];
    this.chanceIndex++;
    this.applyCardEffect(playerIndex, card);
    return { type: 'drawChance', playerId: playerIndex, card };
  }

  handleDestinyCell(playerIndex) {
    const card = this.destinyDeck[this.destinyIndex % this.destinyDeck.length];
    this.destinyIndex++;
    this.applyCardEffect(playerIndex, card);
    return { type: 'drawDestiny', playerId: playerIndex, card };
  }

  handleMoveCell(playerIndex, cell) {
    const player = this.state.players[playerIndex];
    if (cell.effect === 'reroll') {
      this.addLog(`${player.name} 可以再掷一次！`);
      return { type: 'reroll', playerId: playerIndex };
    } else if (cell.effect === 'skipNextTurn') {
      player.skipNextTurn = true;
      this.addLog(`${player.name} 下一回合跳过`);
      return { type: 'skipNextTurn', playerId: playerIndex };
    }
    return null;
  }

  applyCardEffect(playerIndex, card) {
    const player = this.state.players[playerIndex];
    const effect = card.effect;
    this.addLog(`${player.name} ${card.text}`);

    switch (effect.action) {
      case 'cash':
        player.cash += effect.amount;
        if (player.cash < 0) this.checkBankruptcy(playerIndex);
        break;
      case 'move':
        this.movePlayerTo(playerIndex, effect.target);
        break;
      case 'moveRel':
        this.movePlayer(playerIndex, effect.steps);
        break;
      case 'collectFood':
        if (!player.foodCards.includes(effect.foodId)) {
          player.foodCards.push(effect.foodId);
        }
        break;
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
    }
    player.position = target;
    const cell = board[target];
    this.handleCellLanding(playerIndex, cell);
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

  findPropertyOwner(propId) {
    for (const p of this.state.players) {
      if (p.properties.includes(propId) && !p.bankrupt) return p;
    }
    return null;
  }

  calculateRent(propId, ownerId) {
    const prop = properties[propId];
    const owner = this.state.players[ownerId];
    const level = owner.buildings[propId] || 0;
    let rent;
    if (level === 0) rent = prop.rentByLevel.empty;
    else if (level === 1) rent = prop.rentByLevel.house1;
    else if (level === 2) rent = prop.rentByLevel.house2;
    else if (level === 3) rent = prop.rentByLevel.house3;
    else rent = prop.rentByLevel.hotel;

    const group = colorGroups[prop.colorGroup];
    const ownedInGroup = owner.properties.filter(pid => properties[pid]?.colorGroup === prop.colorGroup && !owner.mortgaged.includes(pid)).length;
    if (group.bonusRule.type === 'all' && ownedInGroup === group.bonusRule.requiredCount) {
      rent = Math.floor(rent * group.bonusRule.rentMultiplier);
    } else if (group.bonusRule.type === 'count' && ownedInGroup >= group.bonusRule.requiredCount) {
      rent = Math.floor(rent * group.bonusRule.rentMultiplier);
    }
    return rent;
  }

  buyProperty(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || player.properties.includes(propId) || this.findPropertyOwner(propId)) {
      return { error: '无法购买' };
    }
    if (player.cash < prop.price) {
      return { error: '资金不足' };
    }
    player.cash -= prop.price;
    player.properties.push(propId);
    this.addLog(`${player.name} 购买了 ${prop.name}，花费 ¥${prop.price}`);
    this.checkIronTriangle(playerIndex);
    return { state: this.getState() };
  }

  buildHouse(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || !player.properties.includes(propId)) return { error: '不拥有该地产' };
    const currentLevel = player.buildings[propId] || 0;
    if (currentLevel >= 4) return { error: '已达最高等级' };
    if (player.cash < prop.buildCost) return { error: '资金不足' };

    player.cash -= prop.buildCost;
    player.buildings[propId] = currentLevel + 1;
    this.addLog(`${player.name} 在 ${prop.name} 建造了房屋（等级 ${currentLevel + 1}）`);
    return { state: this.getState() };
  }

  mortgageProperty(playerIndex, propId) {
    const player = this.state.players[playerIndex];
    const prop = properties[propId];
    if (!prop || !player.properties.includes(propId)) return { error: '不拥有该地产' };
    if (player.mortgaged.includes(propId)) return { error: '已抵押' };
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

  checkBankruptcy(playerIndex) {
    const player = this.state.players[playerIndex];
    if (player.cash < 0 && !player.bankrupt) {
      player.bankrupt = true;
      this.addLog(`${player.name} 破产了！`);
      this.checkVictory();
    }
  }

  checkIronTriangle(playerIndex) {
    const player = this.state.players[playerIndex];
    const ironTriangle = gameConfig.victory.ironTriangle;
    const hasAll = ironTriangle.every(name => {
      const prop = Object.values(properties).find(p => p.name === name);
      return prop && player.properties.includes(prop.id);
    });
    if (hasAll && !this.state.winner) {
      this.state.winner = player;
      this.state.winReason = '集齐铁三角：烟台山 + 蓬莱阁 + 养马岛！';
      this.state.phase = 'ended';
      this.addLog(`🎉 ${player.name} 获得胜利！${this.state.winReason}`);
    }
  }

  checkVictory() {
    const alive = this.state.players.filter(p => !p.bankrupt);
    if (alive.length === 1 && !this.state.winner) {
      this.state.winner = alive[0];
      this.state.winReason = '其他玩家全部破产';
      this.state.phase = 'ended';
      this.addLog(`🎉 ${alive[0].name} 获得胜利！${this.state.winReason}`);
    }
  }

  nextTurn() {
    if (this.state.phase === 'ended') return;
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
    this.nextTurn();
    return { state: this.getState() };
  }

  handleGameAction(playerIndex, action, params) {
    switch (action) {
      case 'roll':
        return this.rollDice(playerIndex);
      case 'buy':
        return this.buyProperty(playerIndex, params.propertyId);
      case 'build':
        return this.buildHouse(playerIndex, params.propertyId);
      case 'mortgage':
        return this.mortgageProperty(playerIndex, params.propertyId);
      case 'redeem':
        return this.redeemProperty(playerIndex, params.propertyId);
      case 'endTurn':
        return this.endTurn(playerIndex);
      default:
        return { error: '未知操作' };
    }
  }
}
