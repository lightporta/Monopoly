import { BOARD, PROPERTIES, GROUPS } from './data.js';
export { BOARD, PROPERTIES, GROUPS };

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const RULES = freeze({
  version: 4,
  initialCash: 12000,
  passReward: 1200,
  foodReward: 1000,
  maxLevel: 3,
  maxAquacultureLevel: 3,
  mortgageRatio: 0.5,
  redeemMultiplier: 1.1,
  buildingSaleRatio: 0.5,
  rentMultipliers: [1, 3, 6, 10],
  groupMultiplier: 1.5,
  equipmentCost: 1000,
  equipmentMultiplier: 1.2,
  aquacultureCost: 1000,
  aquacultureIncome: [0, 200, 450, 750],
  ironTriangle: ['prop_06', 'prop_17', 'prop_24'],
  ironTriangleBonus: 3000,
  defaultMaxRounds: 40,
  investments: [
    {
      id: 'wind',
      name: { zh: '海上风电场', en: 'Offshore Wind Farm' },
      cost: 2500,
      income: 55,
      maxCopies: 2,
    },
    {
      id: 'nuclear',
      name: { zh: '海阳核电项目', en: 'Haiyang Nuclear Project' },
      cost: 4000,
      income: 90,
      maxCopies: 1,
    },
  ],
});

const propertyById = new Map(PROPERTIES.map((property) => [property.id, property]));
const projectById = new Map(RULES.investments.map((project) => [project.id, project]));
// Integer percentage arithmetic avoids ceil(700 * 1.1) incorrectly charging 771.
const redemptionCost = (property) =>
  Math.ceil(
    (property.price * RULES.mortgageRatio * Math.round(RULES.redeemMultiplier * 100)) / 100,
  );
const difficulties = new Set(['easy', 'normal', 'hard']);
// Public board geometry only: enumerate 2d6 and automatic portals, including
// the bridge's skipped turn. Hard AI uses expected landing frequencies rather
// than treating a portal destination as an ordinary square.
const landingWeights = (() => {
  let distribution = Array(72).fill(0);
  distribution[0] = 1;
  let arrivals = Array(36).fill(0);
  for (let iteration = 0; iteration < 250; iteration++) {
    const next = Array(72).fill(0);
    arrivals = Array(36).fill(0);
    for (let position = 0; position < 72; position++) {
      if (position >= 36) {
        next[position - 36] += distribution[position];
        continue;
      }
      if (!distribution[position]) continue;
      for (let a = 1; a <= 6; a++)
        for (let b = 1; b <= 6; b++) {
          let target = (position + a + b) % 36;
          if (BOARD[target].type === 'teleport') target = BOARD[target].target;
          const probability = distribution[position] / 36;
          arrivals[target] += probability;
          next[target + (BOARD[target].type === 'rest' ? 36 : 0)] += probability;
        }
    }
    distribution = next;
  }
  return arrivals;
})();
const fail = (code, message = code) => {
  throw Object.assign(new Error(message), { code });
};
const clone = (state) => JSON.parse(JSON.stringify(state));
const ownerProperties = (state, playerId) =>
  PROPERTIES.filter((p) => state.properties[p.id].ownerId === playerId);
const log = (state, type, details = {}) => {
  state.log.push({ type, ...details });
  if (state.log.length > 200) state.log.shift();
};

function seedNumber(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0 || 1;
}
function random(state) {
  let n = state.rngState >>> 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  state.rngState = n >>> 0 || 1;
  return state.rngState / 4294967296;
}
function playerIn(state, playerId) {
  return state.players.find((p) => p.id === playerId);
}
function totalCopies(state, projectId) {
  return state.players.reduce(
    (count, p) => count + p.investments.filter((id) => id === projectId).length,
    0,
  );
}

