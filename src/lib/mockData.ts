/* ============================================================
 * OTO (Online-To-Offline) Data Model
 * Bright, sun-drenched destination photography with high-luxury
 * resort copy - matching the VisionOS spatial reference build.
 * ============================================================ */

export type OTOCategory =
  | "Beach"
  | "Mountains"
  | "City"
  | "Historical"
  | "Adventure";

export interface OTOExperience {
  id: string;
  title: string;
  subtitle: string;
  category: OTOCategory;
  price: string;
  rating: number;
  location: string;
  hasAR: boolean;
  imageUrl: string;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export type OTOActivityType = "adventure" | "cruise" | "dining" | "trip";

export interface OTOActivity {
  id: string;
  type: OTOActivityType;
  title: string;
  subtitle: string;
  /** ISO-8601 local time, sortable for timeline rendering */
  time: string;
  location: string;
  imageUrl: string;
}

export const CATEGORY_LABELS: Record<OTOCategory, string> = {
  Beach: "海滩",
  Mountains: "山脉",
  City: "城市",
  Historical: "历史",
  Adventure: "探险",
};

export const OTO_CATEGORIES: OTOCategory[] = [
  "Beach",
  "Mountains",
  "City",
  "Historical",
  "Adventure",
];

export const otoExperiences: OTOExperience[] = [
  {
    id: "oto-bali-villa",
    title: "水上别墅",
    subtitle: "印尼 · 巴厘岛",
    category: "Beach",
    price: "¥2,280/晚",
    rating: 4.8,
    location: "Bali",
    hasAR: true,
    imageUrl:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80",
    description:
      "巴厘岛私人水上别墅 —— 无边泳池、珊瑚礁玻璃地板，印度洋上的金色日落甲板。",
    coordinates: { lat: -8.4095, lng: 115.1889 },
  },
  {
    id: "oto-santorini-suite",
    title: "白色洞穴套房",
    subtitle: "希腊 · 圣托里尼",
    category: "Historical",
    price: "¥1,990/晚",
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
    id: "oto-maldives-snorkel",
    title: "珊瑚礁浮潜",
    subtitle: "印度洋 · 马尔代夫",
    category: "Adventure",
    price: "¥1,070/晚",
    rating: 4.8,
    location: "Maldives",
    hasAR: true,
    imageUrl:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=80",
    description:
      "跃入翡翠潟湖 —— 与海龟和彩虹珊瑚礁同游，退潮时在沙洲上随波漂流。",
    coordinates: { lat: 3.2028, lng: 73.2207 },
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

export const otoActivities: OTOActivity[] = [
  {
    id: "act-snorkel",
    type: "adventure",
    title: "珊瑚礁浮潜",
    subtitle: "海龟潟湖 · 全套装备",
    time: "2026-08-05T09:00",
    location: "马尔代夫",
    imageUrl:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=300&q=70",
  },
  {
    id: "act-sunset-cruise",
    type: "cruise",
    title: "潟湖日落巡航",
    subtitle: "香槟与现场弹唱",
    time: "2026-08-05T17:30",
    location: "巴厘岛",
    imageUrl:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=300&q=70",
  },
  {
    id: "act-beach-dinner",
    type: "dining",
    title: "私人海滩晚宴",
    subtitle: "7 道岛屿品鉴菜单",
    time: "2026-08-06T19:00",
    location: "马尔代夫",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=300&q=70",
  },
  {
    id: "act-island-hop",
    type: "trip",
    title: "跳岛一日游",
    subtitle: "沙洲与隐秘海湾",
    time: "2026-08-07T10:00",
    location: "巴厘岛",
    imageUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=70",
  },
];

/** Format ISO time as Chinese: 8月5日上午9:00 */
export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const meridiem = hours < 12 ? "上午" : "下午";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${month}月${day}日${meridiem}${hour12}:${minutes}`;
}
