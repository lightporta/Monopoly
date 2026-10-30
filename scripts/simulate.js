#!/usr/bin/env node
import { createGame, applyAction, chooseAIAction, getNetWorth, RULES } from '../shared/index.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const seeds = Number(flag('--seeds', 10));
const rounds = Number(flag('--rounds', RULES.defaultMaxRounds));
const seedPrefix = flag('--seed', 'balance-v4');
if (
  !Number.isInteger(seeds) ||
  seeds < 1 ||
  seeds > 1000 ||
  !Number.isInteger(rounds) ||
  rounds < 1 ||
  rounds > 200
) {
  process.stderr.write(
    'Usage: node scripts/simulate.js [--seeds 1..1000] [--rounds 1..200] [--seed text]\n',
  );
  process.exit(1);
}
const scenarios = [
  { name: 'easy-v-normal', levels: ['easy', 'normal'] },
  { name: 'normal-v-hard', levels: ['normal', 'hard'] },
  { name: 'easy-v-hard', levels: ['easy', 'hard'] },
  { name: 'mixed-three', levels: ['easy', 'normal', 'hard'] },
  { name: 'equal-normal', levels: ['normal', 'normal', 'normal'] },
];
const summaries = [];
let totalActions = 0;
for (const scenario of scenarios) {
  const summary = {
    scenario: scenario.name,
    levels: scenario.levels,
    games: 0,
    completed: 0,
    ties: 0,
    winsByDifficulty: Object.fromEntries([...new Set(scenario.levels)].map((level) => [level, 0])),
    winsBySeat: Array(scenario.levels.length).fill(0),
    finishReasons: {},
    totalRounds: 0,
    totalActions: 0,
    netWorthByDifficulty: Object.fromEntries(
      [...new Set(scenario.levels)].map((level) => [level, { total: 0, entries: 0 }]),
    ),
  };
  for (let seedIndex = 0; seedIndex < seeds; seedIndex++) {
    for (let rotation = 0; rotation < scenario.levels.length; rotation++) {
      const players = scenario.levels.map((_, seat) => {
        const difficulty = scenario.levels[(seat + rotation) % scenario.levels.length];
        return { id: `seat-${seat}`, name: `${difficulty} ${seat + 1}`, isAI: true, difficulty };
      });
      let state = createGame({ players, seed: `${seedPrefix}-${seedIndex}`, maxRounds: rounds });
      let actions = 0;
      while (state.status === 'playing' && actions < 20000) {
        state = applyAction(
          state,
          state.currentPlayerId,
          chooseAIAction(state, state.currentPlayerId),
        );
        actions++;
      }
      summary.games++;
      summary.totalActions += actions;
      summary.totalRounds += state.round;
      if (state.status !== 'finished') continue;
      summary.completed++;
      if (state.winnerIds.length > 1) summary.ties++;
      summary.finishReasons[state.finishReason] =
        (summary.finishReasons[state.finishReason] ?? 0) + 1;
      for (const player of state.players) {
        const worth = summary.netWorthByDifficulty[player.difficulty];
        worth.total += getNetWorth(state, player.id);
        worth.entries++;
        if (state.winnerIds.includes(player.id)) {
          const share = 1 / state.winnerIds.length;
          summary.winsByDifficulty[player.difficulty] += share;
          summary.winsBySeat[state.players.indexOf(player)] += share;
        }
      }
    }
  }
  totalActions += summary.totalActions;
  summary.averageRounds = Number((summary.totalRounds / summary.games).toFixed(2));
  summary.averageActions = Number((summary.totalActions / summary.games).toFixed(2));
  summary.winsByDifficulty = Object.fromEntries(
    Object.entries(summary.winsByDifficulty).map(([level, wins]) => [
      level,
      { wins: Number(wins.toFixed(3)), share: Number((wins / summary.games).toFixed(4)) },
    ]),
  );
  summary.winsBySeat = summary.winsBySeat.map((wins) => ({
    wins: Number(wins.toFixed(3)),
    share: Number((wins / summary.games).toFixed(4)),
  }));
  summary.averageNetWorth = Object.fromEntries(
    Object.entries(summary.netWorthByDifficulty).map(([level, value]) => [
      level,
      Math.round(value.total / value.entries),
    ]),
  );
  delete summary.netWorthByDifficulty;
  delete summary.totalRounds;
  delete summary.totalActions;
  summaries.push(summary);
}
const report = {
  engineVersion: RULES.version,
  seedPrefix,
  seedsPerScenario: seeds,
  maxRounds: rounds,
  totalGames: summaries.reduce((sum, summary) => sum + summary.games, 0),
  completedGames: summaries.reduce((sum, summary) => sum + summary.completed, 0),
  totalActions,
  interpretation:
    'Seeded AI self-play with each difficulty rotated through every seat. Ties split win credit. These results measure this policy suite, not human win rates or production networking.',
  scenarios: summaries,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.completedGames !== report.totalGames) process.exitCode = 1;
