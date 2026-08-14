/**
 * 目的地筛选/排序纯函数（G-1 目的地中心）。
 * price 字符串 → 数值（"¥2,280/晚" → 2280），预算档过滤 + 五种排序。
 * 无 IO 无随机，SSR/测试安全。
 */

import type { OTOExperience } from "../../../oto-spatial-web/src/lib/mockData";

/** 成都市中心（「离我最近」排序参照点，产品默认定位成都）。 */
export const ORIGIN = { lat: 30.5728, lng: 104.0668 };

/** "¥2,280/晚" → 2280；"¥1,070/晚" → 1070；解析失败 → Infinity（排在最后）。 */
export function priceOf(price: string): number {
  const m = price.replace(/,/g, "").match(/¥\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

/** 球面距离（km）— 等距近似，对目的地大小足够。 */
export function distanceFrom(
  e: OTOExperience,
  origin: { lat: number; lng: number } = ORIGIN
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(e.coordinates.lat - origin.lat);
  const dLng = toRad(e.coordinates.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) *
      Math.cos(toRad(e.coordinates.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const PRICE_BANDS = [
  { id: "any", label: "全部" },
  { id: "lt1500", label: "¥1.5k 内" },
  { id: "mid", label: "¥1.5k-2.5k" },
  { id: "gt2500", label: "¥2.5k+" },
] as const;

export type PriceBand = (typeof PRICE_BANDS)[number]["id"];

export function inBand(price: number, band: PriceBand): boolean {
  switch (band) {
    case "any":
      return true;
    case "lt1500":
      return price < 1500;
    case "mid":
      return price >= 1500 && price <= 2500;
    case "gt2500":
      return price > 2500;
  }
}

export type DestSort =
  | "recommend"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "near";

/** 过滤（预算档 + 仅 AR）+ 五种排序（recommend = 保持原始顺序）。 */
export function filterDestinations(
  list: OTOExperience[],
  opts: { band: PriceBand; arOnly: boolean; sort: DestSort }
): OTOExperience[] {
  const kept = list.filter(
    (e) =>
      inBand(priceOf(e.price), opts.band) &&
      (!opts.arOnly || e.hasAR)
  );
  switch (opts.sort) {
    case "price-asc":
      return [...kept].sort((a, b) => priceOf(a.price) - priceOf(b.price));
    case "price-desc":
      return [...kept].sort((a, b) => priceOf(b.price) - priceOf(a.price));
    case "rating":
      return [...kept].sort((a, b) => b.rating - a.rating);
    case "near":
      return [...kept].sort(
        (a, b) => distanceFrom(a, ORIGIN) - distanceFrom(b, ORIGIN)
      );
    default:
      return kept;
  }
}