"use client";
import { useIdentityStore } from "@/store/useIdentityStore";

/**
 * 当前用户头像徽章：有本地上传头像则显示图片，否则用 emoji 兜底。
 * 尺寸同心：sm = 导航/雷达头像，lg = 个人中心大头像。
 */
export default function IdentityAvatar({
  size = "sm",
}: {
  size?: "sm" | "lg";
}) {
  const avatar = useIdentityStore((s) => s.identity.avatar);
  const emoji = useIdentityStore((s) => s.identity.emoji);
  const cls =
    size === "lg"
      ? "w-14 h-14 rounded-2xl text-xl"
      : "w-9 h-9 rounded-full text-sm";
  return (
    <div
      className={`${cls} btn-primary flex items-center justify-center overflow-hidden font-extrabold shadow-lg glow-purple-strong shrink-0`}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      ) : (
        emoji
      )}
    </div>
  );
}