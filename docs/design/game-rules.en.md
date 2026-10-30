# Fairy Coast Monopoly v4 rules

[中文](game-rules.md) · [Shared engine contract](../../shared/CONTRACT.md)

Offline games and the online server use the same `shared/index.js` engine. Humans and AI have identical legal commands, rent, debt and scoring rules. The 36-cell board and 21 Yantai landmarks remain; this document replaces the v3 rules.

## Matches and turns

A match has 2–4 players, each starting with **12,000** cash. The default limit is **40 complete rounds**. Each seat gets one turn opportunity per round; bankrupt seats are skipped. The shared engine accepts 1–200 rounds, while online rooms accept 10–100.

A normal turn proceeds as follows:

1. Roll: receive one investment dividend payment, then roll two fair six-sided dice and advance.
2. Resolve the destination: portals, cards, rest and rent resolve automatically. An unowned property must be bought or declined before proceeding.
3. Manage assets: build, farm, equip, sell upgrades, mortgage, redeem or invest while the relevant cash and ownership conditions hold.
4. End the turn: advance to the next surviving seat.

**Doubles do not grant extra turns.** There is no triple-doubles penalty or reroll coupon. The bridge causes the player to miss their next turn opportunity; a skipped turn has no dice roll or dividends and advances automatically.

## Movement, portals and food

Natural forward movement past or exactly onto cell 0 awards **1,200** and one food token. Every fourth token automatically redeems for **1,000**, resetting the count. Food uses a visible counter rather than four separate collectible card types.

| Cell | Location | Fixed effect |
| --- | --- | --- |
| 5 | Yantai Lighthouse | Teleport to Penglai Pavilion, cell 24; resolve destination |
| 13 | Whale Shark Aquarium | Receive 300, then manage assets |
| 18 | Cross-sea Bridge | Skip the next personal turn |
| 25 | Eight Immortals Ferry | Teleport to Changdao Island, cell 27; resolve destination |
| 35 | Yantai Penglai Airport | Teleport to the start, cell 0 |

**Portal travel never awards start income or food**, including the airport jump to cell 0. Purchases and rent at a destination still resolve normally. Destinations are fixed, with no destination selection in v4.

## Properties, buildings and rent

Prices, base rent and each building level's cost come from the single data source in `shared/data.js`. Building on an individual property does not require owning its entire group. Each property supports **three building levels**, each costing its listed `buildCost`.

```text
rent = floor(base rent × building multiplier × group multiplier × equipment multiplier)
building multiplier: vacant 1; level 1: 3; level 2: 6; level 3: 10
group multiplier: 1.5 when its threshold is met, otherwise 1
equipment multiplier: 1.2 when equipped, otherwise 1
```

There is no global doubled-penalty factor. Owners pay no rent to themselves. Mortgaged properties collect no rent and do not count toward group thresholds.

| Group | Properties | Active-deed threshold |
| --- | --- | --- |
| Historic Quarter | 4 | All 4 |
| Coast | 8 | Any 4 |
| Mountains | 5 | All 5 |
| Hot Springs | 4 | All 4 |

A group's multiplier applies to all its unmortgaged properties, including buildings. Landing on another player's property settles rent immediately; neither humans nor AI can skip it.

## Farming, equipment and investments

**Farming** is available at Moon Bay, Yangma Island, Changdao Island and Wanniao Island. Each level costs **1,000**, up to three levels. Natural pass-start income is **200 / 450 / 750**. Farms and buildings are mutually exclusive on a property; farm levels do not increase rent. Selling all development allows changing the development path.

**Equipment** is available on any owned, unmortgaged property, costs **1,000**, and is limited to one item per property. It adds **20%** rent and can coexist with buildings or farming. The old airport shop and four separate equipment branches are replaced by this common upgrade.

**Investments** are purchased during management. Each player may hold one copy of each project, subject to global limits:

| Project | Cost | Dividend per normal personal turn | Global limit |
| --- | --- | --- | --- |
| Offshore Wind Farm | 2,500 | 55 | 2 copies |
| Haiyang Nuclear Project | 4,000 | 90 | 1 copy |

Dividends are paid once at the beginning of a legal `roll`. Managing assets, refreshing, reconnecting or sending repeated commands cannot repeat them. A newly acquired project first pays on its owner's next normal turn. Shares have no manual sale command; automatic debt liquidation recovers half their cost and releases their global copy. Bankruptcy and surrender also release copies. Low-ecology dividend reductions replace the former nuclear shutdown and chain-accident model.

