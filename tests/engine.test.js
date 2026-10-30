import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD,
  PROPERTIES,
  RULES,
  createGame,
  applyAction,
  getLegalActions,
  getNetWorth,
  getRent,
  chooseAIAction,
} from '../shared/index.js';

const setup = (options = {}) =>
  createGame({
    players: [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ],
    seed: 'regression',
    ...options,
  });
const managed = () => {
  const state = setup();
  state.phase = 'manage';
  return state;
};
const own = (state, id, playerId = 'a', changes = {}) =>
  Object.assign(state.properties[id], { ownerId: playerId, ...changes });
const errorCode = (fn, code) => assert.throws(fn, (error) => error.code === code);
const seedFor = (steps) => {
  for (let seed = 0; seed < 500; seed++) {
    const state = setup({ seed });
    const next = applyAction(state, 'a', { type: 'roll' });
    if (next.lastDice.reduce((a, b) => a + b, 0) === steps) return seed;
  }
  throw new Error(`No seed for ${steps}`);
};

test('one bilingual 36-cell board contains exactly 21 unique property references', () => {
  assert.equal(BOARD.length, 36);
  assert.equal(PROPERTIES.length, 21);
  assert.equal(new Set(PROPERTIES.map((p) => p.id)).size, 21);
  for (const cell of BOARD) {
    assert.ok(cell.name.zh && cell.name.en);
    if (cell.propertyId)
      assert.equal(PROPERTIES.find((p) => p.id === cell.propertyId).cellIndex, cell.index);
    if (cell.type === 'teleport') assert.ok(BOARD[cell.target]);
  }
});

test('setup rejects duplicate IDs, too few players, blank names and bad round limits', () => {
  errorCode(() => createGame(), 'INVALID_SETUP');
  errorCode(() => createGame({ players: [{ id: 'a', name: 'a' }] }), 'INVALID_SETUP');
  errorCode(
    () =>
      createGame({
        players: [
          { id: 'a', name: 'a' },
          { id: 'a', name: 'b' },
        ],
      }),
    'INVALID_SETUP',
  );
  errorCode(
    () =>
      createGame({
        players: [
          { id: 'a', name: ' ' },
          { id: 'b', name: 'b' },
        ],
      }),
    'INVALID_SETUP',
  );
  errorCode(() => setup({ maxRounds: 0 }), 'INVALID_SETUP');
  errorCode(() => setup({ seed: NaN }), 'INVALID_SETUP');
});

test('seeded dice and commands are reproducible and never mutate the previous snapshot', () => {
  const initial = setup();
  const original = structuredClone(initial);
  const first = applyAction(initial, 'a', { type: 'roll' });
  assert.deepEqual(initial, original);
  assert.deepEqual(first, applyAction(setup(), 'a', { type: 'roll' }));
  assert.equal(first.revision, 1);
  assert.notEqual(first.rngState, initial.rngState);
});

test('phase guards prevent skipping purchase, repeated rolls and out-of-turn actions', () => {
  const state = setup({ seed: seedFor(3) });
  errorCode(() => applyAction(state, 'b', { type: 'roll' }), 'NOT_YOUR_TURN');
  errorCode(() => applyAction(state, 'unknown', { type: 'roll' }), 'PLAYER_UNKNOWN');
  errorCode(() => applyAction(state, 'a', { type: 'endTurn' }), 'ILLEGAL_ACTION');
  const purchase = applyAction(state, 'a', { type: 'roll' });
  assert.equal(purchase.phase, 'purchase');
  errorCode(() => applyAction(purchase, 'a', { type: 'endTurn' }), 'ILLEGAL_ACTION');
  errorCode(() => applyAction(purchase, 'a', { type: 'roll' }), 'ILLEGAL_ACTION');
  errorCode(
    () => applyAction(purchase, 'a', { type: 'buy', propertyId: 'prop_24' }),
    'ILLEGAL_ACTION',
  );
  const bought = applyAction(purchase, 'a', {
    type: 'buy',
    propertyId: purchase.pendingPropertyId,
  });
  assert.equal(bought.phase, 'manage');
  assert.equal(bought.pendingPropertyId, null);
  const next = applyAction(bought, 'a', { type: 'endTurn' });
  assert.equal(next.currentPlayerId, 'b');
  assert.equal(next.phase, 'roll');
});