export function createGame({
  players,
  seed = 'fairy-coast',
  maxRounds = RULES.defaultMaxRounds,
} = {}) {
  if (
    !Array.isArray(players) ||
    players.length < 2 ||
    players.length > 4 ||
    !Number.isInteger(maxRounds) ||
    maxRounds < 1 ||
    maxRounds > 200 ||
    !['string', 'number'].includes(typeof seed) ||
    String(seed).length > 200 ||
    (typeof seed === 'number' && !Number.isFinite(seed))
  )
    fail('INVALID_SETUP');
  const ids = new Set();
  const safePlayers = players.map((p) => {
    if (
      !p ||
      typeof p.id !== 'string' ||
      !p.id.trim() ||
      p.id.length > 80 ||
      ids.has(p.id) ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name.trim().length > 32 ||
      (p.difficulty !== undefined && !difficulties.has(p.difficulty))
    )
      fail('INVALID_SETUP');
    ids.add(p.id);
    return {
      id: p.id,
      name: p.name.trim(),
      isAI: Boolean(p.isAI),
      difficulty: p.difficulty ?? 'normal',
      position: 0,
      cash: RULES.initialCash,
      bankrupt: false,
      skipTurns: 0,
      food: 0,
      investments: [],
    };
  });
  const state = {
    version: 4,
    revision: 0,
    status: 'playing',
    phase: 'roll',
    players: safePlayers,
    currentPlayerId: safePlayers[0].id,
    round: 1,
    maxRounds,
    lastDice: [0, 0],
    pendingPropertyId: null,
    properties: Object.fromEntries(
      PROPERTIES.map((p) => [
        p.id,
        { ownerId: null, level: 0, mortgaged: false, aquaculture: 0, equipped: false },
      ]),
    ),
    ecology: 70,
    winnerIds: [],
    finishReason: null,
    log: [],
    seed,
    rngState: seedNumber(seed),
  };
  log(state, 'gameStarted');
  return state;
}

export function getRent(state, propertyId) {
  const property = propertyById.get(propertyId);
  const asset = state.properties[propertyId];
  if (!property || !asset || !asset.ownerId || asset.mortgaged) return 0;
  const groupOwned = PROPERTIES.filter(
    (p) =>
      p.group === property.group &&
      state.properties[p.id].ownerId === asset.ownerId &&
      !state.properties[p.id].mortgaged,
  ).length;
  const groupBonus = groupOwned >= GROUPS[property.group].required ? RULES.groupMultiplier : 1;
  return Math.floor(
    property.baseRent *
      RULES.rentMultipliers[asset.level] *
      groupBonus *
      (asset.equipped ? RULES.equipmentMultiplier : 1),
  );
}

export function getNetWorth(state, playerId) {
  const player = playerIn(state, playerId);
  if (!player) fail('PLAYER_UNKNOWN');
  if (player.bankrupt) return 0;
  let worth = player.cash;
  for (const property of ownerProperties(state, playerId)) {
    const asset = state.properties[property.id];
    worth +=
      property.price - (asset.mortgaged ? Math.floor(property.price * RULES.mortgageRatio) : 0);
    worth += Math.floor(asset.level * property.buildCost * RULES.buildingSaleRatio);
    worth += Math.floor(asset.aquaculture * RULES.aquacultureCost * RULES.buildingSaleRatio);
    if (asset.equipped) worth += Math.floor(RULES.equipmentCost * RULES.buildingSaleRatio);
  }
  worth += player.investments.reduce((sum, id) => sum + projectById.get(id).cost / 2, 0);
  if (
    RULES.ironTriangle.every((id) => {
      const asset = state.properties[id];
      return asset.ownerId === playerId && asset.level === RULES.maxLevel && !asset.mortgaged;
    })
  )
    worth += RULES.ironTriangleBonus;
  return worth;
}