## Ecology and cards

Global ecology starts at **70** and stays within 0–100. Drawing Chance adds 5; Destiny subtracts 5. Beginning the next complete round restores 2.

- Below 50, farming income is multiplied by 0.75; below 30, it is multiplied by 0.5 instead.
- Below 30, nuclear dividends are multiplied by 0.5.
- Reduced income is rounded down. Wind, start income and ordinary rent are unaffected.

Each deck has four equally likely outcomes. Ecology changes first, then the card resolves:

| Outcome | Chance | Destiny |
| --- | --- | --- |
| Reward | +500 | +500 |
| Expense | -200 | -600 |
| Small reward | +300 | +150 |
| Ecology settlement | +250 if current ecology is at least 50; otherwise -400 | Same |

Offline games and engine simulations use a seeded generator: the same seed and action sequence are reproducible. Before each online roll, the server injects fresh cryptographic entropy and excludes the seed and generator state from public snapshots. An online game therefore cannot be replayed from its opening seed alone.

## Mortgages, sales and debt

Buildings, farming and equipment recover **50% of their original cost**. One sell command removes one building level, otherwise one farm level, otherwise the equipment item. A property may be mortgaged only after all upgrades have been sold, receiving **50%** of its price. Redemption costs mortgage principal × **1.1**, rounded up.

All rent, fines and other expenses use one settlement procedure:

1. If cash is insufficient, sell buildings, farms and equipment in fixed property order, stopping when enough cash is available.
2. If necessary, liquidate investment shares in reverse acquisition order at 50% cost.
3. If necessary, mortgage unmortgaged properties at 50% price, stopping when funded.
4. Pay the creditor only the amount actually recovered, capped at the debt. Bank expenses simply remove that payment.
5. If the debt remains unpaid, mark the player bankrupt, set cash to zero and release all properties and upgrades to the bank.

**A landlord receives only money actually recovered.** The unpaid remainder is never added to their balance. AI cannot refuse payment because its cash is low.

## Net worth and victory

```text
net worth = cash
          + original property prices − mortgage principal
          + 50% of building, farming and equipment costs
          + 50% of investment costs
          + eligible landmark score bonus
```

Mortgage proceeds already appear in cash, so the corresponding principal is deducted from property equity. Borrowing cannot increase net worth. Investment shares can be liquidated for their displayed half-cost valuation when settling debt.

Owning Yantai Hill, Yangma Island and Penglai Pavilion, each **unmortgaged and at building level 3**, adds a **3,000-point** net-worth bonus. This is score, not cash; it does not accumulate and disappears when the conditions cease to hold. The landmark set no longer ends the match early, and the former first-to-30,000 victory is removed.

- The last non-bankrupt player wins immediately.
- At the complete-round limit, compare all surviving players' net worth together.
- Exact ties at the highest score share victory. Seat order never breaks a tie.
- Finished matches reject every subsequent command.

## AI and validation limits

AI chooses from `getLegalActions`. It cannot alter money, avoid rent or inspect future dice. Easy, normal and hard differ in cash reserves and return estimates. Hard also estimates landing probabilities from two-dice movement, portals and the bridge's missed turn, then considers rent and rounds remaining. Decisions are reproducible; a difficulty label does not guarantee a win.

```bash
npm test
npm run simulate -- --seeds 100
```

The v4 calibration run used seed prefix `balance-v4`, 100 seeds and every difficulty rotated through every seat: **1,200 AI self-play matches, 290,603 legal commands, all completed**. Hard received 52.5% of win credit against normal in two-player games. Mixed three-player results were easy 14.33%, normal 38.67%, hard 47%. Three identical normal policies split seat win credit 31% / 36% / 33%. Ties split one win equally.

These measurements concern this policy suite and seed set. They do not establish human win rates, exhaustive fairness or successful public-server deployment. Individual results still depend on dice.

## Migration from v3

v4 state and protocol are incompatible with v3 saved games, clients and running rooms. The theme and core asset systems remain, with deliberate simplifications: no auctions, player trades, selectable portal destinations, reroll coupons, hotels, separate food decks, four equipment branches or nuclear shutdown timers. Fixed portals, food counters, common equipment and ecology-based reductions replace those branches. Client and server no longer maintain separate rule implementations.
