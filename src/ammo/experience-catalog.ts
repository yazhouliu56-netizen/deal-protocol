import type { OTOExperience } from "@/types/oto-experience";

/**
 * OTO 体验内容目录（宪法 #4 表驱动：数据实体，契约在 src/types/oto-experience.ts）。
 * AR/spatial 参考演示的本地生活体验预览。
 */
export const otoExperiences: OTOExperience[] = [
  {
    id: "oto-santorini-suite",
    title: "白色洞穴套房",
    subtitle: "希腊 · 圣托里尼",
    category: "Historical",
    price: "¥1,290/晚",
    rating: 4.9,
    location: "Santorini",
    hasAR: true,
    imageUrl:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=900&q=80",
    description:
      "悬崖上的洞穴套房 —— 爱琴海日落、无边泳池，距蓝顶教堂仅数步之遥。",
    coordinates: { lat: 36.3932, lng: 25.4615 },
  },
  {
    id: "oto-paris-loft",
    title: "埃菲尔观景阁楼",
    subtitle: "法国 · 巴黎",
    category: "City",
    price: "¥2,910/晚",
    rating: 4.7,
    location: "Paris",
    hasAR: true,
    imageUrl:
      "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=900&q=80",
    description:
      "正对埃菲尔铁塔的奥斯曼式阁楼 —— 香槟日落、塞纳河与蒙马特天际线尽收眼底。",
    coordinates: { lat: 48.8566, lng: 2.3522 },
  },
  {
    id: "oto-dubai-marina",
    title: "棕榈岛码头公寓",
    subtitle: "阿联酋 · 迪拜",
    category: "City",
    price: "¥3,690/晚",
    rating: 4.6,
    location: "Dubai",
    hasAR: true,
    imageUrl:
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=80",
    description:
      "棕榈岛高层码头套房 —— 私人海滩俱乐部、沙漠冲沙，黄昏俯瞰全球最高天际线。",
    coordinates: { lat: 25.2048, lng: 55.2708 },
  },
  {
    id: "oto-alps-cabin",
    title: "阿尔卑斯玻璃木屋",
    subtitle: "瑞士 · 采尔马特",
    category: "Mountains",
    price: "¥1,850/晚",
    rating: 4.9,
    location: "Zermatt",
    hasAR: false,
    imageUrl:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80",
    description:
      "正对马特洪峰的落地玻璃木屋 —— 星空按摩浴缸、晨间雪票与壁炉奶酪锅。",
    coordinates: { lat: 46.0207, lng: 7.7491 },
  },
  {
    id: "oto-kyoto-ryokan",
    title: "禅意庭园旅馆",
    subtitle: "日本 · 京都",
    category: "Historical",
    price: "¥2,700/晚",
    rating: 4.8,
    location: "Kyoto",
    hasAR: false,
    imageUrl:
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=80",
    description:
      "百年町屋旅馆与私人苔庭 —— 怀石料理、桧木浴与黎明前的茶道。",
    coordinates: { lat: 35.0116, lng: 135.7681 },
  },
  {
    id: "oto-ibiza-cliff",
    title: "悬崖秘境别墅",
    subtitle: "西班牙 · 伊维萨",
    category: "Beach",
    price: "¥2,410/晚",
    rating: 4.7,
    location: "Ibiza",
    hasAR: false,
    imageUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    description:
      "俯瞰科马角的白色悬崖别墅 —— 金色黄昏鸡尾酒、隐秘海湾，私人小湾仅船可达。",
    coordinates: { lat: 38.9067, lng: 1.4206 },
  },
];
