// 游戏数据配置（服务端使用，与前端 monopoly/src/data/ 完全一致 — V3 统一版）
// 消除历史数据分叉：联机版与单机版使用同一张地图、同一套地产、同一套规则。

export const gameConfig = {
  version: '3.0.0',
  theme: '仙境海岸·烟台',
  player: { minCount: 2, maxCount: 4, initialCash: 15000 },
  dice: { count: 2, doublesLimit: 3, doublesPenaltyCell: 18 },
  start: { cellIndex: 0, passReward: 2000 },
  economy: {
    buildCostRatio: 0.4, mortgageRatio: 0.5, redeemMultiplier: 1.1,
    sellBuildingRatio: 0.5, auctionStartRatio: 0.5, auctionMinStep: 100,
    penaltyMultiplier: 2.0
  },
  rentMultipliers: { empty: 1.0, house1: 1.5, house2: 2.0, house3: 2.5, hotel: 3.5 },
  victory: { ironTriangle: ['烟台山', '蓬莱阁', '养马岛'], ironTriangleNeedHouses: true, ironTriangleMinAssets: 30000 },
  ecology: { initial: 50, min: 0, max: 100, naturalRecoveryTurns: 5, naturalRecoveryAmount: 2 },
  equipment: { price: 2000, sellRatio: 0.5, rentBoostMultiplier: 1.3 },
  aquaculture: { demolishRefundRatio: 0.5, debuffTurnsOnRedTide: 3, debuffFactor: 0.5 },
  nuclear: { reRollTicketsMax: 3, reRollTicketOnColorGroupComplete: 1 }
};

// 36 格棋盘 — 与前端 board.json 完全一致
export const board = [
  { index: 0, name: '仙境海岸', type: 'start', icon: '🏝️' },
  { index: 1, name: '芝罘湾广场', type: 'property', propertyRef: 'prop_01', colorGroup: 'coast' },
  { index: 2, name: '机会', type: 'chance', icon: '❓' },
  { index: 3, name: '所城里', type: 'property', propertyRef: 'prop_03', colorGroup: 'history' },
  { index: 4, name: '朝阳街', type: 'property', propertyRef: 'prop_04', colorGroup: 'history' },
  { index: 5, name: '烟台山灯塔', type: 'teleport', icon: '🗼', teleport: { mode: 'fixed', target: 24, passStart: false } },
  { index: 6, name: '烟台山', type: 'property', propertyRef: 'prop_06', colorGroup: 'history' },
  { index: 7, name: '命运', type: 'destiny', icon: '🔮' },
  { index: 8, name: '张裕酒文化博物馆', type: 'property', propertyRef: 'prop_08', colorGroup: 'history' },
  { index: 9, name: '月亮湾', type: 'property', propertyRef: 'prop_09', colorGroup: 'coast' },
  { index: 10, name: '机会', type: 'chance', icon: '❓' },
  { index: 11, name: '东炮台', type: 'property', propertyRef: 'prop_11', colorGroup: 'coast' },
  { index: 12, name: '渔人码头', type: 'property', propertyRef: 'prop_12', colorGroup: 'coast' },
  { index: 13, name: '海昌鲸鲨馆', type: 'move', icon: '🐳', effect: 'reroll' },
  { index: 14, name: '黄海明珠', type: 'property', propertyRef: 'prop_14', colorGroup: 'coast' },
  { index: 15, name: '命运', type: 'destiny', icon: '🔮' },
  { index: 16, name: '马山寨高尔夫', type: 'property', propertyRef: 'prop_16', colorGroup: 'mountain' },
  { index: 17, name: '养马岛', type: 'property', propertyRef: 'prop_17', colorGroup: 'mountain' },
  { index: 18, name: '养马岛跨海大桥', type: 'rest', icon: '🌉', effect: 'skipNextTurn' },
  { index: 19, name: '昆嵛山', type: 'property', propertyRef: 'prop_19', colorGroup: 'mountain' },
  { index: 20, name: '命运', type: 'destiny', icon: '🔮' },
  { index: 21, name: '龙泉温泉', type: 'property', propertyRef: 'prop_21', colorGroup: 'hotspring' },
  { index: 22, name: '龙湖北中国海', type: 'property', propertyRef: 'prop_22', colorGroup: 'hotspring' },
  { index: 23, name: '机会', type: 'chance', icon: '❓' },
  { index: 24, name: '蓬莱阁', type: 'property', propertyRef: 'prop_24', colorGroup: 'mountain' },
  { index: 25, name: '八仙渡海口', type: 'teleport', icon: '🚣', teleport: { mode: 'anyEmpty', passStart: false } },
  { index: 26, name: '三仙山', type: 'property', propertyRef: 'prop_26', colorGroup: 'mountain' },
  { index: 27, name: '长岛', type: 'property', propertyRef: 'prop_27', colorGroup: 'coast' },
  { index: 28, name: '命运', type: 'destiny', icon: '🔮' },
  { index: 29, name: '万鸟岛', type: 'property', propertyRef: 'prop_29', colorGroup: 'coast' },
  { index: 30, name: '金沙滩', type: 'property', propertyRef: 'prop_30', colorGroup: 'coast' },
  { index: 31, name: '机会', type: 'chance', icon: '❓' },
  { index: 32, name: '磁山温泉', type: 'property', propertyRef: 'prop_32', colorGroup: 'hotspring' },
  { index: 33, name: '天马栈桥', type: 'property', propertyRef: 'prop_33', colorGroup: 'hotspring' },
  { index: 34, name: '命运', type: 'destiny', icon: '🔮' },
  { index: 35, name: '烟台蓬莱国际机场', type: 'move', icon: '✈️', effect: 'anyCell' }
];

