# 全产品端到端拟人交互实测验收总报告

> 验收方式：Chrome CDP 真实浏览器拟人交互（非脚本直调），覆盖协议核心界面与全链路资金/状态机流转。
> 验收基线：2026-08-18，`http://localhost:3000/`（生产模式 `next start`，构建 page-344a…）+ 本地沙盒数据模式。
> 门禁：tsc 0 错 · `npm test` 1476/1476 全绿 · build exit 0 · 收敛门禁 exit 0。

## 一、验收范围

| 检查点 | 范围 | 结论 |
|--------|------|------|
| 1 | Home 发单流：需求广播 → 支付托管 → 热力图/雷达联动 | ✅ 通过（¥100 家政单全链路） |
| 2 | AI 对话转单流：口语诉求 → 澄清追问 → 匹配 → 正式建单 | ✅ 通过（含「10点」时间词表命中） |
| 3 | AR 存证相机：水印 / GPS 时空戳 / SHA-256 指纹 / 证据 Toast | ✅ 通过（指纹 e9b42acb… 验证） |
| 4 | Trip 履约座舱五态状态机 MATCHED→IN_SERVICE→INSPECTED→SETTLED | ✅ 通过 + 现场增项 ¥80 联动（详见二期修复后复验） |
| 5 | 双轨 AI 仲裁：争议调解半屏抽屉 / L2 方案接受 / BREACH_SETTLED | ✅ 通过（¥30 退款 + ¥10 券 + -10 信用实测） |
| 6 | Profile 长者模式开关与应急伪装 | ✅ 通过（AnnouncementKit 语音播报 + 伪装来电遮罩） |
| 7 | `/dp` 协议管理门户与 `/oto` 重定向 | ✅ 通过（/dp → /login 门户正常，/oto → / 重定向） |

控制台运行时错误：**0**（唯一噪音为 Supabase `p2p_broadcast` 404 → 确定性降级本地 localStorage 沙盒，属预期路径）。

## 二、验收中发现并修复的 4 项物理缺陷（本轮闭环）

拟人实测按「先生效后修复」流程推进，4 项缺陷全部先被实测复现，再定点修复后回测取证。

| # | 缺陷现象（实测复现） | 根因 | 修复（代码落点） | 回测实证 |
|---|----------------------|------|------------------|----------|
| 1 | 无 Before/After 双拍照片，IN_SERVICE 点一次核销 CTA 直通 INSPECTED（红线 4 零信任物理感知违约） | `FulfillmentCenter.handleComplete` 未消费 `evidencePhotos`，跃迁载荷无 photos | 注入 `evidencePhotos`（相位 `[0]=Before [1]=After`）→ WATERMARK_CAMERA 弹药缺双拍 → 阻断 + Toast「请先完成服务前后双拍存证」 | CDP 实测：滞留 IN_SERVICE、transit-error「⚠️ 请先完成服务前后双拍存证」，未跃迁 |
| 2 | SETTLED 后 activeWave 槽位不释放，后续 MATCHED 单无法载入座舱 | SETTLED 终局未归档 wave | 核销与争议调解（BREACH_SETTLED）双路径均 `closeWave(wave.id)` | localStorage 实测 `wave.status=closed`（UI「已关闭」徽标），下一单无缝载入追求灯座舱 |
| 3 | 刷新页面后 SETTLED/closed 回退（终局丢失） | `partialize` 白名单缺 `fulfilment`；`WaveBundle` 契约缺字段；`mergeByIdLevel` 合并时丢弃 | 白名单追加 + 契约扩列 + transport 合并透传（宪法收敛条文 #3） | 刷新后 `closed + isSettled:true` 终局不回退，localStorage 落盘可见 |
| 4 | MyWaves「提交争议」无原因时静默无响应（用户无法感知校验失败） | `AcceptancePanel` 静默 return | Toast 分级指引（未选原因 / 未填凭证），合法表单真实 openDispute 落库 | CDP 实测 Toast「⚠️ 请先选择争议原因」+ 合法提交 →「⚖️ 争议进行中」+ disputes 持久化 |

## 三、回归与门禁

| 项 | 结果 |
|----|------|
| 单测 | **1476/1476 全绿**（vitest 606 + node:test 870；较 1473 基线 +3：双拍拦截滞留 / 注入双拍三次直通+closed 断言 / persist 白名单 + 争议按钮 Toast 闭环） |
| TypeScript | `npx tsc --noEmit` 0 报错 |
| Build | `npm run build` Compiled successfully，产物复核含全部修复文本 |
| 收敛门禁 | `npm run check:convergence` exit 0（零 rename，transport 契约扩列已按条文 #3 登记） |
| 运行时错误 | 0（仅 THREE.Clock deprecation 噪音） |

## 四、遗留观察项（如实标注，非阻塞）

1. **双拍 UI 提示与引擎放行口径**：座舱 UI 已明示「完成双拍后方可验收（红线 4）」，引擎侧 WATERMARK_CAMERA 弹药缺双拍同样阻断——双处口径一致，无静默旁路。
2. **supabase transport 首次拉取 404 后异步降级**：p2p_broadcast 表缺失时首帧写盘经一次远端往返后收敛到 localFallback（本地沙盒模式实测稳定），跨设备 Realtime 场景待表就绪后复测。
3. **`next start` 持有 build 前 manifest**：`npm run build` 重建 `.next` 后**运行中**的旧 `next start` 仍按启动时 manifest 服务旧 chunk（实测 ChunkLoadError）——须重启生产进程；本报告全部复测均在新构建（page-344a…）上进行。
4. **AuthSheet 登录与 identity 层**：登录态写 `oto-auth-account`（Profile UI），跨屏身份切换经 `oto:auth-changed` 广播——演示沙盒预期行为。

## 五、验收结论

**7/7 检查点通过，4/4 缺陷闭环，控制台零业务错误。** 全产品（发单 → 撮合 → 支付托管 → 履约五态 → 存证/仲裁 → 结算 → 评价）数据闭环在真实浏览器交互下成立；协议管理门户与重定向路由正常；履约终局状态刷新不回退。