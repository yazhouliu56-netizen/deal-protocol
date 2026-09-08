"use client";
import DuoButton from "@/components/ui/DuoButton";
import { CapybaraBadge, SleepyBeast } from "@/components/oto-ui/MascotStates";

/**
 * 空态统一壳（P7 收敛：7 处手写空态同构 → 单组件）。
 * 白卡 + 吉祥物 + 可选标题 + 描述 + 主行动键；data-testid 由调用方透传（e2e 零漂移）。
 */
export default function DuoEmpty({
  mascot,
  title,
  desc,
  action,
  onAction,
  testId,
  launchTestId,
}: {
  mascot: "capy-sleepy" | "beast-empty";
  title?: string;
  desc: string;
  action: string;
  onAction: () => void;
  testId: string;
  launchTestId: string;
}) {
  return (
    <div
      className="bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] p-6 flex flex-col items-center text-center gap-1.5"
      data-testid={testId}
    >
      {mascot === "capy-sleepy" ? (
        <CapybaraBadge mood="sleepy" />
      ) : (
        <SleepyBeast mood="empty" interactive={false} />
      )}
      {title && (
        <p className="text-xs font-extrabold text-[#4b4b4b] mt-1">{title}</p>
      )}
      <p className="text-xs text-[#767676] mt-1">{desc}</p>
      <DuoButton variant="primary" size="sm" sound="click" onClick={onAction} data-testid={launchTestId}>
        {action}
      </DuoButton>
    </div>
  );
}
