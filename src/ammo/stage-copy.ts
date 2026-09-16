/**
 * 阶段提醒弹药文案表（P4 · 用户裁决 2026-09-16）。
 *
 * 归属 ammo 域（宪法 #4：业务文案跟弹药走，base 只定槽位）。
 * v1 两类目：housekeeping（Type1）/ meetup-social-v1（Type2，provider = 组织者）。
 * 考卷锁：两类目 10 槽全覆盖，缺一条即红。
 */

export type StageCopyCategory = "housekeeping" | "meetup-social-v1";

export const HOUSEKEEPING_STAGE_COPY: Record<string, string> = {
  "provider.accepted.kit": "出发前自查：工具齐、鞋套带、着装干净板正",
  "customer.accepted.wait": "师傅已接单，请保持电话畅通",
  "provider.departed.enroute": "按约定时限出发，超时走申诉别硬赶",
  "customer.departed.door": "师傅已出发，请留门并清出作业面",
  "provider.arrived.checkin": "到场先打卡，再报姓名工号",
  "customer.arrived.verify": "当面核对师傅身份与订单信息",
  "provider.inprogress.safety": "先断电验电；抹布按厨卫分区，忌混用",
  "customer.inprogress.coop": "贵重物品先收好，问题随时当面提",
  "provider.done.wrap": "完工传 after 图，请用户点确认",
  "customer.done.rate": "点确认即放 85%，三勾定剩下 15%",
};

export const MEETUP_STAGE_COPY: Record<string, string> = {
  "provider.accepted.kit": "建单保证金已收齐，盯紧已付名单",
  "customer.accepted.wait": "已进局，留意集合时间地点变更",
  "provider.departed.enroute": "提前到集合点，准备签到",
  "customer.departed.door": "组织者已出发，请按时赶往集合点",
  "provider.arrived.checkin": "到点点到＋定位，一个不能少",
  "customer.arrived.verify": "到场找组织者签到",
  "provider.inprogress.safety": "清点人数，AA 账当场算清",
  "customer.inprogress.coop": "配合点到，离场先打招呼",
  "provider.done.wrap": "传小票金额，发起解冻",
  "customer.done.rate": "核对小票点确认，6h 无异议自动退押金",
};

export const STAGE_COPY_TABLES: Record<StageCopyCategory, Record<string, string>> = {
  housekeeping: HOUSEKEEPING_STAGE_COPY,
  "meetup-social-v1": MEETUP_STAGE_COPY,
};