/** Returns concrete, validated command choices. Never advances randomness. */
export function getLegalActions(state, playerId) {
  const player = playerIn(state, playerId);
  if (state.status !== 'playing' || !player || player.bankrupt) return [];
  const actions = [{ type: 'surrender' }];
  if (state.currentPlayerId !== playerId) return actions;
  if (state.phase === 'roll') return [{ type: 'roll' }, ...actions];
  if (state.phase === 'purchase') {
    const property = propertyById.get(state.pendingPropertyId);
    if (property && !state.properties[property.id].ownerId && player.cash >= property.price)
      actions.unshift({ type: 'buy', propertyId: property.id });
    actions.unshift({ type: 'decline' });
    return actions;
  }
  if (state.phase !== 'manage') return actions;
  actions.unshift({ type: 'endTurn' });
  for (const property of ownerProperties(state, playerId)) {
    const asset = state.properties[property.id];
    const params = { propertyId: property.id };
    if (asset.mortgaged) {
      if (player.cash >= redemptionCost(property)) actions.push({ type: 'redeem', ...params });
      continue;
    }
    if (asset.level === 0 && asset.aquaculture === 0 && !asset.equipped)
      actions.push({ type: 'mortgage', ...params });
    if (asset.level > 0 || asset.aquaculture > 0 || asset.equipped)
      actions.push({ type: 'sellBuilding', ...params });
    if (!asset.aquaculture && asset.level < RULES.maxLevel && player.cash >= property.buildCost)
      actions.push({ type: 'build', ...params });
    if (
      property.aquaculture &&
      !asset.level &&
      asset.aquaculture < RULES.maxAquacultureLevel &&
      player.cash >= RULES.aquacultureCost
    )
      actions.push({ type: 'aquaculture', ...params });
    if (!asset.equipped && player.cash >= RULES.equipmentCost)
      actions.push({ type: 'equip', ...params });
  }
  for (const project of RULES.investments) {
    if (
      player.cash >= project.cost &&
      !player.investments.includes(project.id) &&
      totalCopies(state, project.id) < project.maxCopies
    )
      actions.push({ type: 'invest', projectId: project.id });
  }
  return actions;
}