// 21 处地产 — 与前端 properties.json 完全一致（含养殖字段）
const aquaLevels = [
  { name: '育苗场', cost: 1500, income: 500 },
  { name: '养殖场', cost: 1500, income: 1200 },
  { name: '深海牧场', cost: 2000, income: 2500 }
];

export const properties = {
  prop_01: { id: 'prop_01', name: '芝罘湾广场', colorGroup: 'coast', price: 1200, baseRent: 60, buildCost: 480, rentByLevel: { empty: 60, house1: 300, house2: 600, house3: 900, hotel: 1200 } },
  prop_03: { id: 'prop_03', name: '所城里', colorGroup: 'history', price: 1400, baseRent: 70, buildCost: 560, rentByLevel: { empty: 70, house1: 350, house2: 700, house3: 1050, hotel: 1400 } },
  prop_04: { id: 'prop_04', name: '朝阳街', colorGroup: 'history', price: 1600, baseRent: 80, buildCost: 640, rentByLevel: { empty: 80, house1: 400, house2: 800, house3: 1200, hotel: 1600 } },
  prop_06: { id: 'prop_06', name: '烟台山', colorGroup: 'history', price: 2000, baseRent: 100, buildCost: 800, rentByLevel: { empty: 100, house1: 500, house2: 1000, house3: 1500, hotel: 2000 } },
  prop_08: { id: 'prop_08', name: '张裕酒文化博物馆', colorGroup: 'history', price: 2200, baseRent: 110, buildCost: 880, rentByLevel: { empty: 110, house1: 550, house2: 1100, house3: 1650, hotel: 2200 } },
  prop_09: { id: 'prop_09', name: '月亮湾', colorGroup: 'coast', price: 1400, baseRent: 70, buildCost: 560, rentByLevel: { empty: 70, house1: 350, house2: 700, house3: 1050, hotel: 1400 }, aquaculture: { enabled: true, specialty: '鲍鱼', levels: aquaLevels } },
  prop_11: { id: 'prop_11', name: '东炮台', colorGroup: 'coast', price: 1600, baseRent: 80, buildCost: 640, rentByLevel: { empty: 80, house1: 400, house2: 800, house3: 1200, hotel: 1600 } },
  prop_12: { id: 'prop_12', name: '渔人码头', colorGroup: 'coast', price: 1800, baseRent: 90, buildCost: 720, rentByLevel: { empty: 90, house1: 450, house2: 900, house3: 1350, hotel: 1800 } },
  prop_14: { id: 'prop_14', name: '黄海明珠', colorGroup: 'coast', price: 2000, baseRent: 100, buildCost: 800, rentByLevel: { empty: 100, house1: 500, house2: 1000, house3: 1500, hotel: 2000 } },
  prop_16: { id: 'prop_16', name: '马山寨高尔夫', colorGroup: 'mountain', price: 1600, baseRent: 80, buildCost: 640, rentByLevel: { empty: 80, house1: 400, house2: 800, house3: 1200, hotel: 1600 } },
  prop_17: { id: 'prop_17', name: '养马岛', colorGroup: 'mountain', price: 2600, baseRent: 130, buildCost: 1040, rentByLevel: { empty: 130, house1: 650, house2: 1300, house3: 1950, hotel: 2600 }, aquaculture: { enabled: true, specialty: '扇贝', levels: aquaLevels } },
  prop_19: { id: 'prop_19', name: '昆嵛山', colorGroup: 'mountain', price: 1800, baseRent: 90, buildCost: 720, rentByLevel: { empty: 90, house1: 450, house2: 900, house3: 1350, hotel: 1800 } },
  prop_21: { id: 'prop_21', name: '龙泉温泉', colorGroup: 'hotspring', price: 1400, baseRent: 70, buildCost: 560, rentByLevel: { empty: 70, house1: 350, house2: 700, house3: 1050, hotel: 1400 } },
  prop_22: { id: 'prop_22', name: '龙湖北中国海', colorGroup: 'hotspring', price: 1600, baseRent: 80, buildCost: 640, rentByLevel: { empty: 80, house1: 400, house2: 800, house3: 1200, hotel: 1600 } },
  prop_24: { id: 'prop_24', name: '蓬莱阁', colorGroup: 'mountain', price: 3000, baseRent: 150, buildCost: 1200, rentByLevel: { empty: 150, house1: 750, house2: 1500, house3: 2250, hotel: 3000 } },
  prop_26: { id: 'prop_26', name: '三仙山', colorGroup: 'mountain', price: 2200, baseRent: 110, buildCost: 880, rentByLevel: { empty: 110, house1: 550, house2: 1100, house3: 1650, hotel: 2200 } },
  prop_27: { id: 'prop_27', name: '长岛', colorGroup: 'coast', price: 2800, baseRent: 140, buildCost: 1120, rentByLevel: { empty: 140, house1: 700, house2: 1400, house3: 2100, hotel: 2800 }, aquaculture: { enabled: true, specialty: '海参', levels: aquaLevels } },
  prop_29: { id: 'prop_29', name: '万鸟岛', colorGroup: 'coast', price: 1400, baseRent: 70, buildCost: 560, rentByLevel: { empty: 70, house1: 350, house2: 700, house3: 1050, hotel: 1400 }, aquaculture: { enabled: true, specialty: '海带', levels: aquaLevels } },
  prop_30: { id: 'prop_30', name: '金沙滩', colorGroup: 'coast', price: 2000, baseRent: 100, buildCost: 800, rentByLevel: { empty: 100, house1: 500, house2: 1000, house3: 1500, hotel: 2000 } },
  prop_32: { id: 'prop_32', name: '磁山温泉', colorGroup: 'hotspring', price: 1600, baseRent: 80, buildCost: 640, rentByLevel: { empty: 80, house1: 400, house2: 800, house3: 1200, hotel: 1600 } },
  prop_33: { id: 'prop_33', name: '天马栈桥', colorGroup: 'hotspring', price: 1200, baseRent: 60, buildCost: 480, rentByLevel: { empty: 60, house1: 300, house2: 600, house3: 900, hotel: 1200 } }
};

