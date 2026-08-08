# ADR-0003: 跨 tab 共享空间的删除语义（friendRequests 墓碑化）
日期：2026-08-08
状态：Accepted

## Context

S3 关系沉淀（转友）落地后，跨 tab 实测发现：接收方接受好友请求后，friendships
已生成、请求却仍残留在 localStorage（两个入口都显示待确认）。根因是共享空间
persist 经 `transport.mergeByIdLevel` 做 union 合并——union 对"无删除语义"的集合
安全（注释明示此假设），但 `friendRequests` 是 bundle 中**第一个带删除语义**的
集合：accept/ignore/过期都意味着"移除"。

具体机制：accept 把请求从内存 state 移除并写回，但 transport 读到的 base（磁盘
旧快照）仍含该 id，`byId(base, next)` 把它并回 → 删除永不落盘，且跨 tab storage
事件每次 rehydrate 都复活。

## Decision

- **tombstone 集合 `friendRequestRemovals: string[]`** 加入 WaveBundle：accept /
  ignore / sweepFriendRequests 三动作把被移除的请求 id 追加记录。
- `mergeByIdLevel` 对 friendRequests 先 union 再按墓碑过滤；墓碑自身 union 持久
  （单调不减，天然幂等）。其余集合保持原 union 语义不变。
- 纯函数放撤到 `transport.ts`，`mergeByIdLevel` 导出以便单测。新增
  `src/lib/p2p/transport.test.ts` 4 用例：union 保留新 id、墓碑过滤、stale 快照
  不可复活、墓碑跨合并存活。

## Alternatives Rejected

- **friendRequests 改 next 覆盖（非 union）**：会破坏其他无删除集合的跨 tab 合并
  安全，且改造面过大；墓碑只针对有删除语义的集合，侵入最小。
- **sweepPromotions / 全局递增版本号**：为单个集合引入全局写冲突检测，复杂度与
  收益不成正比（本地单机场景，无多写并发）。

## Consequences

- bundle 增加一个数组字段，向后兼容（旧数据无 Removals 字段时 `?? []` 兜底）。
- 后续任何带删除语义的新集合（如聊天消息撤回）必须沿用墓碑，不能用裸 union。
- 单测 175/175 全绿（原 153 + diagnostic/friends/p2p-transport 22 项），tsc、
  lint 通过；浏览器双 tab 实测：接受后移除落盘、reload 不复活、无 console error。