test('mandatory rent liquidates upgrades before mortgages and transfers only actual recovery', () => {
  const state = setup({ seed: seedFor(3) });
  state.players[0].cash = 100;
  own(state, 'prop_03', 'b', { level: 3 }); // 700 rent
  own(state, 'prop_01', 'a', { level: 1 }); // first sell 240, then mortgage 600
  const paid = applyAction(state, 'a', { type: 'roll' });
  assert.equal(paid.players[0].cash, 240);
  assert.equal(paid.players[1].cash, RULES.initialCash + 700);
  assert.equal(paid.properties.prop_01.level, 0);
  assert.equal(paid.properties.prop_01.mortgaged, true);
  assert.equal(paid.players[0].bankrupt, false);
  assert.equal(paid.phase, 'manage');
  const noAssets = setup({ seed: seedFor(3) });
  noAssets.players[0].cash = 100;
  own(noAssets, 'prop_03', 'b', { level: 3 });
  const bankrupt = applyAction(noAssets, 'a', { type: 'roll' });
  assert.equal(bankrupt.players[0].bankrupt, true);
  assert.equal(bankrupt.players[0].cash, 0);
  assert.equal(bankrupt.players[1].cash, RULES.initialCash + 100);
  assert.deepEqual(bankrupt.winnerIds, ['b']);
  assert.equal(bankrupt.finishReason, 'lastStanding');
});

test('bankruptcy frees investment copies and all property state', () => {
  const state = setup({ seed: seedFor(3) });
  state.players[0].cash = 0;
  state.players[0].investments = ['wind'];
  own(state, 'prop_01', 'a', { mortgaged: true });
  own(state, 'prop_03', 'b', { level: 3, equipped: true });
  const end = applyAction(state, 'a', { type: 'roll' });
  // Wind pays 55 once; 1250 liquidation covers the 840 debt, so no bankruptcy.
  assert.equal(end.players[0].bankrupt, false);
  assert.equal(end.players[0].cash, 465);
  assert.deepEqual(end.players[0].investments, []);
  const surrendered = applyAction(end, 'a', { type: 'surrender' });
  assert.deepEqual(surrendered.properties.prop_01, {
    ownerId: null,
    level: 0,
    mortgaged: false,
    aquaculture: 0,
    equipped: false,
  });
  assert.equal(surrendered.players[0].food, 0);
});

test('mortgage cannot create net worth and redemption charges explicit interest', () => {
  const state = managed();
  own(state, 'prop_01');
  const worth = getNetWorth(state, 'a');
  const mortgaged = applyAction(state, 'a', { type: 'mortgage', propertyId: 'prop_01' });
  assert.equal(getNetWorth(mortgaged, 'a'), worth);
  assert.equal(getRent(mortgaged, 'prop_01'), 0);
  errorCode(
    () => applyAction(mortgaged, 'a', { type: 'build', propertyId: 'prop_01' }),
    'ILLEGAL_ACTION',
  );
  const redeemed = applyAction(mortgaged, 'a', { type: 'redeem', propertyId: 'prop_01' });
  assert.equal(getNetWorth(redeemed, 'a'), worth - 60);
});

test('redemption charges exactly ten percent interest for every property, without float-ceiling overcharges', () => {
  for (const property of PROPERTIES) {
    const state = managed();
    own(state, property.id, 'a', { mortgaged: true });
    const expected = ((property.price / 2) * 11) / 10;
    state.players[0].cash = expected;
    const next = applyAction(state, 'a', { type: 'redeem', propertyId: property.id });
    assert.equal(next.players[0].cash, 0, property.id);
    assert.equal(next.properties[property.id].mortgaged, false);
  }
});

test('house/farm paths are exclusive, levels capped and equipment is available on ordinary owned land', () => {
  let state = managed();
  own(state, 'prop_09');
  state = applyAction(state, 'a', { type: 'aquaculture', propertyId: 'prop_09' });
  errorCode(
    () => applyAction(state, 'a', { type: 'build', propertyId: 'prop_09' }),
    'ILLEGAL_ACTION',
  );
  state = applyAction(state, 'a', { type: 'equip', propertyId: 'prop_09' });
  assert.equal(getRent(state, 'prop_09'), 84);
  errorCode(
    () => applyAction(state, 'a', { type: 'equip', propertyId: 'prop_09' }),
    'ILLEGAL_ACTION',
  );
  state = applyAction(state, 'a', { type: 'sellBuilding', propertyId: 'prop_09' });
  assert.equal(state.properties.prop_09.aquaculture, 0);
  for (let level = 0; level < 3; level++)
    state = applyAction(state, 'a', { type: 'build', propertyId: 'prop_09' });
  errorCode(
    () => applyAction(state, 'a', { type: 'build', propertyId: 'prop_09' }),
    'ILLEGAL_ACTION',
  );
  errorCode(
    () => applyAction(state, 'a', { type: 'aquaculture', propertyId: 'prop_09' }),
    'ILLEGAL_ACTION',
  );
});

