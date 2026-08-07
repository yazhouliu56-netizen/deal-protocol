/**
 * 拼位裂变防自刷计数（纯逻辑）。
 * 规则：分享本身不计；只有"新加入者（非发起人本人，且此前未统计过）"给出真实
 * 回应（openClaim 接单/磋商、joinSeat 拼位）才 +1。同一加入者只计一次。
 */
export function fissionIncrement(
  wave: { fissionCount?: number; fissionBy?: string[] },
  newcomerId: string
): { fissionCount: number; fissionBy: string[] } {
  if (!newcomerId) return { fissionCount: wave.fissionCount ?? 0, fissionBy: wave.fissionBy ?? [] };
  const by = wave.fissionBy ?? [];
  if (by.includes(newcomerId)) {
    return { fissionCount: wave.fissionCount ?? 0, fissionBy: by };
  }
  return { fissionCount: (wave.fissionCount ?? 0) + 1, fissionBy: [...by, newcomerId] };
}