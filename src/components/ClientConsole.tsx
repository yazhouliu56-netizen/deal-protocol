"use client";

/**
 * @deprecated Phase 2.1 双轨收敛下线：纯硬编码零 API 假控制台。
 * /dp/console 已 307 归流至 /dp/provider/incoming。
 * 保留文件壳（C16：禁物理删除）与原 Props 签名，防止历史引用报 import 错误。
 */
interface ClientConsoleProps {
  onBackToHome?: () => void;
}

export default function ClientConsole({ onBackToHome }: ClientConsoleProps) {
  return (
    <div data-testid="client-console-deprecated">
      <p>该控制台已下线，正在为你跳转真实接单池……</p>
      <button type="button" onClick={onBackToHome}>
        返回
      </button>
    </div>
  );
}