function finish(state, reason) {
  const alive = state.players.filter((p) => !p.bankrupt);
  const highest = Math.max(...alive.map((p) => getNetWorth(state, p.id)));
  state.winnerIds = alive.filter((p) => getNetWorth(state, p.id) === highest).map((p) => p.id);
  state.status = 'finished';
  state.finishReason = reason;
  state.phase = 'manage';
  state.pendingPropertyId = null;
  log(state, 'gameFinished', { reason, winnerIds: [...state.winnerIds] });
}
function checkSurvivors(state) {
  if (state.players.filter((p) => !p.bankrupt).length <= 1) {
    finish(state, 'lastStanding');
    return true;
  }
  return false;
}
function removePlayerAssets(state, player) {
  for (const property of ownerProperties(state, player.id)) {
    Object.assign(state.properties[property.id], {
      ownerId: null,
      level: 0,
      mortgaged: false,
      aquaculture: 0,
      equipped: false,
    });
  }
  player.investments = [];
  player.food = 0;
  player.skipTurns = 0;
  player.cash = 0;
  player.bankrupt = true;
}
function sellOne(state, player, property) {
  const asset = state.properties[property.id];
  let refund;
  if (asset.level > 0) {
    asset.level--;
    refund = Math.floor(property.buildCost * RULES.buildingSaleRatio);
  } else if (asset.aquaculture > 0) {
    asset.aquaculture--;
    refund = Math.floor(RULES.aquacultureCost * RULES.buildingSaleRatio);
  } else if (asset.equipped) {
    asset.equipped = false;
    refund = Math.floor(RULES.equipmentCost * RULES.buildingSaleRatio);
  } else return false;
  player.cash += refund;
  log(state, 'assetSold', { playerId: player.id, propertyId: property.id, amount: refund });
  return true;
}
/** Settle a debt without ever minting the unpaid remainder for its creditor. */
function pay(state, player, amount, creditor = null, type = 'payment', propertyId = undefined) {
  const owned = ownerProperties(state, player.id);
  for (const property of owned) {
    while (player.cash < amount && sellOne(state, player, property)) {
      /* sell upgrades first */
    }
    if (player.cash >= amount) break;
  }
  // Investment shares are liquidated at their displayed half-price valuation.
  while (player.cash < amount && player.investments.length) {
    const project = projectById.get(player.investments.pop());
    const refund = project.cost / 2;
    player.cash += refund;
    log(state, 'investmentSold', { playerId: player.id, projectId: project.id, amount: refund });
  }
  for (const property of owned) {
    if (player.cash >= amount) break;
    const asset = state.properties[property.id];
    if (!asset.mortgaged) {
      const refund = Math.floor(property.price * RULES.mortgageRatio);
      asset.mortgaged = true;
      player.cash += refund;
      log(state, 'mortgaged', { playerId: player.id, propertyId: property.id, amount: refund });
    }
  }
  const paid = Math.min(player.cash, amount);
  player.cash -= paid;
  if (creditor) creditor.cash += paid;
  log(state, type, {
    playerId: player.id,
    ...(creditor ? { creditorId: creditor.id } : {}),
    ...(propertyId ? { propertyId } : {}),
    amount: paid,
    owed: amount,
  });
  if (paid < amount) {
    removePlayerAssets(state, player);
    log(state, 'bankrupt', { playerId: player.id });
    checkSurvivors(state);
  }
}
function finishTurn(state) {
  if (state.status !== 'playing' || checkSurvivors(state)) return;
  const previous = state.players.findIndex((p) => p.id === state.currentPlayerId);
  let next = previous;
  do {
    next = (next + 1) % state.players.length;
    if (next === 0) {
      if (state.round >= state.maxRounds) {
        finish(state, 'roundLimit');
        return;
      }
      state.round++;
      state.ecology = Math.min(100, state.ecology + 2);
      log(state, 'roundStarted', { round: state.round });
    }
  } while (state.players[next].bankrupt);
  state.currentPlayerId = state.players[next].id;
  state.phase = 'roll';
  state.pendingPropertyId = null;
  log(state, 'turnStarted', { playerId: state.currentPlayerId });
}
function incomeOnPass(state, player) {
  player.cash += RULES.passReward;
  log(state, 'passedStart', { playerId: player.id, amount: RULES.passReward });
  player.food++;
  if (player.food >= 4) {
    player.food = 0;
    player.cash += RULES.foodReward;
    log(state, 'foodRedeemed', { playerId: player.id, amount: RULES.foodReward });
  }
  const factor = state.ecology < 30 ? 0.5 : state.ecology < 50 ? 0.75 : 1;
  let income = 0;
  for (const property of ownerProperties(state, player.id)) {
    const asset = state.properties[property.id];
    if (!asset.mortgaged) income += Math.floor(RULES.aquacultureIncome[asset.aquaculture] * factor);
  }
  if (income) {
    player.cash += income;
    log(state, 'aquacultureIncome', { playerId: player.id, amount: income });
  }
}
function land(state, player, depth = 0) {
  if (state.status !== 'playing' || player.bankrupt) return;
  const cell = BOARD[player.position];
  log(state, 'landed', { playerId: player.id, cellIndex: player.position });
  if (cell.type === 'teleport') {
    // Portals do not count as passing start and cannot chain indefinitely.
    if (depth < 3) {
      player.position = cell.target;
      log(state, 'teleported', { playerId: player.id, cellIndex: cell.index, target: cell.target });
      land(state, player, depth + 1);
    }
  } else if (cell.type === 'property') {
    const asset = state.properties[cell.propertyId];
    if (!asset.ownerId) {
      state.phase = 'purchase';
      state.pendingPropertyId = cell.propertyId;
    } else if (asset.ownerId !== player.id) {
      const rent = getRent(state, cell.propertyId);
      if (rent > 0)
        pay(state, player, rent, playerIn(state, asset.ownerId), 'rentPaid', cell.propertyId);
    }
  } else if (cell.type === 'rest') {
    player.skipTurns = 1;
    log(state, 'rest', { playerId: player.id });
  } else if (cell.type === 'bonus') {
    player.cash += 300;
    log(state, 'bonus', { playerId: player.id, amount: 300 });
  } else if (cell.type === 'chance' || cell.type === 'destiny') {
    const card = Math.floor(random(state) * 4);
    const delta = cell.type === 'chance' ? 5 : -5;
    state.ecology = Math.min(100, Math.max(0, state.ecology + delta));
    if (card === 0) {
      player.cash += 500;
      log(state, 'cardReward', { playerId: player.id, amount: 500, deck: cell.type, card });
    } else if (card === 1) {
      pay(state, player, cell.type === 'chance' ? 200 : 600, null, 'cardPenalty');
    } else if (card === 2) {
      const amount = cell.type === 'chance' ? 300 : 150;
      player.cash += amount;
      log(state, 'cardReward', { playerId: player.id, amount, deck: cell.type, card });
    } else {
      const amount = state.ecology >= 50 ? 250 : 400;
      if (state.ecology >= 50) {
        player.cash += amount;
        log(state, 'ecoReward', { playerId: player.id, amount });
      } else pay(state, player, amount, null, 'ecoPenalty');
    }
  }
}

