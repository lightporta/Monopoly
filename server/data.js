// 游戏数据配置（服务端使用，与前端保持一致）

export const gameConfig = {
  version: '1.0.0',
  theme: '仙境海岸·烟台',
  player: { minCount: 2, maxCount: 4, initialCash: 15000 },
  dice: { count: 2, doublesLimit: 3, doublesPenaltyCell: 18 },
  start: { cellIndex: 0, passReward: 2000 },
  economy: {
    buildCostRatio: 0.4, mortgageRatio: 0.5, redeemMultiplier: 1.1, sellBuildingRatio: 0.5, auctionStartRatio: 0.5, auctionMinStep: 100
  },
  rentMultipliers: { empty: 1.0, house1: 1.5, house2: 2.0, house3: 2.5, hotel: 3.5 },
  victory: { ironTriangle: ['烟台山', '蓬莱阁', '养马岛'] }
};

export const board = [
  { index: 0, name: '起点', type: 'start', icon: '🚩' },
  { index: 1, name: '芝罘湾广场', type: 'property', icon: '🏛️', colorGroup: 'history', propertyRef: 'zhifuwan' },
  { index: 2, name: '烟台山', type: 'property', icon: '🗼', colorGroup: 'history', propertyRef: 'yantaishan' },
  { index: 3, name: '机会卡', type: 'chance', icon: '🎴' },
  { index: 4, name: '朝阳街', type: 'property', icon: '🏘️', colorGroup: 'history', propertyRef: 'chaoyang' },
  { index: 5, name: '所城里', type: 'property', icon: '🏯', colorGroup: 'history', propertyRef: 'suochengli' },
  { index: 6, name: '烟台山灯塔', type: 'teleport', icon: '🗼', teleport: { mode: 'fixed', target: 12, passStart: false } },
  { index: 7, name: '养马岛跨海大桥', type: 'move', icon: '🌉', effect: 'skipNextTurn' },
  { index: 8, name: '第一海水浴场', type: 'property', icon: '🏖️', colorGroup: 'coast', propertyRef: 'haishuiyichang' },
  { index: 9, name: '第二海水浴场', type: 'property', icon: '🏖️', colorGroup: 'coast', propertyRef: 'haishuiyichang2' },
  { index: 10, name: '命运卡', type: 'destiny', icon: '🔮' },
  { index: 11, name: '金沙滩', type: 'property', icon: '🏝️', colorGroup: 'coast', propertyRef: 'jinshatan' },
  { index: 12, name: '蓬莱阁', type: 'property', icon: '🏯', colorGroup: 'mountain', propertyRef: 'penglaige' },
  { index: 13, name: '八仙渡海口', type: 'teleport', icon: '🌊', teleport: { mode: 'anyEmpty', passStart: false } },
  { index: 14, name: '三仙山', type: 'property', icon: '⛰️', colorGroup: 'mountain', propertyRef: 'sanxianshan' },
  { index: 15, name: '机会卡', type: 'chance', icon: '🎴' },
  { index: 16, name: '艾山', type: 'property', icon: '🏔️', colorGroup: 'mountain', propertyRef: 'aishan' },
  { index: 17, name: '牙山', type: 'property', icon: '⛰️', colorGroup: 'mountain', propertyRef: 'yashan' },
  { index: 18, name: '休息区', type: 'rest', icon: '☕' },
  { index: 19, name: '磁山温泉', type: 'property', icon: '♨️', colorGroup: 'hotspring', propertyRef: 'cishan' },
  { index: 20, name: '艾山温泉', type: 'property', icon: '♨️', colorGroup: 'hotspring', propertyRef: 'aishanwenquan' },
  { index: 21, name: '命运卡', type: 'destiny', icon: '🔮' },
  { index: 22, name: '龙泉温泉', type: 'property', icon: '♨️', colorGroup: 'hotspring', propertyRef: 'longquan' },
  { index: 23, name: '蓬莱温泉', type: 'property', icon: '♨️', colorGroup: 'hotspring', propertyRef: 'penglaiwenquan' },
  { index: 24, name: '海昌鲸鲨馆', type: 'move', icon: '🐳', effect: 'reroll' },
  { index: 25, name: '养马岛', type: 'property', icon: '🐎', colorGroup: 'mountain', propertyRef: 'yangmadao' },
  { index: 26, name: '机会卡', type: 'chance', icon: '🎴' },
  { index: 27, name: '长岛', type: 'property', icon: '🏝️', colorGroup: 'coast', propertyRef: 'changdao' },
  { index: 28, name: '崆峒岛', type: 'property', icon: '🏝️', colorGroup: 'coast', propertyRef: 'kongtongdao' },
  { index: 29, name: '机场', type: 'teleport', icon: '✈️', teleport: { mode: 'anyCell', passStart: false } },
  { index: 30, name: '渔人码头', type: 'property', icon: '⚓', colorGroup: 'coast', propertyRef: 'yurenmatou' },
  { index: 31, name: '东炮台', type: 'property', icon: '💣', colorGroup: 'coast', propertyRef: 'dongpaotai' },
  { index: 32, name: '命运卡', type: 'destiny', icon: '🔮' },
  { index: 33, name: '天马栈桥', type: 'property', icon: '🌉', colorGroup: 'coast', propertyRef: 'tianmazhanqiao' },
  { index: 34, name: '幸福门', type: 'property', icon: '🚪', colorGroup: 'coast', propertyRef: 'xingfumen' },
  { index: 35, name: '烟台大悦城', type: 'property', icon: '🏬', colorGroup: 'coast', propertyRef: 'dayuecheng' }
];

