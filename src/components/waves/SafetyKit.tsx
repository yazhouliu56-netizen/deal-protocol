"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, ShieldCheck, Gavel, Eye } from "lucide-react";
import AdminPanel from "@/components/oto-ui/admin/AdminPanel";
import RoamGuardPanel from "@/components/waves/RoamGuardPanel";

/**
 * 安全四件套 — the platform safety floor for stranger meetups:
 * 1. 紧急联系人  2. 见面信息对联系人可见  3. GPS 到达确认  4. 安全面基点推荐
 * (对标: safe exchange zones / 滴滴紧急联系人)
 */
const SAFE_SPOTS = [
  { name: "万象汇 1F 服务台", type: "商圈", safe: 96 },
  { name: "兰山警务站", type: "警务站", safe: 99 },
  { name: "人民公园东门岗亭", type: "公园管理点", safe: 93 },
  { name: "万达广场 B1 保安岗", type: "商圈", safe: 95 },
];

export default function SafetyKit() {
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [shareVisible, setShareVisible] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-[#e5e5e5] shadow-sm text-left hover:border-emerald-400/50 transition-colors"
        aria-label="安全中心"
      >
        <span className="w-8 h-8 rounded-xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
          <ShieldCheck size={15} className="text-emerald-400" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-bold text-[#4b4b4b]">
            安全中心
          </span>
          <span className="block text-xs text-[#afafaf] truncate">
            紧急联系人 · 见面兜底 · 安全面基点
          </span>
        </span>
      </button>

      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-x-3 bottom-24 z-50 bg-white border border-[#e5e5e5] shadow-sm rounded-3xl p-4 max-h-[70vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400" /> 安全中心
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="关闭安全中心"
                className="text-[#afafaf] hover:text-[#4b4b4b]"
              >
                ✕
              </button>
            </div>

            {/* 1. 紧急联系人 */}
            <label className="block mb-1.5">
              <span className="text-xs font-semibold text-[#afafaf] flex items-center gap-1">
                <Phone size={10} className="text-brandCyan" /> 紧急联系人
              </span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="家人 / 好友手机号（仅见面时段可用）"
                aria-label="紧急联系人"
                className="mt-1 w-full rounded-2xl bg-[#f7f7f7] border border-[#e5e5e5] px-3.5 py-2.5 text-xs placeholder:text-[#afafaf] text-[#4b4b4b] outline-none focus:border-brandPurple/50 transition-colors"
              />
            </label>

            {/* 2. 见面信息可见性 */}
            <button
              onClick={() => setShareVisible(!shareVisible)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#f7f7f7] border border-[#e5e5e5] mb-1.5"
              aria-label="见面信息对联系人可见"
            >
              <span className="flex items-center gap-2 text-xs text-[#4b4b4b]">
                <Eye size={12} className="text-brandCyan" /> 见面信息对联系人可见
              </span>
              <span
                className={`w-9 h-5 rounded-full relative transition-colors ${
                  shareVisible ? "bg-emerald-400/70" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    shareVisible ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
            <p className="text-xs text-[#afafaf] mb-3 -mt-1">
              开启后，见面时间/地点将同步给你的紧急联系人
            </p>

            {/* 3. GPS 到达确认 */}
            <button
              onClick={() => setCheckedIn(!checkedIn)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border mb-3 transition-colors ${
                checkedIn
                  ? "bg-emerald-400/15 border-emerald-400/50"
                  : "bg-[#f7f7f7] border-[#e5e5e5]"
              }`}
              aria-label="到达见面点确认"
            >
              <span className="flex items-center gap-2 text-xs text-[#4b4b4b]">
                <MapPin size={12} className="text-brandCyan" /> 到达见面点确认
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  checkedIn
                    ? "bg-emerald-400/20 text-emerald-300"
                    : "bg-[#f7f7f7] text-[#afafaf]"
                }`}
              >
                {checkedIn ? "已确认到达 ✓" : "一键确认"}
              </span>
            </button>

            {/* 4. 安全面基点推荐 */}
            <span className="text-xs font-semibold text-[#afafaf] flex items-center gap-1 mb-2">
              <MapPin size={10} className="text-emerald-400" /> 推荐安全见面点
            </span>
            <div className="flex flex-col gap-1.5">
{SAFE_SPOTS.map((s) => (
                <button
                  key={s.name}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f7f7f7] border border-[#e5e5e5] text-left hover:border-emerald-400/40 transition-colors"
                >
                  <span className="text-sm">📍</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-[#4b4b4b] block truncate">
                      {s.name}
                    </span>
                    <span className="text-xs text-[#afafaf]">{s.type}</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-300">
                    {s.safe} 分安全
                  </span>
                </button>
              ))}
            </div>

            {/* 漫游 · 多开风控（P8 商业化前哨） */}
            <RoamGuardPanel />

            {/* 5. 平台治理后台（管理角色入口） */}
            <button
              onClick={() => setAdminOpen(true)}
              className="mt-3 w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#f7f7f7] border border-[#e5e5e5] hover:border-emerald-400/40 transition-colors"
            >
              <span className="flex items-center gap-2 text-xs text-[#4b4b4b]">
                <Gavel size={12} className="text-emerald-400" /> 平台治理后台
              </span>
              <span className="text-xs text-[#afafaf]">举报裁定 · 下架 · 封禁</span>
            </button>
          </motion.div>
        </>
        )}
        <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
}