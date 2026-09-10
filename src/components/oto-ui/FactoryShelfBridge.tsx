"use client";

import { useEffect } from "react";
import { rehydrateFactoryShelf } from "@/lib/factory-shelf";

/** 工厂货架恢复桥（P4-T3）：挂载一次，把落盘品类注回动态池。坏条跳过，不拦启动。 */
export default function FactoryShelfBridge() {
  useEffect(() => {
    try {
      rehydrateFactoryShelf();
    } catch {
      /* 恢复失败＝本次无动态品类，不阻塞应用 */
    }
  }, []);
  return null;
}