export const properties = {
  zhifuwan: { id: 'zhifuwan', name: '芝罘湾广场', colorGroup: 'history', price: 600, baseRent: 30, buildCost: 240, rentByLevel: { empty: 30, house1: 90, house2: 270, house3: 540, hotel: 810 } },
  yantaishan: { id: 'yantaishan', name: '烟台山', colorGroup: 'history', price: 800, baseRent: 40, buildCost: 320, rentByLevel: { empty: 40, house1: 120, house2: 360, house3: 720, hotel: 1080 } },
  chaoyang: { id: 'chaoyang', name: '朝阳街', colorGroup: 'history', price: 1000, baseRent: 50, buildCost: 400, rentByLevel: { empty: 50, house1: 150, house2: 450, house3: 900, hotel: 1350 } },
  suochengli: { id: 'suochengli', name: '所城里', colorGroup: 'history', price: 1200, baseRent: 60, buildCost: 480, rentByLevel: { empty: 60, house1: 180, house2: 540, house3: 1080, hotel: 1620 } },
  haishuiyichang: { id: 'haishuiyichang', name: '第一海水浴场', colorGroup: 'coast', price: 1400, baseRent: 70, buildCost: 560, rentByLevel: { empty: 70, house1: 210, house2: 630, house3: 1260, hotel: 1890 } },
  haishuiyichang2: { id: 'haishuiyichang2', name: '第二海水浴场', colorGroup: 'coast', price: 1600, baseRent: 80, buildCost: 640, rentByLevel: { empty: 80, house1: 240, house2: 720, house3: 1440, hotel: 2160 } },
  jinshatan: { id: 'jinshatan', name: '金沙滩', colorGroup: 'coast', price: 1800, baseRent: 90, buildCost: 720, rentByLevel: { empty: 90, house1: 270, house2: 810, house3: 1620, hotel: 2430 } },
  changdao: { id: 'changdao', name: '长岛', colorGroup: 'coast', price: 2000, baseRent: 100, buildCost: 800, rentByLevel: { empty: 100, house1: 300, house2: 900, house3: 1800, hotel: 2700 } },
  kongtongdao: { id: 'kongtongdao', name: '崆峒岛', colorGroup: 'coast', price: 2200, baseRent: 110, buildCost: 880, rentByLevel: { empty: 110, house1: 330, house2: 990, house3: 1980, hotel: 2970 } },
  yurenmatou: { id: 'yurenmatou', name: '渔人码头', colorGroup: 'coast', price: 2400, baseRent: 120, buildCost: 960, rentByLevel: { empty: 120, house1: 360, house2: 1080, house3: 2160, hotel: 3240 } },
  dongpaotai: { id: 'dongpaotai', name: '东炮台', colorGroup: 'coast', price: 2600, baseRent: 130, buildCost: 1040, rentByLevel: { empty: 130, house1: 390, house2: 1170, house3: 2340, hotel: 3510 } },
  tianmazhanqiao: { id: 'tianmazhanqiao', name: '天马栈桥', colorGroup: 'coast', price: 2800, baseRent: 140, buildCost: 1120, rentByLevel: { empty: 140, house1: 420, house2: 1260, house3: 2520, hotel: 3780 } },
  xingfumen: { id: 'xingfumen', name: '幸福门', colorGroup: 'coast', price: 3000, baseRent: 150, buildCost: 1200, rentByLevel: { empty: 150, house1: 450, house2: 1350, house3: 2700, hotel: 4050 } },
  dayuecheng: { id: 'dayuecheng', name: '烟台大悦城', colorGroup: 'coast', price: 3200, baseRent: 160, buildCost: 1280, rentByLevel: { empty: 160, house1: 480, house2: 1440, house3: 2880, hotel: 4320 } },
  penglaige: { id: 'penglaige', name: '蓬莱阁', colorGroup: 'mountain', price: 3500, baseRent: 175, buildCost: 1400, rentByLevel: { empty: 175, house1: 525, house2: 1575, house3: 3150, hotel: 4725 } },
  sanxianshan: { id: 'sanxianshan', name: '三仙山', colorGroup: 'mountain', price: 2800, baseRent: 140, buildCost: 1120, rentByLevel: { empty: 140, house1: 420, house2: 1260, house3: 2520, hotel: 3780 } },
  aishan: { id: 'aishan', name: '艾山', colorGroup: 'mountain', price: 2600, baseRent: 130, buildCost: 1040, rentByLevel: { empty: 130, house1: 390, house2: 1170, house3: 2340, hotel: 3510 } },
  yashan: { id: 'yashan', name: '牙山', colorGroup: 'mountain', price: 2400, baseRent: 120, buildCost: 960, rentByLevel: { empty: 120, house1: 360, house2: 1080, house3: 2160, hotel: 3240 } },
  yangmadao: { id: 'yangmadao', name: '养马岛', colorGroup: 'mountain', price: 4000, baseRent: 200, buildCost: 1600, rentByLevel: { empty: 200, house1: 600, house2: 1800, house3: 3600, hotel: 5400 } },
  cishan: { id: 'cishan', name: '磁山温泉', colorGroup: 'hotspring', price: 2000, baseRent: 100, buildCost: 800, rentByLevel: { empty: 100, house1: 300, house2: 900, house3: 1800, hotel: 2700 } },
  aishanwenquan: { id: 'aishanwenquan', name: '艾山温泉', colorGroup: 'hotspring', price: 2200, baseRent: 110, buildCost: 880, rentByLevel: { empty: 110, house1: 330, house2: 990, house3: 1980, hotel: 2970 } },
  longquan: { id: 'longquan', name: '龙泉温泉', colorGroup: 'hotspring', price: 2400, baseRent: 120, buildCost: 960, rentByLevel: { empty: 120, house1: 360, house2: 1080, house3: 2160, hotel: 3240 } },
  penglaiwenquan: { id: 'penglaiwenquan', name: '蓬莱温泉', colorGroup: 'hotspring', price: 2600, baseRent: 130, buildCost: 1040, rentByLevel: { empty: 130, house1: 390, house2: 1170, house3: 2340, hotel: 3510 } }
};