export const colorGroups = {
  history: { id: 'history', name: '历史街区', color: '#E74C3C', icon: '🔴', propertyIds: ['prop_03', 'prop_04', 'prop_06', 'prop_08'], bonusRule: { type: 'all', requiredCount: 4, rentMultiplier: 2.0 } },
  coast: { id: 'coast', name: '海岸线', color: '#3498DB', icon: '🔵', propertyIds: ['prop_01', 'prop_09', 'prop_11', 'prop_12', 'prop_14', 'prop_27', 'prop_29', 'prop_30'], bonusRule: { type: 'count', requiredCount: 4, rentMultiplier: 1.5 } },
  mountain: { id: 'mountain', name: '仙山', color: '#27AE60', icon: '🟢', propertyIds: ['prop_16', 'prop_17', 'prop_19', 'prop_24', 'prop_26'], bonusRule: { type: 'all', requiredCount: 5, rentMultiplier: 2.0 } },
  hotspring: { id: 'hotspring', name: '温泉', color: '#F39C12', icon: '🟠', propertyIds: ['prop_21', 'prop_22', 'prop_32', 'prop_33'], bonusRule: { type: 'all', requiredCount: 4, rentMultiplier: 2.0 } }
};

// 机会卡 — 与前端 cards-chance.json 一致（22 张，含 6 张生态卡）
export const chanceCards = [
  { id: 'C01', type: 'chance', text: '在朝阳街偶遇非遗剪纸展，游客打赏', effect: { action: 'cash', amount: 1000 }, icon: '🎉' },
  { id: 'C02', type: 'chance', text: '张裕酒文化博物馆品鉴会分红', effect: { action: 'cash', amount: 800 }, icon: '🍷' },
  { id: 'C03', type: 'chance', text: '养马岛海水浴场旺季营收', effect: { action: 'cash', amount: 1200 }, icon: '🏖️' },
  { id: 'C04', type: 'chance', text: '长岛捡到稀有球石，收藏家收购', effect: { action: 'cash', amount: 1500 }, icon: '💎' },
  { id: 'C05', type: 'chance', text: '蓬莱阁古建筑修复，获政府奖励', effect: { action: 'cash', amount: 2000 }, icon: '🏛️' },
  { id: 'C06', type: 'chance', text: '所城里汉服文化节，摊位收入', effect: { action: 'cash', amount: 600 }, icon: '👘' },
  { id: 'C07', type: 'chance', text: '烟台山灯塔开放夜景观光，门票大卖', effect: { action: 'cash', amount: 1300 }, icon: '🌃' },
  { id: 'C08', type: 'chance', text: '金沙滩沙雕比赛获奖金', effect: { action: 'cash', amount: 700 }, icon: '🏖️' },
  { id: 'C09', type: 'chance', text: '渔人码头海鲜美食节，生意火爆', effect: { action: 'cash', amount: 1100 }, icon: '🦐' },
  { id: 'C10', type: 'chance', text: '昆嵛山发现野生灵芝，卖出高价', effect: { action: 'cash', amount: 1800 }, icon: '🍄' },
  { id: 'C11', type: 'chance', text: '磁山温泉获评最佳康养地，奖金', effect: { action: 'cash', amount: 900 }, icon: '♨️' },
  { id: 'C12', type: 'chance', text: '朝阳街商铺租金上涨，额外收入', effect: { action: 'cash', amount: 500 }, icon: '💰' },
  { id: 'C13', type: 'chance', text: '帮助迷路游客找到酒店，获感谢费', effect: { action: 'cash', amount: 300 }, icon: '🤝' },
  { id: 'C14', type: 'chance', text: '烟台晚报报道你的旅行故事，获稿费', effect: { action: 'cash', amount: 400 }, icon: '📰' },
  { id: 'C15', type: 'chance', text: '八仙过海节担任嘉宾，获出场费', effect: { action: 'cash', amount: 1600 }, icon: '🎭' },
  { id: 'C16', type: 'chance', text: '抽中仙境幸运星，银行额外奖励', effect: { action: 'cash', amount: 2500 }, icon: '⭐' },
  { id: 'C_E1', type: 'chance', category: 'ecology', text: '参与海岸清洁志愿行动，获环保奖励', effect: { action: 'cash', amount: 500 }, ecology: { delta: 5 }, icon: '🌱' },
  { id: 'C_E2', type: 'chance', category: 'ecology', text: '鲸鱼群回归烟台海域，观光收入大增', effect: { action: 'cash', amount: 1200 }, ecology: { delta: 5 }, icon: '🐋' },
  { id: 'C_E3', type: 'chance', category: 'ecology', text: '海草床修复成功，渔业丰收', effect: { action: 'cash', amount: 800 }, ecology: { delta: 5 }, icon: '🌿' },
  { id: 'C_E4', type: 'chance', category: 'ecology', text: '投放人工鱼礁，海洋生物回归', effect: { action: 'cash', amount: 600 }, ecology: { delta: 5 }, icon: '🐠' },
  { id: 'C_E5', type: 'chance', category: 'ecology', text: '海洋保护区扩区，获得政府补贴', effect: { action: 'cash', amount: 1000 }, ecology: { delta: 5 }, icon: '🛡️' },
  { id: 'C_E6', type: 'chance', category: 'ecology', text: '检测到稀有海豚种群，科研奖励', effect: { action: 'cash', amount: 1500 }, ecology: { delta: 5 }, icon: '🐬' }
];

