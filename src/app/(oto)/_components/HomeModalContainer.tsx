"use client";
import AuthSheet from "@/components/oto-ui/auth/AuthSheet";
import EnvBadge from "@/components/oto-ui/EnvBadge";

/**
 * HomeModalContainer — 集中挂载全局弹层（AuthSheet / EnvBadge 等），
 * 抽离为独立文件以满足 page.tsx 250 行门禁，外骨骼零漂移。
 */
export default function HomeModalContainer() {
  return (
    <>
      <AuthSheet />
      <EnvBadge />
    </>
  );
}