export const colorGroups = {
  history: { id: 'history', name: '历史街区', color: '#D32F2F', icon: '🏯', propertyIds: ['zhifuwan', 'yantaishan', 'chaoyang', 'suochengli'], bonusRule: { type: 'all', requiredCount: 4, rentMultiplier: 2.0 } },
  coast: { id: 'coast', name: '海岸线', color: '#1976D2', icon: '🌊', propertyIds: ['haishuiyichang', 'haishuiyichang2', 'jinshatan', 'changdao', 'kongtongdao', 'yurenmatou', 'dongpaotai', 'tianmazhanqiao', 'xingfumen', 'dayuecheng'], bonusRule: { type: 'count', requiredCount: 4, rentMultiplier: 1.5 } },
  mountain: { id: 'mountain', name: '仙山', color: '#388E3C', icon: '⛰️', propertyIds: ['penglaige', 'sanxianshan', 'aishan', 'yashan', 'yangmadao'], bonusRule: { type: 'all', requiredCount: 5, rentMultiplier: 2.0 } },
  hotspring: { id: 'hotspring', name: '温泉', color: '#F57C00', icon: '♨️', propertyIds: ['cishan', 'aishanwenquan', 'longquan', 'penglaiwenquan'], bonusRule: { type: 'all', requiredCount: 4, rentMultiplier: 2.0 } }
};