// 命运卡 — 与前端 cards-destiny.json 一致（22 张，含 6 张生态卡）
export const destinyCards = [
  { id: 'D01', type: 'destiny', text: '烟台山大雾关闭，观光收入损失', effect: { action: 'cash', amount: -800 }, icon: '🌫️' },
  { id: 'D02', type: 'destiny', text: '蓬莱阁海市蜃楼迷路，支付救援费', effect: { action: 'cash', amount: -1000 }, icon: '🏜️' },
  { id: 'D03', type: 'destiny', text: '所城里老房修缮，分摊费用', effect: { action: 'cash', amount: -600 }, icon: '🏚️' },
  { id: 'D04', type: 'destiny', text: '台风过境，金沙滩设施受损', effect: { action: 'cash', amount: -1200 }, icon: '🌪️' },
  { id: 'D05', type: 'destiny', text: '长岛轮渡停航，滞留费用', effect: { action: 'cash', amount: -700 }, icon: '⛴️' },
  { id: 'D06', type: 'destiny', text: '养马岛赛马节投注失败', effect: { action: 'cash', amount: -1500 }, icon: '🐎' },
  { id: 'D07', type: 'destiny', text: '朝阳街商铺被盗（已破案，获部分赔偿）', effect: { action: 'cash', amount: -400 }, icon: '🔍' },
  { id: 'D08', type: 'destiny', text: '昆嵛山火灾预警，捐赠消防设备', effect: { action: 'cash', amount: -900 }, icon: '🔥' },
  { id: 'D09', type: 'destiny', text: '张裕酒窖漏水，名酒受损', effect: { action: 'cash', amount: -1100 }, icon: '🍾' },
  { id: 'D10', type: 'destiny', text: '机场航班延误，赔偿旅客', effect: { action: 'cash', amount: -500 }, icon: '✈️' },
  { id: 'D11', type: 'destiny', text: '发现所城里古井，获文物保护奖金', effect: { action: 'cash', amount: 1200 }, icon: '🏺' },
  { id: 'D12', type: 'destiny', text: '养马岛发现新景点，吸引投资', effect: { action: 'cash', amount: 1500 }, icon: '🏝️' },
  { id: 'D13', type: 'destiny', text: '东炮台修复工程，获政府补贴', effect: { action: 'cash', amount: 800 }, icon: '🏛️' },
  { id: 'D14', type: 'destiny', text: '黄海明珠观光塔冠名权拍卖，分红', effect: { action: 'cash', amount: 1000 }, icon: '🗼' },
  { id: 'D15', type: 'destiny', text: '芝罘湾游艇码头扩建，征收补偿', effect: { action: 'cash', amount: 1800 }, icon: '🛥️' },
  { id: 'D16', type: 'destiny', text: '龙湖地产项目合作，投资收益', effect: { action: 'cash', amount: 2200 }, icon: '📈' },
  { id: 'D_E1', type: 'destiny', category: 'ecology', text: '赤潮爆发，养殖场受损（持有海洋监测船可免疫）', effect: { action: 'cash', amount: -1500 }, ecology: { delta: -5 }, extraEffect: { type: 'aquacultureDebuff', turns: 3, factor: 0.5 }, icon: '🟥' },
  { id: 'D_E2', type: 'destiny', category: 'ecology', text: '海洋塑料污染，清理费用', effect: { action: 'cash', amount: -600 }, ecology: { delta: -5 }, icon: '🥤' },
  { id: 'D_E3', type: 'destiny', category: 'ecology', text: '台风破坏海岸设施（持有海洋监测船可免疫）', effect: { action: 'cash', amount: -1000 }, ecology: { delta: -5 }, extraEffect: { type: 'aquacultureDowngrade', count: 1 }, icon: '🌀' },
  { id: 'D_E4', type: 'destiny', category: 'ecology', text: '海阳核电站轻微泄漏事故，核电投资者付救援费并停发分红3回合', effect: { action: 'cash', amount: 0 }, ecology: { delta: -5 }, extraEffect: { type: 'nuclearAccident', fee: 3000, stopTurns: 3 }, icon: '☢️' },
  { id: 'D_E5', type: 'destiny', category: 'ecology', text: '入海口水质恶化，鱼类死亡', effect: { action: 'cash', amount: -800 }, ecology: { delta: -5 }, icon: '💀' },
  { id: 'D_E6', type: 'destiny', category: 'ecology', text: '外来物种入侵，生态失衡', effect: { action: 'cash', amount: -700 }, ecology: { delta: -8 }, icon: '🦀' }
];

