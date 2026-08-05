import type { ResponderCapability } from "@/lib/broadcast";

/**
 * Atmosphere responders (B 方案) — seeded into the shared pool so the radar
 * feels alive and "N 人感兴趣" has a credible base beside the virtual
 * hotness padding. Never participates in claiming (they're background).
 */
export const MOCK_RESPONDERS: ResponderCapability[] = [
  {
    id: "mock-chef-lili",
    nickname: "莉莉",
    categories: ["厨师 · 上门做饭"],
    tags: ["女性", "熟手", "家常菜", "私厨", "上门"],
    distanceKm: 1.2,
    rating: 4.9,
    creditLevel: 4,
    verified: true,
    online: true,
  },
  {
    id: "mock-badminton-ahao",
    nickname: "阿豪",
    categories: ["羽毛球约局"],
    tags: ["业余", "进阶", "双打", "教练"],
    distanceKm: 2.1,
    rating: 4.7,
    creditLevel: 3,
    verified: false,
    online: true,
  },
  {
    id: "mock-photo-xiaobei",
    nickname: "小北",
    categories: ["摄影师约拍"],
    tags: ["日系", "写真", "JK", "灯光", "可穿JK"],
    distanceKm: 0.8,
    rating: 4.8,
    creditLevel: 4,
    verified: true,
    online: true,
  },
  {
    id: "mock-clean-wang",
    nickname: "王姐",
    categories: ["家政保洁"],
    tags: ["深度保洁", "十年经验", "自备工具"],
    distanceKm: 2.0,
    rating: 5.0,
    creditLevel: 5,
    verified: true,
    online: true,
  },
  {
    id: "mock-accompany-gu",
    nickname: "顾医生",
    categories: ["陪诊陪护"],
    tags: ["持证", "耐心", "老人陪护"],
    distanceKm: 3.4,
    rating: 4.6,
    creditLevel: 3,
    verified: true,
    online: true,
  },
];