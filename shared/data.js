// One bilingual data source for offline and authoritative online play.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const BOARD = freeze([
  {
    index: 0,
    type: 'start',
    name: {
      zh: '仙境海岸',
      en: 'Fairy Coast',
    },
  },
  {
    index: 1,
    type: 'property',
    name: {
      zh: '芝罘湾广场',
      en: 'Zhifu Bay Plaza',
    },
    propertyId: 'prop_01',
  },
  {
    index: 2,
    type: 'chance',
    name: {
      zh: '机会',
      en: 'Chance',
    },
  },
  {
    index: 3,
    type: 'property',
    name: {
      zh: '所城里',
      en: 'Suochengli',
    },
    propertyId: 'prop_03',
  },
  {
    index: 4,
    type: 'property',
    name: {
      zh: '朝阳街',
      en: 'Chaoyang Street',
    },
    propertyId: 'prop_04',
  },
  {
    index: 5,
    type: 'teleport',
    name: {
      zh: '烟台山灯塔',
      en: 'Yantai Lighthouse',
    },
    target: 24,
  },
  {
    index: 6,
    type: 'property',
    name: {
      zh: '烟台山',
      en: 'Yantai Hill',
    },
    propertyId: 'prop_06',
  },
  {
    index: 7,
    type: 'destiny',
    name: {
      zh: '命运',
      en: 'Destiny',
    },
  },
  {
    index: 8,
    type: 'property',
    name: {
      zh: '张裕酒文化博物馆',
      en: 'Changyu Wine Museum',
    },
    propertyId: 'prop_08',
  },
  {
    index: 9,
    type: 'property',
    name: {
      zh: '月亮湾',
      en: 'Moon Bay',
    },
    propertyId: 'prop_09',
  },
  {
    index: 10,
    type: 'chance',
    name: {
      zh: '机会',
      en: 'Chance',
    },
  },
  {
    index: 11,
    type: 'property',
    name: {
      zh: '东炮台',
      en: 'East Fort',
    },
    propertyId: 'prop_11',
  },
  {
    index: 12,
    type: 'property',
    name: {
      zh: '渔人码头',
      en: 'Fisherman’s Wharf',
    },
    propertyId: 'prop_12',
  },
  {
    index: 13,
    type: 'bonus',
    name: {
      zh: '海昌鲸鲨馆',
      en: 'Whale Shark Aquarium',
    },
  },
  {
    index: 14,
    type: 'property',
    name: {
      zh: '黄海明珠',
      en: 'Yellow Sea Pearl',
    },
    propertyId: 'prop_14',
  },
  {
    index: 15,
    type: 'destiny',
    name: {
      zh: '命运',
      en: 'Destiny',
    },
  },
  {
    index: 16,
    type: 'property',
    name: {
      zh: '马山寨高尔夫',
      en: 'Mashanzhai Golf',
    },
    propertyId: 'prop_16',
  },
  {
    index: 17,
    type: 'property',
    name: {
      zh: '养马岛',
      en: 'Yangma Island',
    },
    propertyId: 'prop_17',
  },
  {
    index: 18,
    type: 'rest',
    name: {
      zh: '养马岛跨海大桥',
      en: 'Cross-sea Bridge',
    },
  },
  {
    index: 19,
    type: 'property',
    name: {
      zh: '昆嵛山',
      en: 'Kunyu Mountain',
    },
    propertyId: 'prop_19',
  },
  {
    index: 20,
    type: 'destiny',
    name: {
      zh: '命运',
      en: 'Destiny',
    },
  },
  {
    index: 21,
    type: 'property',
    name: {
      zh: '龙泉温泉',
      en: 'Longquan Hot Spring',
    },
    propertyId: 'prop_21',
  },
  {
    index: 22,
    type: 'property',
    name: {
      zh: '龙湖北中国海',
      en: 'Longfor North China Sea',
    },
    propertyId: 'prop_22',
  },
  {
    index: 23,
    type: 'chance',
    name: {
      zh: '机会',
      en: 'Chance',
    },
  },
  {
    index: 24,
    type: 'property',
    name: {
      zh: '蓬莱阁',
      en: 'Penglai Pavilion',
    },
    propertyId: 'prop_24',
  },
  {
    index: 25,
    type: 'teleport',
    name: {
      zh: '八仙渡海口',
      en: 'Eight Immortals Ferry',
    },
    target: 27,
  },
  {
    index: 26,
    type: 'property',
    name: {
      zh: '三仙山',
      en: 'Three Immortals Mountain',
    },
    propertyId: 'prop_26',
  },
  {
    index: 27,
    type: 'property',
    name: {
      zh: '长岛',
      en: 'Changdao Island',
    },
    propertyId: 'prop_27',
  },
  {
    index: 28,
    type: 'destiny',
    name: {
      zh: '命运',
      en: 'Destiny',
    },
  },
  {
    index: 29,
    type: 'property',
    name: {
      zh: '万鸟岛',
      en: 'Wanniao Island',
    },
    propertyId: 'prop_29',
  },
  {
    index: 30,
    type: 'property',
    name: {
      zh: '金沙滩',
      en: 'Golden Beach',
    },
    propertyId: 'prop_30',
  },
  {
    index: 31,
    type: 'chance',
    name: {
      zh: '机会',
      en: 'Chance',
    },
  },
  {
    index: 32,
    type: 'property',
    name: {
      zh: '磁山温泉',
      en: 'Cishan Hot Spring',
    },
    propertyId: 'prop_32',
  },
  {
    index: 33,
    type: 'property',
    name: {
      zh: '天马栈桥',
      en: 'Tianma Pier',
    },
    propertyId: 'prop_33',
  },
  {
    index: 34,
    type: 'destiny',
    name: {
      zh: '命运',
      en: 'Destiny',
    },
  },
  {
    index: 35,
    type: 'teleport',
    name: {
      zh: '烟台蓬莱国际机场',
      en: 'Yantai Penglai Airport',
    },
    target: 0,
  },
]);
export const PROPERTIES = freeze([
  {
    id: 'prop_01',
    cellIndex: 1,
    name: {
      zh: '芝罘湾广场',
      en: 'Zhifu Bay Plaza',
    },
    group: 'coast',
    price: 1200,
    baseRent: 60,
    buildCost: 480,
    aquaculture: false,
  },
  {
    id: 'prop_03',
    cellIndex: 3,
    name: {
      zh: '所城里',
      en: 'Suochengli',
    },
    group: 'history',
    price: 1400,
    baseRent: 70,
    buildCost: 560,
    aquaculture: false,
  },
  {
    id: 'prop_04',
    cellIndex: 4,
    name: {
      zh: '朝阳街',
      en: 'Chaoyang Street',
    },
    group: 'history',
    price: 1600,
    baseRent: 80,
    buildCost: 640,
    aquaculture: false,
  },
  {
    id: 'prop_06',
    cellIndex: 6,
    name: {
      zh: '烟台山',
      en: 'Yantai Hill',
    },
    group: 'history',
    price: 2000,
    baseRent: 100,
    buildCost: 800,
    aquaculture: false,
  },
  {
    id: 'prop_08',
    cellIndex: 8,
    name: {
      zh: '张裕酒文化博物馆',
      en: 'Changyu Wine Museum',
    },
    group: 'history',
    price: 2200,
    baseRent: 110,
    buildCost: 880,
    aquaculture: false,
  },
  {
    id: 'prop_09',
    cellIndex: 9,
    name: {
      zh: '月亮湾',
      en: 'Moon Bay',
    },
    group: 'coast',
    price: 1400,
    baseRent: 70,
    buildCost: 560,
    aquaculture: true,
  },
  {
    id: 'prop_11',
    cellIndex: 11,
    name: {
      zh: '东炮台',
      en: 'East Fort',
    },
    group: 'coast',
    price: 1600,
    baseRent: 80,
    buildCost: 640,
    aquaculture: false,
  },
  {
    id: 'prop_12',
    cellIndex: 12,
    name: {
      zh: '渔人码头',
      en: 'Fisherman’s Wharf',
    },
    group: 'coast',
    price: 1800,
    baseRent: 90,
    buildCost: 720,
    aquaculture: false,
  },
  {
    id: 'prop_14',
    cellIndex: 14,
    name: {
      zh: '黄海明珠',
      en: 'Yellow Sea Pearl',
    },
    group: 'coast',
    price: 2000,
    baseRent: 100,
    buildCost: 800,
    aquaculture: false,
  },
  {
    id: 'prop_16',
    cellIndex: 16,
    name: {
      zh: '马山寨高尔夫',
      en: 'Mashanzhai Golf',
    },
    group: 'mountain',
    price: 1600,
    baseRent: 80,
    buildCost: 640,
    aquaculture: false,
  },
  {
    id: 'prop_17',
    cellIndex: 17,
    name: {
      zh: '养马岛',
      en: 'Yangma Island',
    },
    group: 'mountain',
    price: 2600,
    baseRent: 130,
    buildCost: 1040,
    aquaculture: true,
  },
  {
    id: 'prop_19',
    cellIndex: 19,
    name: {
      zh: '昆嵛山',
      en: 'Kunyu Mountain',
    },
    group: 'mountain',
    price: 1800,
    baseRent: 90,
    buildCost: 720,
    aquaculture: false,
  },
  {
    id: 'prop_21',
    cellIndex: 21,
    name: {
      zh: '龙泉温泉',
      en: 'Longquan Hot Spring',
    },
    group: 'hotspring',
    price: 1400,
    baseRent: 70,
    buildCost: 560,
    aquaculture: false,
  },
  {
    id: 'prop_22',
    cellIndex: 22,
    name: {
      zh: '龙湖北中国海',
      en: 'Longfor North China Sea',
    },
    group: 'hotspring',
    price: 1600,
    baseRent: 80,
    buildCost: 640,
    aquaculture: false,
  },
  {
    id: 'prop_24',
    cellIndex: 24,
    name: {
      zh: '蓬莱阁',
      en: 'Penglai Pavilion',
    },
    group: 'mountain',
    price: 3000,
    baseRent: 150,
    buildCost: 1200,
    aquaculture: false,
  },
  {
    id: 'prop_26',
    cellIndex: 26,
    name: {
      zh: '三仙山',
      en: 'Three Immortals Mountain',
    },
    group: 'mountain',
    price: 2200,
    baseRent: 110,
    buildCost: 880,
    aquaculture: false,
  },
  {
    id: 'prop_27',
    cellIndex: 27,
    name: {
      zh: '长岛',
      en: 'Changdao Island',
    },
    group: 'coast',
    price: 2800,
    baseRent: 140,
    buildCost: 1120,
    aquaculture: true,
  },
  {
    id: 'prop_29',
    cellIndex: 29,
    name: {
      zh: '万鸟岛',
      en: 'Wanniao Island',
    },
    group: 'coast',
    price: 1400,
    baseRent: 70,
    buildCost: 560,
    aquaculture: true,
  },
  {
    id: 'prop_30',
    cellIndex: 30,
    name: {
      zh: '金沙滩',
      en: 'Golden Beach',
    },
    group: 'coast',
    price: 2000,
    baseRent: 100,
    buildCost: 800,
    aquaculture: false,
  },
  {
    id: 'prop_32',
    cellIndex: 32,
    name: {
      zh: '磁山温泉',
      en: 'Cishan Hot Spring',
    },
    group: 'hotspring',
    price: 1600,
    baseRent: 80,
    buildCost: 640,
    aquaculture: false,
  },
  {
    id: 'prop_33',
    cellIndex: 33,
    name: {
      zh: '天马栈桥',
      en: 'Tianma Pier',
    },
    group: 'hotspring',
    price: 1200,
    baseRent: 60,
    buildCost: 480,
    aquaculture: false,
  },
]);
export const GROUPS = freeze({
  history: {
    name: {
      zh: '历史街区',
      en: 'Historic Quarter',
    },
    color: '#e76f51',
    required: 4,
  },
  coast: {
    name: {
      zh: '海岸线',
      en: 'Coast',
    },
    color: '#38bdf8',
    required: 4,
  },
  mountain: {
    name: {
      zh: '仙山',
      en: 'Mountains',
    },
    color: '#34d399',
    required: 5,
  },
  hotspring: {
    name: {
      zh: '温泉',
      en: 'Hot Springs',
    },
    color: '#fbbf24',
    required: 4,
  },
});