export const foodItems = {
  F01: { id: 'F01', name: '烟台焖子', icon: '🍲' },
  F02: { id: 'F02', name: '蓬莱小面', icon: '🍜' },
  F03: { id: 'F03', name: '海鲜疙瘩汤', icon: '🥣' },
  F04: { id: 'F04', name: '鲅鱼水饺', icon: '🥟' }
};

// 四大海洋板块数据 — 与前端 equipment.json / nuclear-investments.json 一致
export const equipmentData = [
  { id: 'EQ01', name: '海洋钻井平台', icon: '🛢️', price: 2000, sellPrice: 1000, effect: { type: 'rentBoost', target: 'property', colorGroup: 'coast', multiplier: 1.3 }, soldAtCell: 1 },
  { id: 'EQ02', name: '深海机器人', icon: '🤖', price: 2000, sellPrice: 1000, effect: { type: 'rentBoost', target: 'property', colorGroup: 'mountain', multiplier: 1.3 }, soldAtCell: 12 },
  { id: 'EQ03', name: '海洋监测船', icon: '🛳️', price: 2000, sellPrice: 1000, effect: { type: 'immuneCard', cardKeywords: ['台风', '赤潮'] }, soldAtCell: 33 },
  { id: 'EQ04', name: '海上风电塔', icon: '⚡', price: 2000, sellPrice: 1000, effect: { type: 'passiveIncome', amount: 300, perTurn: true }, soldAtCell: 35 }
];

