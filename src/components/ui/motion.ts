/**
 * 入场动效三档（P10-3 单源）：全仓 motion 入场 initial/animate 唯一真理源。
 *
 * - RISE_6：行内小浮层/徽标（WorkerWorkbench 弹药行、FriendKit、ShareKit）
 * - RISE_8：卡片标准入场（ChatMessageCards、DiagnosisCard、DialCard、MyWaves、ReviewSection…）
 * - RISE_10：弹层/气泡大位移（ChatBubble、OrderDetailModal、ReviewFormModal、ARPage）
 *
 * transition 各站自定（duration/ease/spring 场景各异，不收敛）；
 * 复合形态用 spread 扩展（ARPage height、DynamicDraftCard/ShareKit scale），零漂移。
 * 与 DuoCardShell motion 透传同形，可直接传入。
 */
interface RisePreset {
  initial: { opacity: number; y: number };
  animate: { opacity: number; y: number };
}

export const RISE_6: RisePreset = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

export const RISE_8: RisePreset = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

export const RISE_10: RisePreset = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};
