"use client";

/**
 * 硬件权限防拒绝预授权解释浮层（Pre-permission Sheet · 白皮书 §八）。
 *
 * 在首次触达 LBS 打卡 / 相机存证前弹出解释层：先讲清「为什么需要、
 * 怎么用、用几次」，再引导用户授权——降低权限被拒率（iOS 二次
 * 授权需跳系统设置，属不可逆高成本路径）。
 *
 * - GEOLOCATION：单次定位打卡（履约真实性核验，200m 围栏语义）；
 * - CAMERA：防伪物证链拍照存证；
 * - isPermanentlyDenied：已永久拒绝时切换「地址栏锁形图标重置指引」，
 *   引导用户去浏览器站点设置恢复权限。
 */

/** 触控规范：交互按钮最小高度（推荐 ≥44px，规范采用 48px）。 */
export const PERMISSION_BUTTON_MIN_HEIGHT_PX = 48;

export type PermissionType = "GEOLOCATION" | "CAMERA";

export interface IPrePermissionSheetProps {
  permissionType: PermissionType;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** 已处于永久拒绝态（浏览器设置锁死）→ 展示重置指引。 */
  isPermanentlyDenied?: boolean;
}

export const PERMISSION_COPY: Record<
  PermissionType,
  { title: string; body: string; confirm: string }
> = {
  GEOLOCATION: {
    title: "📍 定位权限",
    body: "(•) 需要获取您的实时位置：为了精准核验您已到达服务地点（200米内），并保障履约真实性，平台将在打卡瞬间获取单次定位。",
    confirm: "允许单次定位",
  },
  CAMERA: {
    title: "📷 相机权限",
    body: "📷 需要开启相机权限：为了记录施工现场真实环境并生成防伪物证链，请使用相机拍照打卡。",
    confirm: "开启相机",
  },
};

export const PERMANENTLY_DENIED_HINT =
  "浏览器已永久拒绝该权限：请在地址栏点击「锁形图标 → 网站设置 → 权限」，将权限改为「允许」后重试。";

const SHEET_CSS = `
.prep-sheet{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-end;
  background:rgba(0,0,0,.45);-webkit-tap-highlight-color:transparent}
.prep-sheet-card{width:100%;max-width:520px;margin:0 auto;border-radius:24px 24px 0 0;
  background:rgba(15,18,35,.96);border:1px solid rgba(255,255,255,.14);
  border-bottom:none;padding:22px 20px calc(22px + env(safe-area-inset-bottom));
  backdrop-filter:blur(20px) saturate(160%);box-shadow:0 -12px 40px rgba(0,0,0,.5)}
.prep-sheet-grab{width:44px;height:5px;border-radius:999px;background:rgba(255,255,255,.22);margin:0 auto 16px}
.prep-sheet-title{font-size:16px;font-weight:800;color:#f1f5f9;margin-bottom:10px}
.prep-sheet-body{font-size:13px;line-height:1.7;color:#cbd5e1;margin-bottom:18px}
.prep-sheet-denied{border:1px solid rgba(251,191,36,.4);border-radius:12px;
  background:rgba(251,191,36,.08);padding:12px;font-size:12px;line-height:1.7;color:#fde68a;margin-bottom:18px}
.prep-sheet-actions{display:flex;gap:12px}
.prep-sheet-btn{flex:1;display:flex;align-items:center;justify-content:center;
  min-height:48px;border-radius:14px;font-size:14px;font-weight:700;
  -webkit-tap-highlight-color:transparent;cursor:pointer;transition:transform .12s}
.prep-sheet-btn:active{transform:scale(.97)}
.prep-sheet-btn-cancel{background:rgba(255,255,255,.07);color:#94a3b8;border:1px solid rgba(255,255,255,.1)}
.prep-sheet-btn-confirm{background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff;
  border:1px solid rgba(255,255,255,.2);box-shadow:0 4px 18px rgba(99,102,241,.35)}
`;

export default function PrePermissionSheet({
  permissionType,
  isOpen,
  onConfirm,
  onCancel,
  isPermanentlyDenied,
}: IPrePermissionSheetProps) {
  if (!isOpen) return null;
  const copy = PERMISSION_COPY[permissionType];

  return (
    <div
      className="prep-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      data-permission-type={permissionType}
      data-permanently-denied={isPermanentlyDenied ? "1" : "0"}
    >
      <div className="prep-sheet-card">
        <style>{SHEET_CSS}</style>
        <div className="prep-sheet-grab" aria-hidden="true" />
        <div className="prep-sheet-title">{copy.title}</div>
        <div className="prep-sheet-body">{copy.body}</div>
        {isPermanentlyDenied && (
          <div className="prep-sheet-denied" role="status">
            {PERMANENTLY_DENIED_HINT}
          </div>
        )}
        <div className="prep-sheet-actions">
          <button
            type="button"
            className="prep-sheet-btn prep-sheet-btn-cancel"
            style={{ minHeight: PERMISSION_BUTTON_MIN_HEIGHT_PX }}
            onClick={onCancel}
            data-action="cancel"
          >
            暂不授权
          </button>
          <button
            type="button"
            className="prep-sheet-btn prep-sheet-btn-confirm"
            style={{ minHeight: PERMISSION_BUTTON_MIN_HEIGHT_PX }}
            onClick={onConfirm}
            data-action="confirm"
          >
            {copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