export const investmentProjects = [
  { id: 'NUC1', name: '海阳核电1号机组', icon: '🔬', cost: 5000, dividendPerTurn: 800, maxCopies: 1, accidentStopTurns: 3, accidentFee: 3000, chainEffect: ['NUC2'] },
  { id: 'NUC2', name: '海阳核电2号机组', icon: '🔬', cost: 5000, dividendPerTurn: 800, maxCopies: 1, accidentStopTurns: 3, accidentFee: 0, chainEffect: [] },
  { id: 'WIND1', name: '海上风电场', icon: '🌀', cost: 3000, dividendPerTurn: 400, maxCopies: 2, accidentStopTurns: 0, accidentFee: 0, chainEffect: [], riskEventId: null }
];

const tokens = ['🗼', '🐳', '🍷', '🐦'];
const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'];

export function createPlayer(index, name, isAI = false, aiLevel = 'normal') {
  return {
    id: index,
    name,
    isAI,
    aiLevel,
    token: tokens[index] || '🎲',
    color: colors[index] || '#888',
    cash: gameConfig.player.initialCash,
    position: 0,
    properties: [],
    buildings: {},
    mortgaged: [],
    foodCards: [],
    skipNextTurn: false,
    doublesStreak: 0,
    bankrupt: false,
    freeRentTickets: 0,
    // 四大海洋板块字段
    equipment: [],
    aquaculture: {},
    investments: [],
    reRollTickets: 0
  };
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
