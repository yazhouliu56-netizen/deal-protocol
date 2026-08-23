"use client";
import WaveFeed from "@/components/waves/WaveFeed";

/** 第三层：雷达波浪视口 —— 直达 WaveFeed 实时需求波卡流。 */
export default function RadarFeedSection() {
  return (
    <div className="mt-4" data-layer="wave-feed">
      <WaveFeed />
    </div>
  );
}