test('group bonuses count active deeds and equipment multiplies once', () => {
  const state = managed();
  for (const p of PROPERTIES.filter((p) => p.group === 'history')) own(state, p.id);
  assert.equal(getRent(state, 'prop_03'), 105);
  state.properties.prop_03.equipped = true;
  assert.equal(getRent(state, 'prop_03'), 126);
  state.properties.prop_04.mortgaged = true;
  assert.equal(getRent(state, 'prop_03'), 84);
});

test('investment limits hold globally and income cannot be farmed by repeated commands', () => {
  let state = managed();
  state = applyAction(state, 'a', { type: 'invest', projectId: 'nuclear' });
  const cash = state.players[0].cash;
  errorCode(
    () => applyAction(state, 'a', { type: 'invest', projectId: 'nuclear' }),
    'ILLEGAL_ACTION',
  );
  errorCode(() => applyAction(state, 'a', { type: 'roll' }), 'ILLEGAL_ACTION');
  assert.equal(state.players[0].cash, cash);
  state = applyAction(state, 'a', { type: 'endTurn' });
  state.phase = 'manage';
  errorCode(
    () => applyAction(state, 'b', { type: 'invest', projectId: 'nuclear' }),
    'ILLEGAL_ACTION',
  );
  state = applyAction(state, 'b', { type: 'endTurn' });
  const rolled = applyAction(state, 'a', { type: 'roll' });
  assert.equal(rolled.log.filter((entry) => entry.type === 'investmentIncome').length, 1);
});

test('pass-start settles food and farming once; portal jumps award no pass income', () => {
  const state = setup({ seed: seedFor(3) });
  state.players[0].position = 34;
  state.players[0].food = 3;
  own(state, 'prop_09', 'a', { aquaculture: 3 });
  const passed = applyAction(state, 'a', { type: 'roll' });
  assert.equal(passed.players[0].position, 1);
  assert.equal(passed.players[0].cash, RULES.initialCash + 1200 + 1000 + 750);
  assert.equal(passed.players[0].food, 0);
  const portal = setup({ seed: seedFor(5) });
  portal.players[0].position = 30;
  const jumped = applyAction(portal, 'a', { type: 'roll' });
  assert.equal(jumped.players[0].position, 0);
  assert.equal(jumped.players[0].cash, RULES.initialCash);
  assert.equal(jumped.players[0].food, 0);
});

test('rest consumes exactly one future turn, does not pay investment income and cannot hang a match', () => {
  const state = setup({ seed: seedFor(3) });
  state.players[0].position = 15;
  state.players[0].investments = ['wind'];
  let next = applyAction(state, 'a', { type: 'roll' });
  assert.equal(next.players[0].skipTurns, 1);
  next = applyAction(next, 'a', { type: 'endTurn' });
  next.phase = 'manage';
  next = applyAction(next, 'b', { type: 'endTurn' });
  const cash = next.players[0].cash;
  next = applyAction(next, 'a', { type: 'roll' });
  assert.equal(next.players[0].skipTurns, 0);
  assert.equal(next.players[0].cash, cash);
  assert.equal(next.currentPlayerId, 'b');
});

test('full-round cap compares everyone together, permits exact ties and locks finished games', () => {
  let state = setup({ maxRounds: 1 });
  state.phase = 'manage';
  state = applyAction(state, 'a', { type: 'endTurn' });
  assert.equal(state.status, 'playing');
  state.phase = 'manage';
  state = applyAction(state, 'b', { type: 'endTurn' });
  assert.equal(state.status, 'finished');
  assert.deepEqual(state.winnerIds, ['a', 'b']);
  assert.equal(state.finishReason, 'roundLimit');
  assert.equal(state.round, 1);
  errorCode(() => applyAction(state, 'b', { type: 'endTurn' }), 'GAME_FINISHED');
  assert.deepEqual(getLegalActions(state, 'a'), []);
});

test('iron triangle adds score, never mints cash or prematurely ends a match', () => {
  const state = managed();
  const before = getNetWorth(state, 'a');
  for (const id of RULES.ironTriangle) own(state, id, 'a', { level: 3 });
  const baseValue = RULES.ironTriangle.reduce((sum, id) => {
    const p = PROPERTIES.find((p) => p.id === id);
    return sum + p.price + (p.buildCost * 3) / 2;
  }, 0);
  assert.equal(getNetWorth(state, 'a'), before + baseValue + RULES.ironTriangleBonus);
  assert.equal(state.players[0].cash, RULES.initialCash);
  assert.equal(state.status, 'playing');
});

