# Shared engine v4 contract

`index.js` is dependency-free ESM. `createGame`, `applyAction`, `getLegalActions`,
`chooseAIAction`, `getNetWorth`, `getRent` are the stable API; board, property,
group and rule exports contain bilingual labels. Actions use `type`; property
actions also use `propertyId`; `invest` also uses `projectId`.

Player `food` is an integer 0–3; the fourth pass-start food token is redeemed
automatically. Player `investments` is an array of project ID strings.
`RULES.investments` is an array of `{id,name:{zh,en},cost,income,maxCopies}`.
Logs contain stable `type`, IDs, amounts, and optional metadata; the UI translates
these codes. All money and levels are integers. Net worth includes a 3,000-point
bonus when owning all three landmark properties with each building level 3.
The bonus is score only and paid once through valuation, never cash.

Only the current non-bankrupt player may act, except `surrender`, which is legal
for any active player to support leaving online games. `roll` is only legal in
`roll`, `buy`/`decline` only in `purchase`; asset development/management and
`endTurn` only in `manage`. `surrender` is legal in all unfinished phases.
`applyAction` never mutates the input and increments revision once per accepted
action. Invalid actions throw `Error` with code `GAME_FINISHED`, `PLAYER_UNKNOWN`,
`PLAYER_BANKRUPT`, `NOT_YOUR_TURN`, or `ILLEGAL_ACTION`; invalid game setup throws
`INVALID_SETUP`. Finished games reject every action.

A turn has exactly one roll (doubles grant no extra turn). Movement resolves rent,
cards and automatic portals before entering purchase/manage. Rent and all debts
are mandatory, liquidate assets automatically and credit only recovered money.
A full-round limit resolves by net worth with exact ties sharing victory.
No auctions, voluntary player trades, destination selection, or reroll coupons.

State fields are as requested by the parent implementation contract, with no
additional top-level fields. Public online snapshots may remove `seed` and
`rngState`; clients must never run `applyAction` on those snapshots. Legal-action
and net-worth functions work on public snapshots.

## Final v4 economy parameters

- Initial cash 12,000; natural pass-start reward 1,200; four food tokens redeem 1,000.
- Houses cost each property's `buildCost`, max three; rent multipliers 1/3/6/10.
- Active color-group threshold multiplies all rents by 1.5; equipment costs 1,000
  per property and multiplies rent by 1.2, once.
- Farming costs 1,000 per level (max three), pays 200/450/750 on a natural pass.
  Ecology below 50 multiplies farming by .75, below 30 by .5.
- Wind costs 2,500, pays 55 per actual turn, global two copies, one per player.
  Nuclear costs 4,000, pays 90, global one copy; ecology below 30 halves its income.
- Investments pay at `roll`, before dice, never on skipped turns. Both shares are
  included in net worth and automatic debt liquidation at half original cost.
- `getNetWorth`: cash + property price minus mortgage principal + half upgrade,
  equipment and investment costs + the conditional 3,000 landmark score bonus.
- `sellBuilding` removes one house level, else one farm level, else equipment.
- Seeded simulation with `--seeds 100` produces 1,200 games with every difficulty
  rotated through all seats. Results concern AI self-play only.
- `chooseAIAction` on an invalid/non-current/finished turn throws `NO_LEGAL_ACTION`.
