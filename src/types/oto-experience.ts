/**
 * OTO 体验目录纯契约（红线 3：types 层零运行时数据，数据实体见 src/ammo/experience-catalog.ts）。
 * AR/spatial 参考演示的本地生活体验预览数据模型。
 */

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