test('off-turn surrender keeps stable IDs and an unaffected player’s turn', () => {
  const state = createGame({
    players: [
      { id: 'a', name: 'a' },
      { id: 'b', name: 'b' },
      { id: 'c', name: 'c' },
    ],
    seed: 1,
  });
  const next = applyAction(state, 'b', { type: 'surrender' });
  assert.equal(next.currentPlayerId, 'a');
  assert.deepEqual(
    next.players.map((p) => p.id),
    ['a', 'b', 'c'],
  );
  assert.equal(next.players[1].bankrupt, true);
  errorCode(() => applyAction(next, 'b', { type: 'surrender' }), 'PLAYER_BANKRUPT');
});

test('public snapshots expose legal actions and valuation without RNG internals', () => {
  const state = setup();
  delete state.seed;
  delete state.rngState;
  assert.deepEqual(getLegalActions(state, 'a'), [{ type: 'roll' }, { type: 'surrender' }]);
  assert.equal(getNetWorth(state, 'a'), RULES.initialCash);
  assert.deepEqual(chooseAIAction(state, 'a'), { type: 'roll' });
});

test('all AI difficulties complete seeded two/three/four-player games using only legal commands', () => {
  for (let count = 2; count <= 4; count++) {
    for (let seed = 0; seed < 12; seed++) {
      let state = createGame({
        players: Array.from({ length: count }, (_, i) => ({
          id: `p${i}`,
          name: `Bot ${i}`,
          isAI: true,
          difficulty: ['easy', 'normal', 'hard'][i % 3],
        })),
        seed,
        maxRounds: 12,
      });
      let commands = 0;
      while (state.status === 'playing' && commands < 1500) {
        const id = state.currentPlayerId;
        const action = chooseAIAction(state, id);
        assert.ok(
          getLegalActions(state, id).some(
            (legal) => JSON.stringify(legal) === JSON.stringify(action),
          ),
        );
        state = applyAction(state, id, action);
        commands++;
        for (const p of state.players) assert.ok(Number.isSafeInteger(p.cash) && p.cash >= 0);
      }
      assert.equal(state.status, 'finished', `count=${count} seed=${seed}`);
      assert.ok(state.winnerIds.length >= 1);
      assert.ok(state.round <= 12);
    }
  }
});

test('doubles grant no repeat turn and a skipped bankrupt final seat does not delay the round cap', () => {
  let state;
  for (let seed = 0; seed < 500; seed++) {
    const candidate = applyAction(setup({ seed }), 'a', { type: 'roll' });
    if (candidate.lastDice[0] === candidate.lastDice[1]) {
      state = candidate;
      break;
    }
  }
  assert.ok(state);
  if (state.phase === 'purchase') state = applyAction(state, 'a', { type: 'decline' });
  state = applyAction(state, 'a', { type: 'endTurn' });
  assert.equal(state.currentPlayerId, 'b');
  let capped = createGame({
    players: [
      { id: 'a', name: 'a' },
      { id: 'b', name: 'b' },
      { id: 'c', name: 'c' },
    ],
    maxRounds: 1,
  });
  capped = applyAction(capped, 'c', { type: 'surrender' });
  capped.phase = 'manage';
  capped = applyAction(capped, 'a', { type: 'endTurn' });
  capped.phase = 'manage';
  capped = applyAction(capped, 'b', { type: 'endTurn' });
  assert.equal(capped.status, 'finished');
  assert.equal(capped.round, 1);
  assert.deepEqual(capped.winnerIds, ['a', 'b']);
});

test('ecology affects farming and nuclear income at exact thresholds with integer rounding', () => {
  for (const [ecology, farmIncome, investmentIncome] of [
    [29, 375, 100],
    [49, 562, 145],
    [50, 750, 145],
  ]) {
    const state = setup({ seed: seedFor(3) });
    state.ecology = ecology;
    state.players[0].position = 34;
    state.players[0].investments = ['wind', 'nuclear'];
    own(state, 'prop_09', 'a', { aquaculture: 3 });
    const next = applyAction(state, 'a', { type: 'roll' });
    assert.equal(
      next.players[0].cash,
      RULES.initialCash + RULES.passReward + farmIncome + investmentIncome,
    );
  }
});

test('ecology stays in range after cards and round recovery', () => {
  const high = setup({ seed: seedFor(2) });
  high.ecology = 99;
  assert.equal(applyAction(high, 'a', { type: 'roll' }).ecology, 100);
  const low = setup({ seed: seedFor(7) });
  low.ecology = 0;
  assert.equal(applyAction(low, 'a', { type: 'roll' }).ecology, 0);
  let recover = managed();
  recover.ecology = 99;
  recover = applyAction(recover, 'a', { type: 'endTurn' });
  recover.phase = 'manage';
  recover = applyAction(recover, 'b', { type: 'endTurn' });
  assert.equal(recover.ecology, 100);
});