export function applyAction(state, playerId, action) {
  if (state.status !== 'playing') fail('GAME_FINISHED');
  const player = playerIn(state, playerId);
  if (!player) fail('PLAYER_UNKNOWN');
  if (player.bankrupt) fail('PLAYER_BANKRUPT');
  if (state.currentPlayerId !== playerId && action?.type !== 'surrender') fail('NOT_YOUR_TURN');
  if (!action || typeof action !== 'object' || Array.isArray(action)) fail('ILLEGAL_ACTION');
  const matched = getLegalActions(state, playerId).find(
    (candidate) =>
      candidate.type === action.type &&
      candidate.propertyId === action.propertyId &&
      candidate.projectId === action.projectId,
  );
  if (!matched) fail('ILLEGAL_ACTION');
  const next = clone(state);
  const actor = playerIn(next, playerId);
  const property = propertyById.get(action.propertyId);
  const asset = next.properties[action.propertyId];
  next.revision++;
  switch (action.type) {
    case 'roll': {
      if (actor.skipTurns > 0) {
        actor.skipTurns--;
        next.lastDice = [0, 0];
        log(next, 'turnSkipped', { playerId });
        finishTurn(next);
        break;
      }
      // Income is paid once per actual turn, never on reconnect, asset commands or extra rolls.
      let income = 0;
      for (const id of actor.investments) {
        const project = projectById.get(id);
        income += Math.floor(project.income * (id === 'nuclear' && next.ecology < 30 ? 0.5 : 1));
      }
      if (income) {
        actor.cash += income;
        log(next, 'investmentIncome', { playerId, amount: income });
      }
      const dice = [1 + Math.floor(random(next) * 6), 1 + Math.floor(random(next) * 6)];
      next.lastDice = dice;
      next.phase = 'manage';
      const position = actor.position + dice[0] + dice[1];
      actor.position = position % BOARD.length;
      log(next, 'rolled', { playerId, dice });
      if (position >= BOARD.length) incomeOnPass(next, actor);
      land(next, actor);
      if (actor.bankrupt && next.status === 'playing') finishTurn(next);
      break;
    }
    case 'buy':
      actor.cash -= property.price;
      asset.ownerId = playerId;
      next.phase = 'manage';
      next.pendingPropertyId = null;
      log(next, 'propertyBought', { playerId, propertyId: property.id, amount: property.price });
      break;
    case 'decline':
      log(next, 'purchaseDeclined', { playerId, propertyId: next.pendingPropertyId });
      next.phase = 'manage';
      next.pendingPropertyId = null;
      break;
    case 'endTurn':
      finishTurn(next);
      break;
    case 'build':
      actor.cash -= property.buildCost;
      asset.level++;
      log(next, 'built', {
        playerId,
        propertyId: property.id,
        amount: property.buildCost,
        level: asset.level,
      });
      break;
    case 'sellBuilding':
      sellOne(next, actor, property);
      break;
    case 'mortgage':
      asset.mortgaged = true;
      actor.cash += Math.floor(property.price * RULES.mortgageRatio);
      log(next, 'mortgaged', {
        playerId,
        propertyId: property.id,
        amount: Math.floor(property.price * RULES.mortgageRatio),
      });
      break;
    case 'redeem': {
      const cost = redemptionCost(property);
      actor.cash -= cost;
      asset.mortgaged = false;
      log(next, 'redeemed', { playerId, propertyId: property.id, amount: cost });
      break;
    }
    case 'aquaculture':
      actor.cash -= RULES.aquacultureCost;
      asset.aquaculture++;
      log(next, 'aquacultureBuilt', {
        playerId,
        propertyId: property.id,
        amount: RULES.aquacultureCost,
        level: asset.aquaculture,
      });
      break;
    case 'equip':
      actor.cash -= RULES.equipmentCost;
      asset.equipped = true;
      log(next, 'equipped', { playerId, propertyId: property.id, amount: RULES.equipmentCost });
      break;
    case 'invest': {
      const project = projectById.get(action.projectId);
      actor.cash -= project.cost;
      actor.investments.push(project.id);
      log(next, 'invested', { playerId, projectId: project.id, amount: project.cost });
      break;
    }
    case 'surrender':
      removePlayerAssets(next, actor);
      log(next, 'surrendered', { playerId });
      if (!checkSurvivors(next) && state.currentPlayerId === playerId) finishTurn(next);
      break;
  }
  return next;
}