export const chanceCards = [
  { id: 'c1', type: 'chance', text: '恭喜！获得烟台市政府旅游补贴 ¥500', icon: '💰', effect: { action: 'cash', amount: 500 } },
  { id: 'c2', type: 'chance', text: '中奖！获得 ¥1000', icon: '🎰', effect: { action: 'cash', amount: 1000 } },
  { id: 'c3', type: 'chance', text: '银行发薪日，获得 ¥300', icon: '💵', effect: { action: 'cash', amount: 300 } },
  { id: 'c4', type: 'chance', text: '前往起点', icon: '🚩', effect: { action: 'move', target: 0 } },
  { id: 'c5', type: 'chance', text: '前进3格', icon: '👣', effect: { action: 'moveRel', steps: 3 } },
  { id: 'c6', type: 'chance', text: '获得美食卡：烟台焖子', icon: '🥘', effect: { action: 'collectFood', foodId: 'ment' } },
  { id: 'c7', type: 'chance', text: '获得 ¥800', icon: '💸', effect: { action: 'cash', amount: 800 } },
  { id: 'c8', type: 'chance', text: '后退2格', icon: '⏪', effect: { action: 'moveRel', steps: -2 } }
];

export const destinyCards = [
  { id: 'd1', type: 'destiny', text: '交罚款 ¥500', icon: '💔', effect: { action: 'cash', amount: -500 } },
  { id: 'd2', type: 'destiny', text: '付维修费 ¥800', icon: '🔧', effect: { action: 'cash', amount: -800 } },
  { id: 'd3', type: 'destiny', text: '交税 ¥300', icon: '📝', effect: { action: 'cash', amount: -300 } },
  { id: 'd4', type: 'destiny', text: '前往休息区', icon: '☕', effect: { action: 'move', target: 18 } },
  { id: 'd5', type: 'destiny', text: '后退3格', icon: '⏪', effect: { action: 'moveRel', steps: -3 } },
  { id: 'd6', type: 'destiny', text: '支付 ¥200', icon: '💸', effect: { action: 'cash', amount: -200 } },
  { id: 'd7', type: 'destiny', text: '丢失 ¥400', icon: '😢', effect: { action: 'cash', amount: -400 } },
  { id: 'd8', type: 'destiny', text: '获得美食卡：鲅鱼水饺', icon: '🥟', effect: { action: 'collectFood', foodId: 'jiaozi' } }
];

export const foodItems = {
  menzishuang: { id: 'mendi', name: '烟台焖子', icon: '🥘' },
  xiaomian: { id: 'xiaomian', name: '蓬莱小面', icon: '🍜' },
  gedatang: { id: 'gedatang', name: '海鲜疙瘩汤', icon: '🍲' },
  jiaozi: { id: 'jiaozi', name: '鲅鱼水饺', icon: '🥟' }
};

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
    freeRentTickets: 0
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