/** Transparent, deterministic policy: same rules, dice and legal moves as humans. */
export function chooseAIAction(
  state,
  playerId,
  difficulty = playerIn(state, playerId)?.difficulty ?? 'normal',
) {
  const legal = getLegalActions(state, playerId);
  const player = playerIn(state, playerId);
  if (state.currentPlayerId !== playerId || !player || !legal.length) fail('NO_LEGAL_ACTION');
  const level = difficulties.has(difficulty) ? difficulty : 'normal';
  const reserve = { easy: 3800, normal: 2600, hard: 1800 }[level];
  if (state.phase === 'roll') return legal.find((a) => a.type === 'roll');
  const turnsLeft = Math.max(0, state.maxRounds - state.round);
  if (state.phase === 'purchase') {
    const buy = legal.find((a) => a.type === 'buy');
    if (!buy) return legal.find((a) => a.type === 'decline');
    const property = propertyById.get(buy.propertyId);
    const sameGroup = ownerProperties(state, playerId).filter(
      (p) => p.group === property.group,
    ).length;
    const protectedCash =
      level === 'hard' && sameGroup >= GROUPS[property.group].required - 1
        ? reserve * 0.65
        : reserve;
    return player.cash - property.price >= protectedCash &&
      (level !== 'easy' || property.price <= 2200)
      ? buy
      : legal.find((a) => a.type === 'decline');
  }
  const others = state.players.filter((p) => !p.bankrupt && p.id !== playerId).length;
  const exposure =
    level === 'hard'
      ? PROPERTIES.reduce((sum, p) => {
          const asset = state.properties[p.id];
          return (
            sum +
            (asset.ownerId && asset.ownerId !== playerId ? getRent(state, p.id) / BOARD.length : 0)
          );
        }, 0)
      : 0;
  const cashBuffer = reserve + Math.floor(exposure * 3);
  const candidates = [];
  for (const action of legal) {
    const property = propertyById.get(action.propertyId);
    const asset = state.properties[action.propertyId];
    let cost = 0;
    let gain = 0;
    const visits = Math.max(
      0,
      turnsLeft *
        others *
        (level === 'hard' && property ? landingWeights[property.cellIndex] : 1 / BOARD.length),
    );
    if (action.type === 'build') {
      cost = property.buildCost;
      const base = getRent(state, property.id);
      gain =
        property.baseRent *
          (RULES.rentMultipliers[asset.level + 1] - RULES.rentMultipliers[asset.level]) *
          visits -
        cost / 2;
      if (
        level === 'hard' &&
        RULES.ironTriangle.includes(property.id) &&
        RULES.ironTriangle.every((id) => state.properties[id].ownerId === playerId)
      )
        gain += RULES.ironTriangleBonus / 9;
      if (base === 0) gain = -1;
    } else if (action.type === 'equip') {
      cost = RULES.equipmentCost;
      gain = getRent(state, property.id) * 0.2 * visits - cost / 2;
    } else if (action.type === 'aquaculture' && level !== 'easy') {
      cost = RULES.aquacultureCost;
      gain =
        (((RULES.aquacultureIncome[asset.aquaculture + 1] -
          RULES.aquacultureIncome[asset.aquaculture]) *
          turnsLeft) /
          5.5) *
          (state.ecology < 50 ? 0.65 : 1) -
        cost / 2;
    } else if (action.type === 'invest') {
      const project = projectById.get(action.projectId);
      cost = project.cost;
      gain =
        project.income * turnsLeft * (project.id === 'nuclear' && state.ecology < 30 ? 0.5 : 1) -
        cost / 2;
      if (level === 'easy' && project.id === 'nuclear') gain = -1;
    } else if (action.type === 'redeem') {
      cost = redemptionCost(property);
      gain = property.baseRent * visits - cost * 0.1;
    } else continue;
    if (player.cash - cost < cashBuffer || gain <= 0) continue;
    // Easy policy uses a short horizon; hard uses expected value per unit of cash.
    const score = level === 'hard' ? gain / cost : level === 'easy' ? gain * 0.5 : gain;
    candidates.push({ action, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.action ?? legal.find((a) => a.type === 'endTurn');
}
